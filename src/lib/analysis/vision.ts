/*
 * Vision analysis (Build-Spec §6, M4). One structured Claude Vision call per
 * page: full-page screenshot + enumerated elements + context → conversion
 * levers. Discipline enforced here, not hoped for:
 *
 *  - "List facts, then judge" prompt structure in one call (Build-Spec §6).
 *  - Every finding MUST cite an elementId from the provided enumeration.
 *    Findings citing an unknown id are dropped — no element → no finding.
 *  - The model picks only category + severity. Impact = severity; range comes
 *    from the rubric (rangeFor); pin {x,y} is computed from the element's REAL
 *    bounding box — never from the model.
 *  - AOV (crosssell) is kept separate from CR via leverTypeFor.
 *  - Forced tool use gives us strict JSON; the shared rubric system prompt is
 *    prompt-cached so the ~5 page calls per run (and across runs) reuse it.
 */

import Anthropic from "@anthropic-ai/sdk";
import { readEnv } from "@/lib/analysis/config";
import { rangeFor, leverTypeFor } from "@/lib/rubric";
import { CATEGORY_META, type LeverCategory } from "@/lib/taxonomy";
import type { ImpactLevel } from "@/styles/tokens";
import type { AnalysisContext, Lever } from "@/lib/types";
import type { RenderedPage, RenderedView } from "@/lib/analysis/pipeline-types";

const CATEGORIES: LeverCategory[] = [
  "cta",
  "price",
  "trust",
  "product",
  "atf",
  "crosssell",
  "friction",
  "tech",
];

const SYSTEM_PROMPT = `Du bist ein nüchterner E-Commerce-CRO-Analyst. Du bewertest EINE Funnel-Seite anhand eines Screenshots und einer Liste real gerenderter Elemente (mit IDs).

Arbeitsweise — erst Fakten, dann Urteil:
1. Lies die bereitgestellten Elemente und den Screenshot. Stütze dich nur auf das, was du tatsächlich siehst.
2. Identifiziere die 3–5 STÄRKSTEN Conversion-Hebel dieser Seite. Lieber wenige treffsichere als viele schwache.

Hebel-Taxonomie (genau diese Kategorien):
- cta: Primärer CTA — vorhanden, above the fold, visuelle Dominanz, Label, sticky/Mobile.
- price: Preis & Preis-Psychologie — Prominenz, Ankerpreis, bezifferte Ersparnis, Versandkostentransparenz.
- trust: Trust & Risikoreduktion — Bewertungen, Badges, Rückgabe, Lieferzeit, Nähe zum CTA.
- product: Entscheidungssicherheit / Produktinfo — echtes Bild, Galerie, Specs, Beschreibung.
- atf: Above-the-Fold-Komposition — Bild + Preis + CTA gemeinsam im ersten Viewport, Ablenker.
- crosssell: Cross-/Up-Sell — Bundle-/Zubehör-Modul. WIRKT AUF AOV, NICHT auf die CR.
- friction: Friction & Usability — Zwangsregistrierung, Popups, Cookie-Layer, zu viele Felder, Tap-Targets.
- tech: Technische Performance — LCP, CLS, Bildgewicht (nur wenn klar erkennbar).

Eiserne Regeln:
- JEDER Befund ist an genau EIN Element aus der mitgelieferten Liste gebunden (elementId). Findest du kein passendes Element, gib den Befund NICHT aus. Kein Element → kein Befund.
- Du wählst NUR Kategorie und Schweregrad (severity: high/mid/low). Impact-Range und Pin-Position werden NICHT von dir gesetzt.
- Erfinde nichts, was nicht im Screenshot/Elementen belegt ist. Kontext (Branche, Device-Split, Kanäle) gewichtet und rahmt Befunde — erfindet sie nie.
- Schreibqualität: observation = was konkret beobachtet (element-verankert), mechanism = warum das die Conversion kostet, test = ein konkreter, umsetzbarer Testvorschlag. Deutsch, prägnant, kein Marketing-Sprech.
- Markiere mobile-spezifische Probleme mit isMobileIssue=true.`;

interface RawFinding {
  elementId: string;
  category: LeverCategory;
  severity: ImpactLevel;
  title: string;
  observation: string;
  mechanism: string;
  test: string;
  isMobileIssue?: boolean;
}

const TOOL: Anthropic.Tool = {
  name: "report_levers",
  description:
    "Melde die 3–5 stärksten Conversion-Hebel dieser Seite, jeder an ein reales Element gebunden.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      levers: {
        type: "array",
        description: "3–5 Hebel, nach Schwere absteigend.",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            elementId: {
              type: "string",
              description: "ID aus der mitgelieferten Elementliste (z. B. el-12).",
            },
            category: { type: "string", enum: CATEGORIES },
            severity: { type: "string", enum: ["high", "mid", "low"] },
            title: { type: "string" },
            observation: { type: "string" },
            mechanism: { type: "string" },
            test: { type: "string" },
            isMobileIssue: { type: "boolean" },
          },
          required: [
            "elementId",
            "category",
            "severity",
            "title",
            "observation",
            "mechanism",
            "test",
          ],
        },
      },
    },
    required: ["levers"],
  },
};

function buildUserContent(
  page: RenderedPage,
  ctx: AnalysisContext,
): Anthropic.ContentBlockParam[] {
  const view: RenderedView = page.desktop;
  const elementsText = view.elements
    .map((e) => `${e.id} <${e.tag}${e.role ? ` role=${e.role}` : ""}> "${e.text}"`)
    .join("\n");
  const mobileNote = page.mobile
    ? `\nMobile-Elemente (390px) zusätzlich vorhanden — gewichte mobile Befunde gemäß ${ctx.device}% Mobile-Traffic.`
    : "";

  return [
    {
      type: "image",
      source: {
        type: "base64",
        media_type: "image/jpeg",
        data: view.screenshot.toString("base64"),
      },
    },
    {
      type: "text",
      text:
        `Seitentyp: ${page.type}\nBranche: ${ctx.industry}\nDevice-Split: ${ctx.device}% Mobile / ${100 - ctx.device}% Desktop\nKanäle: ${ctx.channels.join(", ")}\n` +
        `Dokumentgröße: ${view.docWidth}×${view.docHeight}px${mobileNote}\n\n` +
        `Gerenderte Elemente (elementId, Tag, Text):\n${elementsText}\n\n` +
        `Analysiere diese Seite und rufe report_levers mit den 3–5 stärksten Hebeln auf.`,
    },
  ];
}

/** Map a validated finding to a Lever, computing pin + range from ground truth. */
function toLever(
  f: RawFinding,
  page: RenderedPage,
  n: number,
): Lever | null {
  const el = page.desktop.elements.find((e) => e.id === f.elementId);
  if (!el) return null; // no element → no finding (Build-Spec §6)
  const { docWidth, docHeight } = page.desktop;
  const pin = {
    x: Math.round(((el.x + el.w / 2) / docWidth) * 1000) / 10,
    y: Math.round(((el.y + el.h / 2) / docHeight) * 1000) / 10,
  };
  return {
    id: `${page.id}-${n}`,
    n,
    elementId: el.id,
    pin,
    category: f.category,
    categoryLabel: CATEGORY_META[f.category]?.label ?? f.category,
    impact: f.severity,
    range: rangeFor(f.category, f.severity),
    type: leverTypeFor(f.category),
    title: f.title,
    observation: f.observation,
    mechanism: f.mechanism,
    test: f.test,
    reachable: true,
  };
}

export async function analyzePageVision(
  page: RenderedPage,
  ctx: AnalysisContext,
): Promise<Lever[]> {
  const env = readEnv();
  const client = new Anthropic({ apiKey: env.anthropicApiKey });

  const message = await client.messages.create({
    model: env.anthropicModel,
    max_tokens: 4000,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" }, // stable rubric — cache across pages/runs
      },
    ],
    tools: [TOOL],
    tool_choice: { type: "tool", name: "report_levers" },
    messages: [{ role: "user", content: buildUserContent(page, ctx) }],
  });

  const toolUse = message.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
  );
  if (!toolUse) return [];

  const raw = (toolUse.input as { levers?: RawFinding[] }).levers ?? [];
  const levers: Lever[] = [];
  for (const f of raw.slice(0, 5)) {
    const lever = toLever(f, page, levers.length + 1);
    if (lever) levers.push(lever);
  }
  return levers;
}

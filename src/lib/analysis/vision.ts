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
import sharp from "sharp";
import { readEnv } from "@/lib/analysis/config";
import { rangeFor, leverTypeFor } from "@/lib/rubric";
import { CATEGORY_META, type LeverCategory } from "@/lib/taxonomy";
import type { ImpactLevel, } from "@/styles/tokens";
import type { AnalysisContext, Lever, Viewport } from "@/lib/types";
import type { RenderedPage, RenderedView } from "@/lib/analysis/pipeline-types";

// Anthropic downscales any image to ~1568px on the long edge. A full-page
// screenshot of a long (esp. mobile) shop becomes an unreadable sliver that way
// → the model finds nothing. So we slice tall pages into READABLE vertical
// tiles (each ≤1568px tall, native width kept) and send them as one sequence.
// Pins come from real element coordinates, so tiling never shifts them.
async function imagesForVision(jpeg: Buffer): Promise<string[]> {
  try {
    const meta = await sharp(jpeg).metadata();
    const w = meta.width ?? 0;
    const h = meta.height ?? 0;
    // Short enough to stay readable as a single image.
    if (!w || !h || (h <= 1568 && w <= 1568)) {
      const out = await sharp(jpeg)
        .resize({ width: 1568, height: 1568, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 82 })
        .toBuffer();
      return [out.toString("base64")];
    }
    const TILE = 1500; // < 1568 long edge → Anthropic keeps native width (readable)
    const MAX_TILES = 6; // bound cost; covers the first ~9000px of the page
    const tiles: string[] = [];
    for (let top = 0, i = 0; top < h && i < MAX_TILES; top += TILE, i++) {
      const th = Math.min(TILE, h - top);
      let pipe = sharp(jpeg).extract({ left: 0, top, width: w, height: th });
      if (w > 1568) pipe = pipe.resize({ width: 1568, withoutEnlargement: true });
      tiles.push((await pipe.jpeg({ quality: 82 }).toBuffer()).toString("base64"));
    }
    return tiles;
  } catch {
    return [jpeg.toString("base64")];
  }
}

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
  view: RenderedView,
  page: RenderedPage,
  ctx: AnalysisContext,
  images: string[],
): Anthropic.ContentBlockParam[] {
  const elementsText = view.elements
    .map((e) => `${e.id} <${e.tag}${e.role ? ` role=${e.role}` : ""}> "${e.text}"`)
    .join("\n");
  const viewLabel =
    view.viewport === "mobile" ? "Mobile (390px Breite)" : "Desktop (1280px Breite)";
  const tileNote =
    images.length > 1
      ? `Der Screenshot ist in ${images.length} Ausschnitte aufgeteilt (von oben nach unten) — betrachte sie als EINE durchgehende Seite.\n`
      : "";

  const imageBlocks: Anthropic.ContentBlockParam[] = images.map((data) => ({
    type: "image",
    source: { type: "base64", media_type: "image/jpeg", data },
  }));

  return [
    ...imageBlocks,
    {
      type: "text",
      text:
        `Seitentyp: ${page.type}\nAnsicht: ${viewLabel}\nBranche: ${ctx.industry}\nDevice-Split: ${ctx.device}% Mobile / ${100 - ctx.device}% Desktop\nKanäle: ${ctx.channels.join(", ")}\n` +
        `Dokumentgröße: ${view.docWidth}×${view.docHeight}px\n${tileNote}\n` +
        `Gerenderte Elemente (elementId, Tag, Text):\n${elementsText}\n\n` +
        `Analysiere diese ${view.viewport === "mobile" ? "Mobil" : "Desktop"}-Ansicht und rufe report_levers mit den 3–5 stärksten Hebeln auf.`,
    },
  ];
}

/** Map a validated finding to a Lever, computing pin + range from ground truth. */
function toLever(
  f: RawFinding,
  view: RenderedView,
  pageId: string,
  n: number,
): Lever | null {
  const el = view.elements.find((e) => e.id === f.elementId);
  if (!el) return null; // no element → no finding (Build-Spec §6)
  const { docWidth, docHeight } = view;
  const pin = {
    x: Math.round(((el.x + el.w / 2) / docWidth) * 1000) / 10,
    y: Math.round(((el.y + el.h / 2) / docHeight) * 1000) / 10,
  };
  return {
    id: `${pageId}-${view.viewport}-${n}`,
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

/** Analyze ONE view (desktop or mobile) of a page. Pins are relative to it. */
export async function analyzePageVision(
  page: RenderedPage,
  ctx: AnalysisContext,
  viewport: Viewport,
): Promise<Lever[]> {
  const view: RenderedView =
    (viewport === "mobile" ? page.mobile : page.desktop) ?? page.desktop;
  const env = readEnv();
  const client = new Anthropic({ apiKey: env.anthropicApiKey });
  const images = await imagesForVision(view.screenshot);

  const attempt = async (): Promise<Lever[]> => {
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
      messages: [{ role: "user", content: buildUserContent(view, page, ctx, images) }],
    });
    const toolUse = message.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );
    if (!toolUse) return [];
    const raw = (toolUse.input as { levers?: RawFinding[] }).levers ?? [];
    const out: Lever[] = [];
    for (const f of raw.slice(0, 5)) {
      const lever = toLever(f, view, page.id, out.length + 1);
      if (lever) out.push(lever);
    }
    return out;
  };

  // Sonnet occasionally returns an empty set on a perfectly good page; one
  // retry makes the per-page result reliable.
  let levers = await attempt();
  if (levers.length === 0) levers = await attempt();
  return levers;
}

/*
 * Fazit-Generierung: ein verständliches Gesamt-Fazit der Funnel-Analyse für den
 * Shop-Betreiber (kein Techniker). Ein einziger strukturierter Claude-Aufruf
 * über alle gefundenen Hebel. Schlägt der Aufruf fehl oder fehlt der API-Key,
 * wird ein deterministisches Fazit aus den Daten zusammengesetzt — die
 * Ergebnisseite hat damit IMMER ein Fazit.
 */

import Anthropic from "@anthropic-ai/sdk";
import { readEnv } from "@/lib/analysis/config";
import { IMPACT_LABELS } from "@/lib/labels";
import type {
  AnalysisContext,
  AnalysisSummary,
  AnalyzedPage,
} from "@/lib/types";

const SYSTEM = `Du bist ein erfahrener Conversion-Berater. Fasse die Funnel-Analyse eines Online-Shops für den Shop-Betreiber zusammen — in einfachem, klarem Deutsch, ohne Fachjargon und ohne Marketing-Sprech. Keine erfundenen Zahlen.

Aufgabe:
- verdict: 2–4 Sätze. Was zeigt die Analyse insgesamt, wo liegen die größten Hebel, und worauf kommt es an?
- points: 3–5 kurze, priorisierte Stichpunkte (je ein Satz), die das Wichtigste konkret machen.

Berücksichtige Branche, Traffic-Gewichtung (Mobile/Desktop), Kanäle und — falls angegeben — Zielgruppe und Herausforderungen für die Priorisierung. Ein Problem auf der traffic-stärkeren Ansicht wiegt schwerer.`;

const TOOL: Anthropic.Tool = {
  name: "report_fazit",
  description:
    "Verständliches Gesamt-Fazit der Funnel-Analyse für den Shop-Betreiber.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      verdict: {
        type: "string",
        description: "2–4 Sätze Klartext-Einschätzung.",
      },
      points: {
        type: "array",
        items: { type: "string" },
        description: "3–5 priorisierte Stichpunkte, je ein Satz.",
      },
    },
    required: ["verdict", "points"],
  },
};

const leversOf = (p: AnalyzedPage) => [
  ...p.levers,
  ...(p.secondary?.levers ?? []),
];

/** Deterministisches Fazit, wenn kein LLM verfügbar/erfolgreich ist. */
function fallbackSummary(pages: AnalyzedPage[]): AnalysisSummary {
  const stats = pages
    .map((p) => {
      const lv = leversOf(p);
      return {
        name: p.name,
        total: lv.length,
        high: lv.filter((l) => l.impact === "high").length,
        top: lv.slice(0, 2),
      };
    })
    .filter((s) => s.total > 0);

  const total = stats.reduce((a, s) => a + s.total, 0);
  const high = stats.reduce((a, s) => a + s.high, 0);
  const ranked = [...stats].sort((a, b) => b.high - a.high || b.total - a.total);
  const topPages = ranked.slice(0, 2).map((s) => s.name);

  const verdict =
    `Über ${pages.length} Funnel-Seiten haben wir ${total} Conversion-Hebel gefunden` +
    (high ? `, davon ${high} mit hohem Umsatz-Effekt` : "") +
    `. Die größten Chancen liegen ${
      topPages.length ? `auf ${topPages.join(" und ")}` : "verteilt über den Funnel"
    }. Beginne mit den hoch priorisierten Hebeln — sie bringen am meisten bei überschaubarem Aufwand.`;

  const points: string[] = [];
  for (const s of ranked) {
    for (const l of s.top) {
      if (points.length >= 4) break;
      points.push(`${s.name}: ${l.title}`);
    }
  }
  return { verdict, points: points.slice(0, 4) };
}

/** Knapper Textauszug der Hebel je Seite für den Prompt. */
function buildDigest(pages: AnalyzedPage[]): string {
  return pages
    .map((p) => {
      const lines = leversOf(p)
        .map(
          (l) =>
            `  - [${IMPACT_LABELS[l.impact]}] ${l.title} (${l.categoryLabel}): ${l.observation.slice(0, 200)}`,
        )
        .join("\n");
      return `${p.name}:\n${lines || "  (keine Hebel)"}`;
    })
    .join("\n\n");
}

export async function summarizeAnalysis(
  ctx: AnalysisContext,
  pages: AnalyzedPage[],
): Promise<AnalysisSummary> {
  if (pages.length === 0) {
    return { verdict: "Es konnte keine Seite analysiert werden.", points: [] };
  }
  const env = readEnv();
  if (!env.anthropicApiKey) return fallbackSummary(pages);

  try {
    const client = new Anthropic({ apiKey: env.anthropicApiKey });
    const ctxLine =
      `Branche: ${ctx.industry}\nTraffic: ${ctx.device}% Mobile / ${100 - ctx.device}% Desktop\nKanäle: ${ctx.channels.join(", ")}` +
      (ctx.audienceAge ? `\nAlters-Schwerpunkt: ${ctx.audienceAge}` : "") +
      (ctx.audienceGender ? `\nGeschlechter-Gewichtung: ${ctx.audienceGender}` : "") +
      (ctx.audienceTraits ? `\nZielgruppen-Merkmale: ${ctx.audienceTraits}` : "") +
      (ctx.challenges ? `\nShop-Herausforderungen: ${ctx.challenges}` : "");

    const message = await client.messages.create({
      model: env.anthropicModel,
      max_tokens: 900,
      system: [{ type: "text", text: SYSTEM }],
      tools: [TOOL],
      tool_choice: { type: "tool", name: "report_fazit" },
      messages: [
        {
          role: "user",
          content: `${ctxLine}\n\nGefundene Hebel je Seite:\n\n${buildDigest(pages)}\n\nErstelle das Fazit über report_fazit.`,
        },
      ],
    });

    const toolUse = message.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );
    const input = (toolUse?.input ?? {}) as {
      verdict?: string;
      points?: string[];
    };
    const verdict = (input.verdict ?? "").trim();
    const points = (input.points ?? [])
      .map((p) => p.trim())
      .filter(Boolean)
      .slice(0, 5);
    if (!verdict) return fallbackSummary(pages);
    return { verdict, points };
  } catch {
    return fallbackSummary(pages);
  }
}

/*
 * Mock analysis pipeline (M2). Maps the prototype's mock data into the §4
 * schema and streams it with simulated latency: read-only pages (home, plp,
 * pdp) first, then the stateful pages (cart, checkout) — Build-Spec §8.
 *
 * M3/M4 replace this with the real browser + Vision pipeline behind the same
 * async-generator signature (see run.ts).
 */

import { PAGES, LEVERS, type MockLever } from "@/lib/mock-data";
import { opportunityClass, opportunityScore, overallUplift } from "@/lib/scoring";
import { effortForCategory } from "@/lib/rubric";
import type {
  AnalysisContext,
  AnalyzedPage,
  Lever,
  PageType,
} from "@/lib/types";
import type { AnalysisEvent } from "@/lib/analysis/events";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const toLever = (m: MockLever): Lever => ({
  id: m.id,
  n: m.n,
  pin: m.pin,
  category: m.category,
  categoryLabel: m.categoryLabel,
  impact: m.impact,
  effort: effortForCategory(m.category),
  range: m.range,
  type: m.type,
  title: m.title,
  observation: m.observation,
  mechanism: m.mechanism,
  test: m.test,
  reachable: true,
});

function buildPage(id: string): AnalyzedPage {
  const meta = PAGES.find((p) => p.id === id)!;
  const type = id as PageType;
  const levers = (LEVERS[id] ?? []).map(toLever);
  return {
    id,
    type,
    name: meta.name,
    opportunity: opportunityClass(opportunityScore(type, levers)),
    viewport: "desktop",
    levers,
  };
}

export async function* runMockAnalysis(
  ctx: AnalysisContext,
  normalizedUrl: string,
): AsyncGenerator<AnalysisEvent> {
  const ALL: PageType[] = ["home", "plp", "pdp", "cart", "checkout"];
  // Honor the user's per-stage selection when present; otherwise the full funnel.
  const selectedTypes = (ctx.targets ?? [])
    .filter((t) => t.selected && t.url.trim())
    .map((t) => t.type);
  const order: PageType[] = selectedTypes.length
    ? ALL.filter((t) => selectedTypes.includes(t))
    : ALL;

  yield {
    type: "meta",
    meta: {
      url: normalizedUrl,
      industry: ctx.industry,
      device: ctx.device,
      channels: ctx.channels,
      analyzedPages: order,
      date: new Date().toISOString(),
    },
  };

  yield { type: "progress", step: "Shop wird aufgerufen …", pct: 5 };
  await sleep(500);

  const pages: AnalyzedPage[] = [];
  const stepLabels: Record<PageType, string> = {
    home: "Startseite gerendert · Elemente erkannt",
    plp: "Kategorieseite analysiert",
    pdp: "Produktseite · Mobile + Desktop gerendert",
    cart: "Warenkorb · Artikel hinzugefügt",
    checkout: "Checkout bis zur Zahlungswand gelesen",
  };

  for (let i = 0; i < order.length; i++) {
    const id = order[i]!;
    await sleep(550);
    const page = buildPage(id);
    pages.push(page);
    yield { type: "page", page };
    yield {
      type: "progress",
      step: stepLabels[id],
      pct: Math.round(((i + 1) / (order.length + 1)) * 100),
    };
  }

  await sleep(400);
  yield { type: "progress", step: "Hebel werden bewertet und priorisiert …", pct: 95 };
  yield { type: "overall", overall: overallUplift(pages) };
  yield { type: "progress", step: "Fazit wird erstellt …", pct: 98 };
  yield {
    type: "summary",
    summary: {
      verdict:
        "Über den gesamten Funnel liegen die größten Hebel auf der Produktseite und im Checkout — hier entscheidet sich, ob aus Interesse ein Kauf wird. Mobile ist besonders kritisch, da der Großteil deines Traffics dort landet. Mit gezielten Anpassungen an Kauf-Buttons, Trust-Elementen und Checkout-Reibung lässt sich das Potenzial am schnellsten heben.",
      points: [
        "Produktseite: klarer, durchgängig sichtbarer Kauf-Button — besonders auf dem Smartphone.",
        "Checkout: unnötige Felder und Ablenkungen entfernen, Fortschritt sichtbar machen.",
        "Startseite: Wertversprechen above the fold schärfen statt nur Kategorien zeigen.",
        "Warenkorb: Versandkosten und Lieferzeit früh und transparent ausweisen.",
      ],
    },
  };
  yield { type: "done" };
}

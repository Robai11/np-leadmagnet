/*
 * Sample analysis result for local UI previews (e.g. the /gate-preview route)
 * and tests. Built from the prototype mock data — this is NOT the live pipeline
 * (see src/lib/analysis/run.ts) and is never used to serve a real analysis.
 */

import { PAGES, LEVERS, type MockLever } from "@/lib/mock-data";
import {
  opportunityClass,
  opportunityScore,
  overallUplift,
} from "@/lib/scoring";
import type {
  AnalysisResult,
  AnalyzedPage,
  Lever,
  PageType,
} from "@/lib/types";

const toLever = (m: MockLever): Lever => ({
  id: m.id,
  n: m.n,
  pin: m.pin,
  category: m.category,
  categoryLabel: m.categoryLabel,
  impact: m.impact,
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

export function buildMockResult(): AnalysisResult {
  const ids = ["home", "plp", "pdp", "cart", "checkout"];
  const pages = ids.map(buildPage);
  return {
    meta: {
      url: "https://dein-shop.de",
      industry: "Mode & Accessoires",
      device: 68,
      channels: ["Google Ads", "Meta Ads"],
      analyzedPages: ids,
      date: "2026-06-16T10:00:00.000Z",
    },
    overall: overallUplift(pages),
    pages,
    notes: [],
  };
}

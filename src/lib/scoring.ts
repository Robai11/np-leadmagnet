/*
 * Scoring — Build-Spec §7 (opportunity per page) and §6 (overall uplift).
 *
 * Opportunity = severity of found levers × generic funnel-stage weight (late
 * stages weighted higher). Overall uplift is a CAPPED, diminishing-returns
 * BLEND of the CR levers — never the sum of individual maxima, always framed
 * as a hypothesis. AOV levers are excluded from the CR estimate.
 */

import type { ImpactLevel } from "@/styles/tokens";
import type { AnalyzedPage, Lever, OverallUplift, PageType } from "@/lib/types";

const IMPACT_WEIGHT: Record<ImpactLevel, number> = { high: 3, mid: 2, low: 1 };

// Grobe Defaults (Build-Spec §7) — late funnel stages weighted higher.
const STAGE_WEIGHT: Record<PageType, number> = {
  home: 0.6,
  plp: 0.7,
  pdp: 1.0,
  cart: 1.15,
  checkout: 1.3,
};

/** Raw opportunity score for a page (used for ranking the hero page). */
export function opportunityScore(type: PageType, levers: Lever[]): number {
  const crSeverity = levers
    .filter((l) => l.type === "cr")
    .reduce((sum, l) => sum + IMPACT_WEIGHT[l.impact], 0);
  return crSeverity * (STAGE_WEIGHT[type] ?? 1);
}

/** Map a raw opportunity score to a heat class for the funnel strip. */
export function opportunityClass(score: number): ImpactLevel {
  if (score >= 6) return "high";
  if (score >= 2.5) return "mid";
  return "low";
}

// Geringer Aufwand ⇒ höhere Priorität (leicht umsetzbar zuerst).
const EFFORT_EASE: Record<ImpactLevel, number> = { low: 3, mid: 2, high: 1 };

/**
 * Priorität eines Hebels: Umsatz-Effekt zählt zehnfach (dominiert), der
 * Änderungsaufwand bricht Gleichstände (geringer Aufwand zuerst).
 */
export function priorityScore(l: Lever): number {
  return IMPACT_WEIGHT[l.impact] * 10 + EFFORT_EASE[l.effort ?? "mid"];
}

/** Quick Win = hoher Umsatz-Effekt bei geringem Aufwand. */
export function isQuickWin(l: Lever): boolean {
  return l.impact === "high" && l.effort === "low";
}

/** Hebel nach Priorität sortieren und 1..n durchnummerieren (für die Anzeige). */
export function prioritize(levers: Lever[]): Lever[] {
  return [...levers]
    .sort((a, b) => priorityScore(b) - priorityScore(a))
    .map((l, i) => ({ ...l, n: i + 1 }));
}

/** Rank pages by opportunity, highest first — the first is the teaser hero. */
export function rankPages(pages: AnalyzedPage[]): AnalyzedPage[] {
  return [...pages].sort(
    (a, b) =>
      opportunityScore(b.type, b.levers) - opportunityScore(a.type, a.levers),
  );
}

const CAP_HIGH = 30; // hard ceiling for the high estimate (pp)
const CAP_LOW = 20; // hard ceiling for the low estimate (pp)
const DECAY = 0.85; // diminishing returns across stacked levers

/**
 * Capped, diminishing-returns blend of the CR levers across all pages.
 * NOT a sum (Build-Spec §6). Sorted by midpoint so the strongest levers carry
 * the most weight; each subsequent lever contributes less (overlap dampening).
 */
export function overallUplift(pages: AnalyzedPage[]): OverallUplift {
  const cr = pages
    .flatMap((p) => p.levers)
    .filter((l) => l.type === "cr")
    .sort(
      (a, b) =>
        b.range[0] + b.range[1] - (a.range[0] + a.range[1]),
    );

  let low = 0;
  let high = 0;
  cr.forEach((l, i) => {
    const w = Math.pow(DECAY, i);
    low += l.range[0] * w;
    high += l.range[1] * w;
  });

  low = Math.min(Math.round(low), CAP_LOW);
  high = Math.min(Math.round(high), CAP_HIGH);
  if (high < low) high = low;

  return {
    low,
    high,
    note: "Hypothese · konservativ geblendet, gedeckelt, keine Summe der Einzelwerte.",
  };
}

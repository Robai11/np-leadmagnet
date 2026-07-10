/*
 * Hebel-Rubric — Build-Spec §5/§6.
 *
 * Impact class and range band are properties of the lever *type*, fixed here —
 * NOT invented per run. The model only detects presence and severity; severity
 * then selects the impact tier, and the tier maps to a benchmark range band.
 * v1 uses generic benchmark ranges (Build-Spec §7); later these get calibrated
 * from real test history.
 *
 * Ranges are CR uplift in percentage points [low, high]. The crosssell category
 * is an AOV lever (Build-Spec §5.6) — it carries no CR range and must never be
 * mixed into CR estimates.
 */

import type { ImpactLevel } from "@/styles/tokens";
import type { LeverCategory } from "@/lib/taxonomy";
import type { LeverType } from "@/lib/types";

type Bands = Record<ImpactLevel, [number, number]>;

const RUBRIC: Record<LeverCategory, Bands> = {
  cta: { high: [0.8, 2.1], mid: [0.4, 1.0], low: [0.2, 0.5] },
  price: { high: [1.0, 2.4], mid: [0.4, 1.1], low: [0.2, 0.5] },
  trust: { high: [0.8, 1.8], mid: [0.5, 1.3], low: [0.2, 0.7] },
  product: { high: [0.7, 1.6], mid: [0.4, 1.0], low: [0.2, 0.5] },
  atf: { high: [0.7, 1.6], mid: [0.4, 1.0], low: [0.2, 0.6] },
  // crosssell is AOV — no CR range (Build-Spec §6: keep AOV out of CR ranges).
  crosssell: { high: [0, 0], mid: [0, 0], low: [0, 0] },
  friction: { high: [1.2, 3.0], mid: [0.5, 1.6], low: [0.3, 0.8] },
  tech: { high: [0.5, 1.5], mid: [0.3, 0.8], low: [0.1, 0.4] },
};

// Typischer Umsetzungsaufwand je Kategorie (Fallback, wenn die KI keinen
// Aufwand liefert). Copy/Sichtbarkeit/Platzierung = gering; Layout/Content/
// Flow = mittel; technische Themen = hoch.
const EFFORT_BY_CATEGORY: Record<LeverCategory, ImpactLevel> = {
  cta: "low",
  trust: "low",
  atf: "low",
  price: "mid",
  product: "mid",
  crosssell: "mid",
  friction: "mid",
  tech: "high",
};

/** Änderungsaufwand-Fallback für eine Kategorie. */
export const effortForCategory = (category: LeverCategory): ImpactLevel =>
  EFFORT_BY_CATEGORY[category];

export const isAovCategory = (category: LeverCategory): boolean =>
  category === "crosssell";

export const leverTypeFor = (category: LeverCategory): LeverType =>
  isAovCategory(category) ? "aov" : "cr";

/** The benchmark range band for a (category, severity) pair. */
export function rangeFor(
  category: LeverCategory,
  impact: ImpactLevel,
): [number, number] {
  return RUBRIC[category][impact];
}

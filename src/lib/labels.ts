import type { ImpactLevel } from "@/styles/tokens";

export const IMPACT_LABELS: Record<ImpactLevel, string> = {
  high: "Hoch",
  mid: "Mittel",
  low: "Niedrig",
};

/** Änderungsaufwand-Labels (low = wenig Aufwand). */
export const EFFORT_LABELS: Record<ImpactLevel, string> = {
  high: "Hoch",
  mid: "Mittel",
  low: "Gering",
};

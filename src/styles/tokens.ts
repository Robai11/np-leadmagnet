/*
 * Typed accessors for the brand tokens defined in tokens.css.
 *
 * Use these in inline `style` props so JSX never contains a raw hex or font
 * name either (Token-Vertrag, Build-Spec §2.1). Every value is a `var(--…)`
 * reference — the real values live only in tokens.css.
 */

export const token = {
  ink: "var(--color-ink)",
  ink2: "var(--color-ink-2)",
  paper: "var(--color-paper)",
  paper2: "var(--color-paper-2)",
  line: "var(--color-line)",
  lineInk: "var(--color-line-ink)",
  text: "var(--color-text)",
  textMute: "var(--color-text-mute)",
  textInk: "var(--color-text-ink)",
  textInkMute: "var(--color-text-ink-mute)",
  accent: "var(--color-accent)",
  accentDeep: "var(--color-accent-deep)",
  impactHigh: "var(--color-impact-high)",
  impactMid: "var(--color-impact-mid)",
  impactLow: "var(--color-impact-low)",
  fontDisplay: "var(--font-display)",
  fontBody: "var(--font-body)",
  fontMono: "var(--font-mono)",
  radius: "var(--radius)",
  radiusLg: "var(--radius-lg)",
  radiusPill: "var(--radius-pill)",
  shadowCard: "var(--shadow-card)",
} as const;

/** Impact-level → its CSS custom-property reference. */
export type ImpactLevel = "high" | "mid" | "low";
export const impactVar = (impact: ImpactLevel): string =>
  `var(--color-impact-${impact})`;

/** Opportunity uses the same heat scale as impact. */
export type OpportunityLevel = ImpactLevel;
export const opportunityVar = impactVar;

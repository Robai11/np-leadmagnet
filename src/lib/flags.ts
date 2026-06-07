/*
 * Feature flags shared by server + client.
 *
 * GATE_ENABLED: when false, the e-mail gate is OFF — every lever is fully
 * visible immediately (no redaction, no teaser, no email field). Flip back to
 * true to restore the teaser → e-mail → unlock flow (Build-Spec §9/§10).
 */
export const GATE_ENABLED = false;

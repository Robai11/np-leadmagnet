/*
 * Feature flags shared by server + client.
 *
 * GATE_ENABLED: server-side redaction gate (Build-Spec §9/§10). When false, the
 * full report — every lever with prose — is streamed to the client immediately.
 * When true, locked lever prose is redacted server-side until /api/unlock.
 *
 * LEAD_GATE_ENABLED: the client-side lead gate on the report. The full report is
 * shown for a few seconds (peek), then blurs and a lead form appears
 * ("Jetzt Schwachstellen ansehen"). After the lead is captured the report is
 * revealed with the landing-style curtain effect. This gate is cosmetic — the
 * report data already lives in the client (see GATE_ENABLED=false) — and is a
 * lead-capture mechanism, not a hard server gate.
 */
export const GATE_ENABLED = false;

export const LEAD_GATE_ENABLED = true;

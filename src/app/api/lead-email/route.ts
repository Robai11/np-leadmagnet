/*
 * Früh-Lead-Erfassung auf dem Warte-Screen (LoadingStage): Während die Analyse
 * läuft, kann der Nutzer seine E-Mail hinterlassen, um den fertigen Report per
 * Mail zu bekommen. Anders als /api/lead (voller Gate-Datensatz mit Name +
 * Telefon + Business-Mail) reicht hier die E-Mail; die restlichen Felder kommen
 * aus dem Analyse-Kontext. Gespeichert wird wie ein normaler Lead (leadSink →
 * Store + optional Resend), Name/Telefon bleiben leer.
 */

import type { NextRequest } from "next/server";
import { isValidEmail } from "@/lib/email";
import { leadSink, type Lead } from "@/lib/lead-sink";

export const runtime = "nodejs";

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "bad_body" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const email = str(b.email);
  if (!isValidEmail(email)) {
    return Response.json(
      { ok: false, error: "invalid_email" },
      { status: 400 },
    );
  }

  const lead: Lead = {
    email,
    url: str(b.url),
    industry: str(b.industry),
    device: typeof b.device === "number" ? b.device : 0,
    channels: Array.isArray(b.channels)
      ? b.channels.filter((c): c is string => typeof c === "string")
      : [],
    capturedAt: new Date().toISOString(),
  };

  try {
    await leadSink.capture(lead);
  } catch (e) {
    console.error(
      "[lead-email] capture failed:",
      e instanceof Error ? e.message : e,
    );
    return Response.json({ ok: false, error: "store_failed" }, { status: 500 });
  }
  return Response.json({ ok: true });
}

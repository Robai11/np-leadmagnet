/*
 * Früh-Lead-Erfassung auf dem Warte-Screen (LoadingStage): Während die Analyse
 * läuft, hinterlässt der Nutzer E-Mail + DSGVO-Einwilligung, um den fertigen
 * Report per Mail zu bekommen. Anders als /api/lead (voller Gate-Datensatz mit
 * Name + Telefon + Business-Mail) reicht hier die E-Mail; die restlichen Felder
 * kommen aus dem Analyse-Kontext.
 *
 * Ablauf:
 *  1) Lead speichern (leadSink → Store + interne Benachrichtigung), inkl. Einwilligung.
 *  2) Mail-Wunsch unter dem Token (= trackId der Analyse) merken.
 *  3) Ist der Report schon fertig (Nutzer wartete bis zum Ende), sofort zustellen;
 *     sonst stellt der Analyse-Abschluss (/api/analyze) zu. Einmal-garantiert.
 */

import type { NextRequest } from "next/server";
import { isValidEmail } from "@/lib/email";
import { leadSink, type Lead } from "@/lib/lead-sink";
import { saveReportRequest } from "@/lib/report-store";
import { originFrom, deliverReport } from "@/lib/report-deliver";

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
    return Response.json({ ok: false, error: "invalid_email" }, { status: 400 });
  }
  // DSGVO: ohne ausdrückliche Einwilligung keine Verarbeitung/Zusendung.
  if (b.consent !== true) {
    return Response.json({ ok: false, error: "consent_required" }, {
      status: 400,
    });
  }

  const url = str(b.url);
  const consentAt = new Date().toISOString();

  const lead: Lead = {
    email,
    url,
    industry: str(b.industry),
    device: typeof b.device === "number" ? b.device : 0,
    channels: Array.isArray(b.channels)
      ? b.channels.filter((c): c is string => typeof c === "string")
      : [],
    capturedAt: consentAt,
    consentAt,
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

  // Mail-Wunsch merken + ggf. sofort zustellen (falls Report schon fertig).
  const token = str(b.trackId);
  if (token) {
    try {
      await saveReportRequest(token, { email, url, consentAt });
      await deliverReport(token, originFrom(req.headers));
    } catch (e) {
      console.error(
        "[lead-email] report request/deliver failed:",
        e instanceof Error ? e.message : e,
      );
      // Lead ist gespeichert — Zustellung ist best-effort, kein harter Fehler.
    }
  }

  return Response.json({ ok: true });
}

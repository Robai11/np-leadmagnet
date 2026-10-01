/*
 * Zustell-Logik für die Report-Mail. Wird von ZWEI Stellen aufgerufen:
 *  1) /api/analyze — sobald die Analyse (serverseitig) fertig ist,
 *  2) /api/lead-email — beim E-Mail-Submit (falls der Report schon fertig ist).
 * Beide Wege rufen deliverReport(); die Einmal-Sperre (claimReportSend) stellt
 * sicher, dass die Mail trotzdem nur einmal rausgeht — egal wer zuerst dran ist.
 */

import {
  getReport,
  getReportRequest,
  claimReportSend,
} from "@/lib/report-store";
import { sendReportEmail } from "@/lib/report-mail";

/** Öffentliche Basis-URL aus den Request-Headern (für den Link in der Mail). */
export function originFrom(headers: Headers): string {
  const envBase = process.env.REPORT_BASE_URL || process.env.NEXT_PUBLIC_BASE_URL;
  const proto = headers.get("x-forwarded-proto") || "https";
  const host = headers.get("x-forwarded-host") || headers.get("host");
  if (host) return `${proto}://${host}`;
  return envBase ? envBase.replace(/\/+$/, "") : "";
}

/**
 * Report-Mail zustellen, wenn (a) ein Mail-Wunsch vorliegt und (b) der Report
 * fertig gespeichert ist. Einmal-garantiert über claimReportSend().
 */
export async function deliverReport(
  tok: string,
  origin: string,
): Promise<void> {
  if (!tok) return;
  const req = await getReportRequest(tok);
  if (!req?.email) return; // kein Mail-Wunsch → nichts tun
  const report = await getReport(tok);
  if (!report) return; // Analyse noch nicht fertig → später erneut
  const claimed = await claimReportSend(tok);
  if (!claimed) return; // schon verschickt
  const link = origin ? `${origin}/r/${tok}` : `/r/${tok}`;
  const ok = await sendReportEmail(req.email, link, req.url || report.meta.url);
  if (!ok) {
    console.error("[report-deliver] Versand fehlgeschlagen für Token", tok);
  }
}

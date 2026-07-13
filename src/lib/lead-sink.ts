/*
 * Lead sink — offene Schnittstelle (Build-Spec §9).
 *
 * Prod (Vercel): Leads sind PII → NICHT in den öffentlichen Blob. Wenn
 * RESEND_API_KEY + LEAD_NOTIFY_TO gesetzt sind, wird pro Lead eine private
 * E-Mail verschickt (dauerhaft + sofortige Benachrichtigung). Sonst (lokal/Dev)
 * Append in .data/leads.jsonl. Ein echtes CRM (HubSpot o.ä.) lässt sich später
 * durch eine weitere LeadSink-Implementierung ergänzen.
 */

import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

export interface Lead {
  email: string;
  /** Contact details from the report lead gate (optional for the legacy unlock). */
  firstName?: string;
  lastName?: string;
  phone?: string;
  url: string;
  industry: string;
  device: number;
  channels: string[];
  /** ISO-8601 timestamp, supplied by the caller. */
  capturedAt: string;
}

export interface LeadSink {
  capture(lead: Lead): Promise<void>;
}

function esc(s: string): string {
  return s.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!,
  );
}

function leadHtml(lead: Lead): string {
  const row = (label: string, value: string) =>
    `<tr><td style="padding:4px 12px 4px 0;color:#5a6677">${label}</td><td style="padding:4px 0;font-weight:600">${esc(value)}</td></tr>`;
  return `
    <div style="font-family:sans-serif;color:#092737">
      <h2 style="margin:0 0 12px">Neuer ConversionScan-Lead</h2>
      <table style="border-collapse:collapse;font-size:14px">
        ${row("Name", `${lead.firstName ?? ""} ${lead.lastName ?? ""}`.trim() || "—")}
        ${row("E-Mail", lead.email)}
        ${row("Telefon", lead.phone || "—")}
        ${row("Shop-URL", lead.url)}
        ${row("Branche", lead.industry)}
        ${row("Mobile-Anteil", `${lead.device}%`)}
        ${row("Kanäle", lead.channels.join(", "))}
        ${row("Erfasst", lead.capturedAt)}
      </table>
    </div>`;
}

/** Prod: private E-Mail-Benachrichtigung pro Lead über die Resend-API (fetch, kein SDK). */
class EmailLeadSink implements LeadSink {
  async capture(lead: Lead): Promise<void> {
    console.log("[lead]", JSON.stringify(lead));
    const key = process.env.RESEND_API_KEY;
    const to = process.env.LEAD_NOTIFY_TO;
    const from =
      process.env.LEAD_NOTIFY_FROM || "ConversionScan <onboarding@resend.dev>";
    if (!key || !to) return;
    try {
      const name = `${lead.firstName ?? ""} ${lead.lastName ?? ""}`.trim();
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          authorization: `Bearer ${key}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: to.split(",").map((s) => s.trim()),
          reply_to: lead.email,
          subject: `Neuer Lead: ${name || lead.email} · ${lead.url}`,
          html: leadHtml(lead),
        }),
      });
      if (!res.ok) {
        console.error(
          "[lead] resend failed",
          res.status,
          await res.text().catch(() => ""),
        );
      }
    } catch (err) {
      // Lead-Zustellung darf den Reveal-Flow nie brechen.
      console.error("[lead] resend error", err);
    }
  }
}

/** Dev/lokal: Append in .data/leads.jsonl (auf Serverless flüchtig — nur Dev). */
class LocalLeadSink implements LeadSink {
  async capture(lead: Lead): Promise<void> {
    console.log("[lead]", JSON.stringify(lead));
    try {
      const dir = join(process.cwd(), ".data");
      await mkdir(dir, { recursive: true });
      await appendFile(join(dir, "leads.jsonl"), JSON.stringify(lead) + "\n");
    } catch (err) {
      console.error("[lead] local persist failed", err);
    }
  }
}

/** E-Mail-Sink, sobald Resend konfiguriert ist; sonst lokaler Datei-Append (Dev). */
export const leadSink: LeadSink = process.env.RESEND_API_KEY
  ? new EmailLeadSink()
  : new LocalLeadSink();

/*
 * Lead sink — offene Schnittstelle (Build-Spec §9).
 *
 * Ein erfasster Lead wird:
 *  1) dauerhaft in den privaten Store geschrieben (leads-store.ts → Redis/KV),
 *     damit er im geschützten /admin-Bereich sichtbar ist;
 *  2) optional per E-Mail (Resend) sofort zugestellt, wenn RESEND_API_KEY +
 *     LEAD_NOTIFY_TO gesetzt sind;
 *  3) immer ins Server-Log geschrieben (Fallback / Nachvollziehbarkeit).
 * Keiner dieser Schritte darf den Reveal-Flow brechen (alles best-effort).
 */

import { saveLead } from "@/lib/leads-store";

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

/** Optionale sofortige E-Mail-Benachrichtigung über die Resend-API (fetch, kein SDK). */
async function emailLead(lead: Lead): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.LEAD_NOTIFY_TO;
  if (!key || !to) return;
  const from =
    process.env.LEAD_NOTIFY_FROM || "ConversionScan <onboarding@resend.dev>";
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
    console.error("[lead] resend error", err);
  }
}

class DefaultLeadSink implements LeadSink {
  async capture(lead: Lead): Promise<void> {
    console.log("[lead]", JSON.stringify(lead));
    try {
      await saveLead(lead);
    } catch (err) {
      console.error("[lead] store persist failed", err);
    }
    await emailLead(lead);
  }
}

export const leadSink: LeadSink = new DefaultLeadSink();

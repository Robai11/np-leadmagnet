/*
 * Kundenseitige Report-Mail (Resend). Wird verschickt, sobald die Analyse
 * fertig ist und der Nutzer vorher seine E-Mail hinterlassen hat. Enthält einen
 * Link zum fertigen Online-Report (/r/<token>). Getrennt von der INTERNEN
 * Lead-Benachrichtigung in lead-sink.ts (die weiterhin an das Team geht).
 *
 * Nötige Env-Variablen (sonst wird nur geloggt, kein harter Fehler):
 *   RESEND_API_KEY        — API-Key von Resend
 *   REPORT_MAIL_FROM      — verifizierte Absenderadresse (z. B. "ConversionScan
 *                           <report@netzproduzenten.de>"); Fallback: LEAD_NOTIFY_FROM
 */

function esc(s: string): string {
  return s.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!,
  );
}

function reportHtml(link: string, shopUrl: string): string {
  const safeLink = esc(link);
  const safeShop = esc(shopUrl);
  return `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#092737;max-width:560px;margin:0 auto;padding:8px">
    <h1 style="font-size:22px;margin:0 0 14px">Dein ConversionScan-Report ist fertig</h1>
    <p style="font-size:15px;line-height:1.55;margin:0 0 10px">
      wir haben <strong>${safeShop}</strong> analysiert und die wichtigsten
      Optimierungen für mehr Umsatz zusammengestellt — priorisiert nach
      Umsatz-Effekt und Änderungsaufwand.
    </p>
    <p style="margin:22px 0">
      <a href="${safeLink}" style="display:inline-block;background:#3dc091;color:#06241a;font-weight:700;font-size:16px;text-decoration:none;padding:13px 26px;border-radius:10px">
        Report ansehen
      </a>
    </p>
    <p style="font-size:13px;line-height:1.5;color:#5a6677;margin:0 0 4px">
      Falls der Button nicht funktioniert, kopiere diesen Link in deinen Browser:
    </p>
    <p style="font-size:13px;line-height:1.5;margin:0 0 20px">
      <a href="${safeLink}" style="color:#34a87f">${safeLink}</a>
    </p>
    <p style="font-size:12px;line-height:1.5;color:#8090a3;margin:0">
      Du bekommst diese Mail, weil du auf ConversionScan eine Analyse für
      ${safeShop} gestartet und um Zusendung des Reports gebeten hast.
    </p>
  </div>`;
}

/** Report-Link per Mail zustellen. true = verschickt, false = nicht konfiguriert/Fehler. */
export async function sendReportEmail(
  to: string,
  link: string,
  shopUrl: string,
): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn("[report-mail] RESEND_API_KEY fehlt — Mail nicht verschickt.");
    return false;
  }
  const from =
    process.env.REPORT_MAIL_FROM ||
    process.env.LEAD_NOTIFY_FROM ||
    "ConversionScan <onboarding@resend.dev>";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: `Dein ConversionScan-Report für ${shopUrl} ist fertig`,
        html: reportHtml(link, shopUrl),
      }),
    });
    if (!res.ok) {
      console.error(
        "[report-mail] resend failed",
        res.status,
        await res.text().catch(() => ""),
      );
      return false;
    }
    return true;
  } catch (err) {
    console.error("[report-mail] resend error", err);
    return false;
  }
}

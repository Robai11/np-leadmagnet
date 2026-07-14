/*
 * Geschützter Lead-Bereich (/admin). Zugriff via Basic-Auth (src/middleware.ts,
 * ADMIN_USER/ADMIN_PASSWORD). Zeigt alle erfassten Leads aus dem privaten
 * Store (leads-store.ts) als Tabelle, neueste zuerst, mit CSV-Export.
 */

import { listLeads, hasLeadStore } from "@/lib/leads-store";
import { LeadsCsv } from "./LeadsCsv";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata = {
  title: "Leads — ConversionScan",
};

function fmtDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("de-DE", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 14px",
  fontSize: 11,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  color: "#5a6677",
  borderBottom: "1px solid #e1e4ea",
  whiteSpace: "nowrap",
};
const td: React.CSSProperties = {
  padding: "10px 14px",
  fontSize: 14,
  borderTop: "1px solid #eef2f8",
  verticalAlign: "top",
  color: "#092737",
};

export default async function AdminPage() {
  const leads = await listLeads();
  const configured = hasLeadStore();

  return (
    <main
      style={{
        maxWidth: 1100,
        margin: "0 auto",
        padding: "40px 24px 80px",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        color: "#092737",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>
          Leads{" "}
          <span style={{ color: "#5a6677", fontWeight: 500 }}>
            ({leads.length})
          </span>
        </h1>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <LeadsCsv leads={leads} />
          <a
            href="/api/admin/logout"
            style={{
              fontSize: 13,
              color: "#5a6677",
              textDecoration: "none",
              padding: "9px 12px",
            }}
          >
            Abmelden
          </a>
        </div>
      </div>

      {!configured && (
        <p
          style={{
            padding: "12px 16px",
            borderRadius: 8,
            background: "#fff7ed",
            border: "1px solid #fed7aa",
            color: "#9a3412",
            fontSize: 14,
          }}
        >
          ⚠️ Kein Lead-Store konfiguriert — es fehlen die Env-Variablen
          <code> KV_REST_API_URL</code> / <code>KV_REST_API_TOKEN</code>. Bis
          dahin werden Leads nur ins Server-Log geschrieben, nicht hier
          angezeigt.
        </p>
      )}

      {leads.length === 0 ? (
        <p style={{ color: "#5a6677", fontSize: 15 }}>
          Noch keine Leads erfasst.
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr>
                <th style={th}>Erfasst</th>
                <th style={th}>Name</th>
                <th style={th}>E-Mail</th>
                <th style={th}>Telefon</th>
                <th style={th}>Shop</th>
                <th style={th}>Branche</th>
                <th style={th}>Mobile</th>
                <th style={th}>Kanäle</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l, i) => (
                <tr key={`${l.email}-${l.capturedAt}-${i}`}>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>
                    {fmtDate(l.capturedAt)}
                  </td>
                  <td style={td}>
                    {`${l.firstName ?? ""} ${l.lastName ?? ""}`.trim() || "—"}
                  </td>
                  <td style={td}>
                    <a href={`mailto:${l.email}`} style={{ color: "#0b6" }}>
                      {l.email}
                    </a>
                  </td>
                  <td style={td}>{l.phone || "—"}</td>
                  <td style={td}>{l.url}</td>
                  <td style={td}>{l.industry}</td>
                  <td style={td}>{l.device}%</td>
                  <td style={td}>{l.channels.join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

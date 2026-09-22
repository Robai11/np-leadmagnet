/*
 * Geschützter URL-Log (/admin/urls). Chronologische Liste aller gestarteten
 * Analysen (unabhängig von Leads) aus analyzed-urls-store.ts, neueste zuerst,
 * mit CSV-Export. Zugriff wie /admin (Session-Cookie via src/proxy.ts).
 */

import {
  listAnalyzedUrls,
  hasUrlStore,
  type AnalyzedUrlEntry,
} from "@/lib/analyzed-urls-store";
import { UrlsCsv } from "./UrlsCsv";
import { AdminTabs } from "../AdminTabs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata = {
  title: "Analysierte URLs — ConversionScan",
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

const navLink: React.CSSProperties = {
  fontSize: 13,
  color: "#5a6677",
  textDecoration: "none",
  padding: "9px 12px",
};

function audience(e: AnalyzedUrlEntry): string {
  return [e.audienceAge, e.audienceGender].filter(Boolean).join(" · ") || "—";
}

export default async function AnalyzedUrlsPage() {
  const configured = hasUrlStore();
  let entries: AnalyzedUrlEntry[] = [];
  let loadError: string | null = null;
  if (configured) {
    try {
      entries = await listAnalyzedUrls();
    } catch (e) {
      loadError = e instanceof Error ? e.message : String(e);
    }
  }

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
      <AdminTabs active="urls" />

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
          Analysierte URLs{" "}
          <span style={{ color: "#5a6677", fontWeight: 500 }}>
            ({entries.length})
          </span>
        </h1>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <UrlsCsv entries={entries} />
          <a href="/api/admin/logout" style={navLink}>
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
          ⚠️ Kein Store konfiguriert — es fehlen die Env-Variablen
          <code> KV_REST_API_URL</code> / <code>KV_REST_API_TOKEN</code>.
        </p>
      )}

      {configured && loadError && (
        <div
          style={{
            padding: "14px 16px",
            borderRadius: 8,
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#991b1b",
            fontSize: 14,
            marginBottom: 20,
          }}
        >
          <strong>⚠️ Store nicht erreichbar.</strong>
          <br />
          <code style={{ fontSize: 12, opacity: 0.85 }}>{loadError}</code>
        </div>
      )}

      {entries.length === 0 && !loadError ? (
        <p style={{ color: "#5a6677", fontSize: 15 }}>
          Noch keine Analysen erfasst.
        </p>
      ) : entries.length === 0 ? null : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr>
                <th style={th}>Zeitpunkt</th>
                <th style={th}>Shop-URL</th>
                <th style={th}>Branche</th>
                <th style={th}>Mobile</th>
                <th style={th}>Kanäle</th>
                <th style={th}>Zielgruppe</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr key={`${e.url}-${e.at}-${i}`}>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>
                    {fmtDate(e.at)}
                  </td>
                  <td style={td}>{e.url}</td>
                  <td style={td}>{e.industry ?? "—"}</td>
                  <td style={td}>
                    {typeof e.device === "number" ? `${e.device}%` : "—"}
                  </td>
                  <td style={td}>{e.channels?.join(", ") || "—"}</td>
                  <td style={td}>{audience(e)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

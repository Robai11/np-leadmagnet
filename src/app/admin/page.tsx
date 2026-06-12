/*
 * Internal admin view: which shop URLs were analyzed.
 *
 * Server component — reads the append-only analysis log directly and renders it.
 * Local/dev tool: no auth (runs on the operator's machine). `force-dynamic` so
 * it always reflects the latest log rather than a build-time snapshot.
 */

import Link from "next/link";
import { readAnalysisLog, type AnalysisLogEntry } from "@/lib/analysis/log";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Analyse-Protokoll — ConversionScan",
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

function isHttp(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

const cell: React.CSSProperties = {
  padding: "10px 14px",
  borderTop: "1px solid #f3f4f6",
  fontSize: 14,
  verticalAlign: "middle",
};

export default async function AdminPage() {
  const entries: AnalysisLogEntry[] = await readAnalysisLog();

  return (
    <main
      style={{
        maxWidth: 820,
        margin: "0 auto",
        padding: "40px 24px 80px",
        fontFamily:
          "var(--font-hanken), -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        color: "#111827",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 6 }}>
        <h1 style={{ fontSize: 26, margin: 0 }}>Analyse-Protokoll</h1>
        <Link href="/" style={{ fontSize: 14, color: "#2563eb" }}>
          ← zur Startseite
        </Link>
      </div>
      <p style={{ color: "#6b7280", fontSize: 14, marginTop: 0 }}>
        {entries.length === 0
          ? "Noch keine Analysen protokolliert."
          : `${entries.length} Analyse${entries.length === 1 ? "" : "n"} · neueste zuerst`}
      </p>

      {entries.length === 0 ? (
        <div
          style={{
            border: "1px dashed #d1d5db",
            borderRadius: 12,
            padding: 28,
            textAlign: "center",
            color: "#6b7280",
            marginTop: 20,
          }}
        >
          Starte eine Analyse auf der{" "}
          <Link href="/" style={{ color: "#2563eb" }}>
            Startseite
          </Link>
          . Jede analysierte Shop-URL wird hier aufgelistet.
        </div>
      ) : (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            marginTop: 18,
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            overflow: "hidden",
            background: "#fff",
          }}
        >
          <thead>
            <tr style={{ background: "#f9fafb", textAlign: "left" }}>
              <th style={{ ...cell, borderTop: "none", color: "#6b7280", fontWeight: 600, width: 190 }}>
                Datum
              </th>
              <th style={{ ...cell, borderTop: "none", color: "#6b7280", fontWeight: 600 }}>
                Shop-URL
              </th>
              <th style={{ ...cell, borderTop: "none", color: "#6b7280", fontWeight: 600, width: 130 }}>
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e, i) => (
              <tr key={i}>
                <td style={{ ...cell, color: "#6b7280", whiteSpace: "nowrap" }}>{fmtDate(e.date)}</td>
                <td style={{ ...cell, wordBreak: "break-all" }}>
                  {isHttp(e.shopUrl) ? (
                    <a href={e.shopUrl} target="_blank" rel="noreferrer" style={{ color: "#2563eb" }}>
                      {e.shopUrl}
                    </a>
                  ) : (
                    e.shopUrl
                  )}
                </td>
                <td style={cell}>
                  <span
                    style={{
                      fontSize: 12.5,
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: 999,
                      background: e.ok ? "#dcfce7" : "#fee2e2",
                      color: e.ok ? "#166534" : "#991b1b",
                    }}
                  >
                    {e.ok ? "✓ analysiert" : "⚠ fehlgeschlagen"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}

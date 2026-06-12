/*
 * Internal admin view: which URLs were analyzed.
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

const PAGE_LABEL: Record<string, string> = {
  home: "Startseite",
  plp: "Produktlisting",
  pdp: "Produktseite",
  cart: "Warenkorb",
  checkout: "Checkout",
};

const OPP_COLOR: Record<string, string> = {
  high: "#dc2626",
  medium: "#d97706",
  low: "#16a34a",
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

function fmtDuration(ms: number): string {
  if (!ms || ms < 0) return "—";
  const s = Math.round(ms / 1000);
  if (s < 90) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function isHttp(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

function Entry({ e }: { e: AnalysisLogEntry }) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: "16px 18px",
        marginBottom: 14,
        background: "#fff",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "baseline",
          gap: 12,
          marginBottom: 10,
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            padding: "2px 8px",
            borderRadius: 999,
            background: e.ok ? "#dcfce7" : "#fee2e2",
            color: e.ok ? "#166534" : "#991b1b",
          }}
        >
          {e.ok ? "✓ analysiert" : "⚠ fehlgeschlagen"}
        </span>
        <strong style={{ fontSize: 16 }}>
          {isHttp(e.shopUrl) ? (
            <a
              href={e.shopUrl}
              target="_blank"
              rel="noreferrer"
              style={{ color: "#111827", textDecoration: "none" }}
            >
              {e.shopUrl}
            </a>
          ) : (
            e.shopUrl
          )}
        </strong>
        <span style={{ color: "#6b7280", fontSize: 13 }}>{fmtDate(e.date)}</span>
        <span style={{ color: "#6b7280", fontSize: 13 }}>
          · {e.device}% Mobil / {100 - e.device}% Desktop
        </span>
        <span style={{ color: "#6b7280", fontSize: 13 }}>· {fmtDuration(e.durationMs)}</span>
        {e.industry ? (
          <span style={{ color: "#6b7280", fontSize: 13 }}>· {e.industry}</span>
        ) : null}
      </div>

      {e.pages.length > 0 ? (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <tbody>
            {e.pages.map((p, i) => (
              <tr key={i} style={{ borderTop: i ? "1px solid #f3f4f6" : "none" }}>
                <td style={{ padding: "6px 10px 6px 0", whiteSpace: "nowrap", verticalAlign: "top" }}>
                  <span
                    style={{
                      display: "inline-block",
                      width: 9,
                      height: 9,
                      borderRadius: 999,
                      marginRight: 7,
                      background: OPP_COLOR[p.opportunity ?? ""] ?? "#9ca3af",
                    }}
                  />
                  <span style={{ fontWeight: 600 }}>
                    {PAGE_LABEL[p.type] ?? p.type}
                  </span>
                </td>
                <td
                  style={{
                    padding: "6px 0",
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                    fontSize: 12.5,
                    wordBreak: "break-all",
                  }}
                >
                  {p.url && isHttp(p.url) ? (
                    <a href={p.url} target="_blank" rel="noreferrer" style={{ color: "#2563eb" }}>
                      {p.url}
                    </a>
                  ) : (
                    <span style={{ color: "#9ca3af" }}>{p.url || "—"}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p style={{ color: "#9ca3af", fontSize: 14, margin: "4px 0" }}>
          Keine Seite analysiert.
        </p>
      )}

      {e.notes.length > 0 ? (
        <ul
          style={{
            margin: "10px 0 0",
            padding: "10px 0 0",
            borderTop: "1px solid #f3f4f6",
            listStyle: "none",
            color: "#6b7280",
            fontSize: 12.5,
          }}
        >
          {e.notes.map((n, i) => (
            <li key={i} style={{ marginBottom: 3 }}>
              · {n}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default async function AdminPage() {
  const entries = await readAnalysisLog();

  return (
    <main
      style={{
        maxWidth: 920,
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
          : `${entries.length} Analyse${entries.length === 1 ? "" : "n"} · neueste zuerst · zeigt die tatsächlich analysierten Seiten-URLs`}
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
          . Jede Analyse wird hier mit ihren URLs aufgelistet.
        </div>
      ) : (
        <div style={{ marginTop: 20 }}>
          {entries.map((e, i) => (
            <Entry key={i} e={e} />
          ))}
        </div>
      )}
    </main>
  );
}

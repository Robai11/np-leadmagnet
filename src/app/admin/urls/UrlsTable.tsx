"use client";

/*
 * Interaktive Tabelle des URL-Logs. Pro Zeile: Zeitpunkt + Shop-URL. Sobald der
 * Nutzer den Wizard durchlaufen hat und Kontext vorliegt, zeigt die Zeile ein
 * grünes „Kontext"-Badge; ein Klick klappt die Zeile nach unten auf und zeigt
 * die Kontext-Details. Zeilen ohne Kontext bleiben zugeklappt (grau „—").
 */

import { Fragment, useState } from "react";
import type { AnalyzedUrlEntry } from "@/lib/analyzed-urls-store";

const GREEN = "#3dc091";
const NAVY = "#092737";

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

/** Kontext gilt als vorhanden, sobald irgendein Kontextfeld gesetzt ist. */
function hasContext(e: AnalyzedUrlEntry): boolean {
  return Boolean(
    e.industry ||
      (e.channels && e.channels.length > 0) ||
      e.audienceAge ||
      e.audienceGender ||
      e.audienceTraits ||
      e.challenges,
  );
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
  verticalAlign: "middle",
  color: NAVY,
};

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
      <span
        style={{
          flex: "0 0 130px",
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          color: "#5a6677",
          fontWeight: 700,
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 14, color: NAVY, whiteSpace: "pre-wrap" }}>
        {value}
      </span>
    </div>
  );
}

function ContextDetails({ e }: { e: AnalyzedUrlEntry }) {
  const rows: { label: string; value: string }[] = [];
  if (e.industry) rows.push({ label: "Branche", value: e.industry });
  if (typeof e.device === "number")
    rows.push({
      label: "Traffic-Split",
      value: `${e.device} % mobil · ${100 - e.device} % Desktop`,
    });
  if (e.channels && e.channels.length > 0)
    rows.push({ label: "Kanäle", value: e.channels.join(", ") });
  if (e.audienceAge) rows.push({ label: "Alter", value: e.audienceAge });
  if (e.audienceGender)
    rows.push({ label: "Geschlecht", value: e.audienceGender });
  if (e.audienceTraits)
    rows.push({ label: "Merkmale", value: e.audienceTraits });
  if (e.challenges)
    rows.push({ label: "Herausforderungen", value: e.challenges });

  return (
    <div
      style={{
        background: "#f6fbf9",
        border: `1px solid ${GREEN}33`,
        borderRadius: 10,
        padding: "14px 16px",
        margin: "2px 0 6px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {rows.map((r) => (
        <DetailRow key={r.label} label={r.label} value={r.value} />
      ))}
    </div>
  );
}

function ContextBadge({ open }: { open: boolean }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 10px",
        borderRadius: 999,
        background: `${GREEN}1f`,
        color: "#1f7a5c",
        fontSize: 12,
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: GREEN,
          display: "inline-block",
        }}
      />
      Kontext
      <span
        style={{
          fontSize: 10,
          transform: open ? "rotate(180deg)" : "none",
          transition: "transform 0.15s",
          opacity: 0.7,
        }}
      >
        ▾
      </span>
    </span>
  );
}

export function UrlsTable({ entries }: { entries: AnalyzedUrlEntry[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th style={th}>Zeitpunkt</th>
            <th style={th}>Shop-URL</th>
            <th style={{ ...th, textAlign: "right" }}>Kontext</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e, i) => {
            const ctx = hasContext(e);
            const rowId = e.id || `${e.url}-${e.at}-${i}`;
            const isOpen = ctx && openId === rowId;
            return (
              <Fragment key={rowId}>
                <tr
                  onClick={
                    ctx ? () => setOpenId(isOpen ? null : rowId) : undefined
                  }
                  style={{
                    cursor: ctx ? "pointer" : "default",
                    background: isOpen ? "#f6fbf9" : undefined,
                  }}
                >
                  <td style={{ ...td, whiteSpace: "nowrap" }}>
                    {fmtDate(e.at)}
                  </td>
                  <td style={{ ...td, wordBreak: "break-all" }}>{e.url}</td>
                  <td style={{ ...td, textAlign: "right" }}>
                    {ctx ? (
                      <ContextBadge open={Boolean(isOpen)} />
                    ) : (
                      <span style={{ color: "#c2cad6" }}>—</span>
                    )}
                  </td>
                </tr>
                {isOpen && (
                  <tr>
                    <td
                      colSpan={3}
                      style={{ padding: "0 14px", background: "#f6fbf9" }}
                    >
                      <ContextDetails e={e} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

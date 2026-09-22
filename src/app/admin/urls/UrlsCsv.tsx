"use client";

import type { AnalyzedUrlEntry } from "@/lib/analyzed-urls-store";

const COLS: { key: keyof AnalyzedUrlEntry; label: string }[] = [
  { key: "at", label: "Zeitpunkt" },
  { key: "url", label: "Shop-URL" },
];

function cell(v: unknown): string {
  const s = Array.isArray(v) ? v.join("; ") : v == null ? "" : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

export function UrlsCsv({ entries }: { entries: AnalyzedUrlEntry[] }) {
  const download = () => {
    const header = COLS.map((c) => c.label).join(",");
    const rows = entries.map((e) =>
      COLS.map((c) => cell(e[c.key])).join(","),
    );
    // BOM voranstellen, damit Excel Umlaute korrekt liest.
    const blob = new Blob(["﻿" + [header, ...rows].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "conversionscan-analysierte-urls.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <button
      type="button"
      onClick={download}
      disabled={entries.length === 0}
      style={{
        padding: "9px 16px",
        borderRadius: 8,
        border: "1px solid #d5dbe6",
        background: entries.length === 0 ? "#f1f4f9" : "#092737",
        color: entries.length === 0 ? "#98a4b5" : "#fff",
        fontWeight: 700,
        fontSize: 14,
        cursor: entries.length === 0 ? "default" : "pointer",
      }}
    >
      CSV exportieren ({entries.length})
    </button>
  );
}

"use client";

import type { Lead } from "@/lib/lead-sink";

const COLS: { key: keyof Lead; label: string }[] = [
  { key: "capturedAt", label: "Erfasst" },
  { key: "firstName", label: "Vorname" },
  { key: "lastName", label: "Nachname" },
  { key: "email", label: "E-Mail" },
  { key: "phone", label: "Telefon" },
  { key: "url", label: "Shop-URL" },
  { key: "industry", label: "Branche" },
  { key: "device", label: "Mobile %" },
  { key: "channels", label: "Kanäle" },
];

function cell(v: unknown): string {
  const s = Array.isArray(v) ? v.join("; ") : v == null ? "" : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

export function LeadsCsv({ leads }: { leads: Lead[] }) {
  const download = () => {
    const header = COLS.map((c) => c.label).join(",");
    const rows = leads.map((l) => COLS.map((c) => cell(l[c.key])).join(","));
    // BOM voranstellen, damit Excel Umlaute korrekt liest.
    const blob = new Blob(["﻿" + [header, ...rows].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "conversionscan-leads.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <button
      type="button"
      onClick={download}
      disabled={leads.length === 0}
      style={{
        padding: "9px 16px",
        borderRadius: 8,
        border: "1px solid #d5dbe6",
        background: leads.length === 0 ? "#f1f4f9" : "#092737",
        color: leads.length === 0 ? "#98a4b5" : "#fff",
        fontWeight: 700,
        fontSize: 14,
        cursor: leads.length === 0 ? "default" : "pointer",
      }}
    >
      CSV exportieren ({leads.length})
    </button>
  );
}

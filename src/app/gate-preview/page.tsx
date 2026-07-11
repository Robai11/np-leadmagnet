"use client";

/*
 * /gate-preview — local-only preview of the report lead gate, so the gate can
 * be iterated on without running a (paid) analysis. Renders ReportStage on a
 * mock report. The Startseite tab is free; other tabs blur their content and
 * show the lead form in place. Lead capture is stubbed here (no /api/lead
 * write). Each control bumps the mount key, which re-locks the report. Dev-only.
 */

import { useMemo, useState } from "react";
import { notFound } from "next/navigation";
import { ReportStage, FAZIT_TAB } from "@/components/ReportStage";
import { Topbar } from "@/components/Topbar";
import { buildMockResult } from "@/lib/mock-result";

export default function GatePreviewPage() {
  const result = useMemo(() => buildMockResult(), []);
  const [replay, setReplay] = useState(0);
  const [initial, setInitial] = useState<string>(FAZIT_TAB);

  if (process.env.NODE_ENV === "production") notFound();

  const show = (id: string) => {
    setInitial(id);
    setReplay((n) => n + 1);
  };

  return (
    <div className="cs-root cs-root--preview cs-root--report">
      <div className="gate-preview-bar">
        <span className="gpb-title">Gate-Vorschau · Mock-Report</span>
        <button className="gpb-btn" onClick={() => show(FAZIT_TAB)}>
          Fazit-Tab
        </button>
        <button className="gpb-btn" onClick={() => show("pdp")}>
          Gesperrter Tab
        </button>
        <button className="gpb-btn" onClick={() => show("home")}>
          Startseite (frei)
        </button>
        <button className="gpb-btn" onClick={() => setReplay((n) => n + 1)}>
          Neu sperren
        </button>
        <span className="gpb-hint">
          Tabs sind klickbar. Reveal: Formular ausfüllen &amp; absenden —
          Vorschau speichert keinen Lead.
        </span>
      </div>

      <Topbar />

      <ReportStage
        key={replay}
        result={result}
        unlocked
        initialSelected={initial}
        onUnlock={async () => true}
        onLead={async () => ({ ok: true })}
      />
    </div>
  );
}

"use client";

/*
 * /gate-preview — local-only preview of the report lead gate, so the gate can
 * be iterated on without running a (paid) analysis. Renders ReportStage on a
 * mock report; the control bar replays the gate instantly or with the real
 * 8 s peek. Lead capture is stubbed here (no /api/lead write). Dev-only.
 */

import { useMemo, useState } from "react";
import { notFound } from "next/navigation";
import { ReportStage } from "@/components/ReportStage";
import { buildMockResult } from "@/lib/mock-result";

export default function GatePreviewPage() {
  const result = useMemo(() => buildMockResult(), []);
  const [replay, setReplay] = useState(0);
  const [peekMs, setPeekMs] = useState(0);

  if (process.env.NODE_ENV === "production") notFound();

  const play = (ms: number) => {
    setPeekMs(ms);
    setReplay((n) => n + 1);
  };

  return (
    <div className="cs-root cs-root--preview">
      <div className="gate-preview-bar">
        <span className="gpb-title">Gate-Vorschau · Mock-Report</span>
        <button className="gpb-btn" onClick={() => play(0)}>
          Gate sofort
        </button>
        <button className="gpb-btn" onClick={() => play(8000)}>
          Mit 8 s Peek
        </button>
        <span className="gpb-hint">
          Reveal: Formular ausfüllen &amp; absenden — Vorschau speichert keinen
          Lead.
        </span>
      </div>

      <ReportStage
        key={replay}
        result={result}
        unlocked
        peekMs={peekMs}
        onUnlock={async () => true}
        onLead={async () => ({ ok: true })}
      />
    </div>
  );
}

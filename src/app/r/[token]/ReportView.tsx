"use client";

/*
 * Client-Hülle für die per Mail verschickte Report-Seite. Rendert den
 * vollständigen (freigeschalteten) Report in derselben App-Optik wie im Funnel.
 */

import { Topbar } from "@/components/Topbar";
import { ReportStage } from "@/components/ReportStage";
import type { AnalysisResult } from "@/lib/types";

export function ReportView({ result }: { result: AnalysisResult }) {
  return (
    <div className="cs-root cs-root--report">
      <Topbar />
      <ReportStage result={result} unlocked onUnlock={async () => true} />
    </div>
  );
}

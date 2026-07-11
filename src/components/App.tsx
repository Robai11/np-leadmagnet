"use client";

import { useMemo, useState } from "react";
import type {
  AnalysisContext,
  AnalysisResult,
  AnalyzedPage,
  Lever,
} from "@/lib/types";
import { useAnalysis } from "@/lib/useAnalysis";
import { useReturnNudge } from "@/lib/useReturnNudge";
import { GATE_ENABLED } from "@/lib/flags";
import { InputStage } from "@/components/InputStage";
import { LoadingStage } from "@/components/LoadingStage";
import { ReportStage } from "@/components/ReportStage";

/** Splice the single full teaser lever back into the redacted pages. */
function injectTeaser(
  pages: AnalyzedPage[],
  teaser: { pageId: string; lever: Lever } | null,
): AnalyzedPage[] {
  if (!teaser) return pages;
  return pages.map((p) =>
    p.id === teaser.pageId
      ? {
          ...p,
          levers: p.levers.map((l) =>
            l.id === teaser.lever.id ? teaser.lever : l,
          ),
        }
      : p,
  );
}

export function App() {
  const { state, start, reset } = useAnalysis();
  const [ctx, setCtx] = useState<AnalysisContext | null>(null);
  const [full, setFull] = useState<AnalysisResult | null>(null);

  // Rückhol-Signal (Chime + Hintergrund-Tab-Titel) an die echte Stream-
  // Transition gekoppelt: `done`, sobald der Stream fertig ist. Hier auf App-
  // Ebene, weil die LoadingStage beim Abschluss gegen die ReportStage getauscht
  // (unmountet) wird — App bleibt durchgehend gemountet.
  const { arm, muted, toggleMuted } = useReturnNudge(state.status === "done");

  // Gate OFF → always "unlocked" (every lever visible, no email field).
  const unlocked = !GATE_ENABLED || full !== null;

  const onStart = (c: AnalysisContext) => {
    arm(); // Audio innerhalb der Nutzergeste „scharf machen" (Autoplay-Policy)
    setCtx(c);
    setFull(null);
    start(c);
  };

  const restart = () => {
    reset();
    setCtx(null);
    setFull(null);
  };

  // Unlock: fetch the server-held full report (and capture the lead).
  const unlock = async (email: string): Promise<boolean> => {
    if (!state.meta) return false;
    try {
      const res = await fetch("/api/unlock", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, url: state.meta.url }),
      });
      const data = await res.json();
      if (res.ok && data.ok && data.result) {
        setFull(data.result as AnalysisResult);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const ready =
    state.status === "done" && state.meta !== null && state.overall !== null;

  const result: AnalysisResult | null = useMemo(() => {
    if (!ready || !state.meta || !state.overall) return null;
    if (full) return full;
    return {
      meta: state.meta,
      overall: state.overall,
      pages: injectTeaser(state.pages, state.teaser),
      notes: state.notes,
      summary: state.summary ?? undefined,
    };
  }, [
    ready,
    full,
    state.meta,
    state.overall,
    state.pages,
    state.teaser,
    state.notes,
    state.summary,
  ]);

  return (
    <div className={`cs-root ${ready ? "cs-root--report" : ""}`}>
      <header className="topbar">
        <div className="brand">
          {/* eslint-disable-next-line @next/next/no-img-element -- statisches SVG-Markenlogo; next/image bringt für SVG keinen Vorteil */}
          <img
            className="brand-logo"
            src="/brand/netzproduzenten-logo-weiss.svg"
            alt="Netzproduzenten"
          />
          <span className="brand-sep" aria-hidden="true" />
          ConversionScan
        </div>
        {(ready || state.status === "error") && (
          <button className="restart" onClick={restart}>
            Neue Analyse
          </button>
        )}
      </header>

      {state.status === "idle" && <InputStage onStart={onStart} />}

      {state.status === "running" && ctx && (
        <LoadingStage
          ctx={ctx}
          analyzedIds={state.pages.map((p) => p.id)}
          selectedIds={
            ctx.targets?.some((t) => t.selected)
              ? ctx.targets.filter((t) => t.selected).map((t) => t.type)
              : null
          }
          progressPct={state.progress.pct}
          done={false}
          muted={muted}
          onToggleMuted={toggleMuted}
        />
      )}

      {ready && ctx && result && (
        <ReportStage result={result} unlocked={unlocked} onUnlock={unlock} />
      )}

      {state.status === "error" && (
        <div className="stage">
          <div className="load-card">
            <span className="kicker">Fehler</span>
            <h2>Analyse fehlgeschlagen</h2>
            <p style={{ marginTop: 12 }}>
              {state.error ?? "Unbekannter Fehler."}
            </p>
            <button className="cta" style={{ marginTop: 20 }} onClick={restart}>
              Erneut versuchen
            </button>
          </div>
        </div>
      )}

      <footer className="foot">
        Analyse über streamende API · gesperrte Hebel serverseitig bis zur
        Freischaltung
      </footer>
    </div>
  );
}

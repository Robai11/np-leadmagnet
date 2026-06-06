"use client";

import { useMemo, useState } from "react";
import type {
  AnalysisContext,
  AnalysisResult,
  AnalyzedPage,
  Lever,
} from "@/lib/types";
import { useAnalysis } from "@/lib/useAnalysis";
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

  const unlocked = full !== null;

  const onStart = (c: AnalysisContext) => {
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
    };
  }, [ready, full, state.meta, state.overall, state.pages, state.teaser, state.notes]);

  return (
    <div className="cs-root">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" />
          CONVERSIONSCAN
          <span className="brand-sub">by deiner Agentur</span>
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

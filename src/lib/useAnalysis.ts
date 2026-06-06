"use client";

import { useCallback, useRef, useState } from "react";
import { parseEvents } from "@/lib/analysis/events";
import type {
  AnalysisContext,
  AnalysisMeta,
  AnalyzedPage,
  Lever,
  OverallUplift,
} from "@/lib/types";

export type AnalysisStatus = "idle" | "running" | "done" | "error";

export interface AnalysisState {
  status: AnalysisStatus;
  progress: { step: string; pct: number };
  meta: AnalysisMeta | null;
  /** Pages with locked lever prose redacted (server-side gate). */
  pages: AnalyzedPage[];
  overall: OverallUplift | null;
  notes: string[];
  /** The single fully-readable teaser lever (Build-Spec §9). */
  teaser: { pageId: string; lever: Lever } | null;
  error: string | null;
}

const initialState: AnalysisState = {
  status: "idle",
  progress: { step: "", pct: 0 },
  meta: null,
  pages: [],
  overall: null,
  notes: [],
  teaser: null,
  error: null,
};

/**
 * Drives the streaming /api/analyze endpoint. The stream emits read-only pages
 * first, stateful pages later (Build-Spec §8); pages accumulate live so the UI
 * can render progressively.
 */
export function useAnalysis() {
  const [state, setState] = useState<AnalysisState>(initialState);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState(initialState);
  }, []);

  const start = useCallback(async (ctx: AnalysisContext) => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setState({ ...initialState, status: "running" });

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(ctx),
        signal: ac.signal,
      });

      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => "");
        const parsed = parseEvents(text).events.find((e) => e.type === "error");
        setState((s) => ({
          ...s,
          status: "error",
          error:
            (parsed && parsed.type === "error" && parsed.message) ||
            "Analyse fehlgeschlagen.",
        }));
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const { events, rest } = parseEvents(buffer);
        buffer = rest;

        for (const e of events) {
          setState((s) => {
            switch (e.type) {
              case "meta":
                return { ...s, meta: e.meta };
              case "progress":
                return { ...s, progress: { step: e.step, pct: e.pct } };
              case "page":
                return { ...s, pages: [...s.pages, e.page] };
              case "note":
                return { ...s, notes: [...s.notes, e.note] };
              case "teaser":
                return { ...s, teaser: { pageId: e.pageId, lever: e.lever } };
              case "overall":
                return { ...s, overall: e.overall };
              case "done":
                return { ...s, status: "done", progress: { step: "", pct: 100 } };
              case "error":
                return { ...s, status: "error", error: e.message };
              default:
                return s;
            }
          });
        }
      }
    } catch (err) {
      if (ac.signal.aborted) return;
      setState((s) => ({
        ...s,
        status: "error",
        error: err instanceof Error ? err.message : "Netzwerkfehler.",
      }));
    }
  }, []);

  return { state, start, reset };
}

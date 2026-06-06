/*
 * Streaming protocol between the analysis pipeline and the client.
 *
 * The pipeline is an async generator of AnalysisEvent. The route serializes
 * each event as one NDJSON line; the client hook parses them and assembles the
 * AnalysisResult incrementally — read-only pages first, stateful pages later
 * (Build-Spec §8). This contract is identical for the mock (M2) and the real
 * browser + Vision pipeline (M3/M4).
 */

import type {
  AnalysisMeta,
  AnalyzedPage,
  Lever,
  OverallUplift,
} from "@/lib/types";

export type AnalysisEvent =
  | { type: "meta"; meta: AnalysisMeta }
  | { type: "progress"; step: string; pct: number }
  | { type: "page"; page: AnalyzedPage }
  | { type: "note"; note: string }
  | { type: "overall"; overall: OverallUplift }
  // The single fully-readable teaser lever (Build-Spec §9). Sent after the
  // hero page is known; all other lever prose stays server-side until unlock.
  | { type: "teaser"; pageId: string; lever: Lever }
  | { type: "done" }
  | { type: "error"; message: string };

export function encodeEvent(event: AnalysisEvent): string {
  return JSON.stringify(event) + "\n";
}

/** Parse a buffer of NDJSON, returning complete events + the trailing remainder. */
export function parseEvents(buffer: string): {
  events: AnalysisEvent[];
  rest: string;
} {
  const lines = buffer.split("\n");
  const rest = lines.pop() ?? "";
  const events: AnalysisEvent[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      events.push(JSON.parse(trimmed) as AnalysisEvent);
    } catch {
      // Ignore malformed partials; they'll arrive complete next chunk.
    }
  }
  return { events, rest };
}

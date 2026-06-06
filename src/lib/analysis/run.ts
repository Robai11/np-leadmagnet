/*
 * Pipeline dispatcher. Chooses the analysis implementation.
 *
 * Real browser + Vision pipeline when configured (Browserbase + Anthropic);
 * otherwise the mock pipeline, so the app always runs locally without keys.
 * The real pipeline (and its heavy browser deps) is loaded via dynamic import
 * only when keys are present — the mock path never bundles Playwright.
 */

import type { AnalysisContext } from "@/lib/types";
import type { AnalysisEvent } from "@/lib/analysis/events";
import { runMockAnalysis } from "@/lib/analysis/mock";
import { hasRealPipeline } from "@/lib/analysis/config";

export async function* runAnalysis(
  ctx: AnalysisContext,
  normalizedUrl: string,
): AsyncGenerator<AnalysisEvent> {
  if (hasRealPipeline()) {
    const { runRealAnalysis } = await import("@/lib/analysis/real");
    yield* runRealAnalysis(ctx, normalizedUrl);
  } else {
    yield* runMockAnalysis(ctx, normalizedUrl);
  }
}

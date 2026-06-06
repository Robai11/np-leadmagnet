/*
 * Analysis cache, keyed by normalized URL (Build-Spec §1 "Schutz").
 *
 * v1 is an in-memory TTL map — per-instance only. On Vercel each serverless
 * instance has its own copy, which is acceptable for a lead magnet (a cache
 * miss just re-runs the analysis). A durable shared cache (KV/Redis) is the
 * obvious upgrade; the interface here stays the same.
 */

import type { AnalysisResult } from "@/lib/types";

const TTL_MS = 1000 * 60 * 60 * 24; // 24h

interface Entry {
  result: AnalysisResult;
  expires: number;
}

// Survive dev hot-reloads by stashing on globalThis.
const store: Map<string, Entry> = ((
  globalThis as { __csCache?: Map<string, Entry> }
).__csCache ??= new Map());

export function getCached(key: string): AnalysisResult | null {
  const e = store.get(key);
  if (!e) return null;
  if (Date.now() > e.expires) {
    store.delete(key);
    return null;
  }
  return e.result;
}

export function setCached(key: string, result: AnalysisResult): void {
  store.set(key, { result, expires: Date.now() + TTL_MS });
}

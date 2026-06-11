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

// Bump whenever the analysis pipeline changes in a way that should invalidate
// previously-cached results (new reachability logic, consent handling, etc.).
// The version is part of the key, so old entries are simply never read again.
const PIPELINE_VERSION = "2025-06-r3";

interface Entry {
  result: AnalysisResult;
  expires: number;
}

// Survive dev hot-reloads by stashing on globalThis.
const store: Map<string, Entry> = ((
  globalThis as { __csCache?: Map<string, Entry> }
).__csCache ??= new Map());

const vkey = (key: string) => `${PIPELINE_VERSION}::${key}`;

export function getCached(key: string): AnalysisResult | null {
  // In development always run fresh — otherwise a stale result (which survives
  // hot-reloads on globalThis) would mask code changes while iterating.
  if (process.env.NODE_ENV !== "production") return null;
  const e = store.get(vkey(key));
  if (!e) return null;
  if (Date.now() > e.expires) {
    store.delete(vkey(key));
    return null;
  }
  return e.result;
}

export function setCached(key: string, result: AnalysisResult): void {
  store.set(vkey(key), { result, expires: Date.now() + TTL_MS });
}

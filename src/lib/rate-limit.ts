/*
 * Per-IP rate limiting (Build-Spec §1/§8 — "Pflicht, nicht Kür").
 *
 * v1 is an in-memory fixed-window counter, per serverless instance. Good enough
 * to blunt abuse of an expensive endpoint; a shared store (KV/Redis) is the
 * production upgrade. The interface stays the same.
 */

const WINDOW_MS = 1000 * 60 * 60; // 1h window
const MAX_PER_WINDOW = Number(process.env.RATE_LIMIT_MAX) || 5; // analyses per IP per window

// Bypass the limiter entirely for local development (`next dev` sets
// NODE_ENV="development") and via an explicit escape hatch. This unblocks
// rapid manual testing of many shops; production keeps the abuse guard.
const RATE_LIMIT_OFF =
  process.env.NODE_ENV !== "production" ||
  process.env.RATE_LIMIT_DISABLED === "true";

interface Bucket {
  count: number;
  resetAt: number;
}

const store: Map<string, Bucket> = ((
  globalThis as { __csRate?: Map<string, Bucket> }
).__csRate ??= new Map());

export interface RateResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export function checkRateLimit(ip: string): RateResult {
  if (RATE_LIMIT_OFF) {
    return { allowed: true, remaining: MAX_PER_WINDOW, resetAt: 0 };
  }
  const now = Date.now();
  let b = store.get(ip);
  if (!b || now > b.resetAt) {
    b = { count: 0, resetAt: now + WINDOW_MS };
    store.set(ip, b);
  }
  if (b.count >= MAX_PER_WINDOW) {
    return { allowed: false, remaining: 0, resetAt: b.resetAt };
  }
  b.count += 1;
  return {
    allowed: true,
    remaining: MAX_PER_WINDOW - b.count,
    resetAt: b.resetAt,
  };
}

/** Extract a best-effort client IP from request headers. */
export function clientIpFrom(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return headers.get("x-real-ip") ?? "unknown";
}

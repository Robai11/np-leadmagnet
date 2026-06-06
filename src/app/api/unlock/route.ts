/*
 * Unlock endpoint (Build-Spec §10). The full report is held server-side
 * (cache, keyed by normalized URL); this returns it only after a valid email,
 * and captures the lead in the same step. The locked prose never reaches the
 * client before this call.
 */
import type { NextRequest } from "next/server";
import { normalizeUrl } from "@/lib/url";
import { getCached } from "@/lib/cache";
import { leadSink, type Lead } from "@/lib/lead-sink";

const isEmail = (s: unknown): s is string =>
  typeof s === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "bad_body" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  if (!isEmail(b.email)) {
    return Response.json({ ok: false, error: "invalid_email" }, { status: 400 });
  }
  const norm = typeof b.url === "string" ? normalizeUrl(b.url) : null;
  if (!norm) {
    return Response.json({ ok: false, error: "invalid_url" }, { status: 400 });
  }

  const full = getCached(norm.normalized);
  if (!full) {
    // Cache expired between analysis and unlock — ask the client to re-run.
    return Response.json({ ok: false, error: "expired" }, { status: 410 });
  }

  const lead: Lead = {
    email: b.email,
    url: full.meta.url,
    industry: full.meta.industry,
    device: full.meta.device,
    channels: full.meta.channels,
    capturedAt: new Date().toISOString(),
  };
  await leadSink.capture(lead);

  return Response.json({ ok: true, result: full });
}

import type { NextRequest } from "next/server";
import { normalizeUrl } from "@/lib/url";
import { checkRateLimit, clientIpFrom } from "@/lib/rate-limit";
import { getCached, setCached } from "@/lib/cache";
import { runAnalysis } from "@/lib/analysis/run";
import { gateStream, eventsFromResult } from "@/lib/analysis/gate";
import { encodeEvent, type AnalysisEvent } from "@/lib/analysis/events";
import type { AnalysisContext } from "@/lib/types";

const PAGE_TYPES = ["home", "plp", "pdp", "cart", "checkout"];

function isValidContext(b: unknown): b is AnalysisContext {
  if (typeof b !== "object" || b === null) return false;
  const c = b as Record<string, unknown>;
  if (
    typeof c.url !== "string" ||
    typeof c.industry !== "string" ||
    c.industry.length === 0 ||
    typeof c.device !== "number" ||
    !Array.isArray(c.channels) ||
    c.channels.length === 0
  ) {
    return false;
  }
  // targets is optional; when present it must be well-formed.
  if (c.targets !== undefined) {
    if (!Array.isArray(c.targets)) return false;
    const ok = c.targets.every((t) => {
      if (typeof t !== "object" || t === null) return false;
      const tt = t as Record<string, unknown>;
      return (
        typeof tt.type === "string" &&
        PAGE_TYPES.includes(tt.type) &&
        typeof tt.url === "string" &&
        typeof tt.selected === "boolean"
      );
    });
    if (!ok) return false;
  }
  return true;
}

const jsonError = (message: string, status: number) =>
  new Response(encodeEvent({ type: "error", message }), {
    status,
    headers: { "content-type": "application/x-ndjson; charset=utf-8" },
  });

export async function POST(req: NextRequest) {
  const ip = clientIpFrom(req.headers);
  const rl = checkRateLimit(ip);
  if (!rl.allowed) {
    return jsonError(
      "Rate-Limit erreicht. Bitte später erneut versuchen.",
      429,
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Ungültiger Request-Body.", 400);
  }
  if (!isValidContext(body)) {
    return jsonError(
      "URL, Branche und mindestens ein Kanal werden benötigt.",
      400,
    );
  }

  const norm = normalizeUrl(body.url);
  if (!norm) return jsonError("Ungültige Shop-URL.", 400);

  const ctx: AnalysisContext = {
    url: body.url,
    industry: body.industry,
    device: body.device,
    channels: body.channels,
    targets: body.targets,
  };

  const cached = getCached(norm.normalized);
  const enc = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: AnalysisEvent) =>
        controller.enqueue(enc.encode(encodeEvent(e)));

      try {
        // Cached → replay as events; live → run the pipeline. Both flow through
        // the gate, which redacts locked prose and caches the FULL result.
        const source = cached
          ? eventsFromResult(cached)
          : runAnalysis(ctx, norm.normalized);

        for await (const e of gateStream(source, (full) =>
          setCached(norm.normalized, full),
        )) {
          send(e);
        }
      } catch (err) {
        send({
          type: "error",
          message:
            err instanceof Error ? err.message : "Analyse fehlgeschlagen.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
      "x-accel-buffering": "no",
    },
  });
}

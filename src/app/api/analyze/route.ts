import type { NextRequest } from "next/server";
import { waitUntil } from "@vercel/functions";
import { normalizeUrl } from "@/lib/url";
import { checkRateLimit, clientIpFrom } from "@/lib/rate-limit";
import { checkAnalysisQuota } from "@/lib/analysis-guard";
import { getCached, setCached } from "@/lib/cache";
import { enrichAnalyzedUrl } from "@/lib/analyzed-urls-store";
import { saveReport } from "@/lib/report-store";
import { originFrom, deliverReport } from "@/lib/report-deliver";
import { runAnalysis } from "@/lib/analysis/run";
import { gateStream, eventsFromResult } from "@/lib/analysis/gate";
import { encodeEvent, type AnalysisEvent } from "@/lib/analysis/events";
import type { AnalysisContext, AnalysisResult } from "@/lib/types";

// Vollständige Funnel-Analyse (Browserbase + Claude Vision + Checkout-Agent) läuft
// mehrere Minuten. Node-Runtime (kein Edge — braucht Playwright/Stagehand/sharp).
// maxDuration 800 s = Vercel-Pro-Maximum (Hobby deckelt bei 300 s und reicht nicht).
export const runtime = "nodejs";
export const maxDuration = 800;

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
    audienceAge: body.audienceAge,
    audienceGender: body.audienceGender,
    audienceTraits: body.audienceTraits,
    challenges: body.challenges,
  };

  // URL-Log: den beim LP-Klick angelegten Eintrag um den eingegebenen Kontext
  // anreichern. Bewusst awaited (fire-and-forget in Streaming-Routes läuft nicht
  // zuverlässig zu Ende) und fehlertolerant — das Log darf keine Analyse blocken.
  if (typeof body.trackId === "string" && body.trackId.length > 0) {
    try {
      await enrichAnalyzedUrl(body.trackId, {
        url: norm.normalized,
        industry: ctx.industry,
        device: ctx.device,
        channels: ctx.channels,
        audienceAge: ctx.audienceAge,
        audienceGender: ctx.audienceGender,
        audienceTraits: ctx.audienceTraits,
        challenges: ctx.challenges,
      });
    } catch (e) {
      console.error(
        "[analyze] url-log enrich failed:",
        e instanceof Error ? e.message : e,
      );
    }
  }

  const cached = getCached(norm.normalized);

  // Kostenschutz: nur echte (nicht gecachte) Analysen zählen gegen das Limit —
  // Cache-Replays sind gratis und bleiben unbegrenzt.
  if (!cached) {
    const quota = await checkAnalysisQuota(ip);
    if (!quota.allowed) {
      return jsonError(
        quota.reason === "ip"
          ? "Du hast dein Analyse-Limit für heute erreicht. Bitte versuch es morgen wieder — oder melde dich direkt bei uns."
          : "Unser Analyse-Kontingent für heute ist gerade ausgeschöpft. Bitte versuch es später noch einmal.",
        429,
      );
    }
  }

  const enc = new TextEncoder();

  // Für die serverseitige Zustellung: öffentliche Basis-URL + Report-Token
  // (= trackId der Analyse) vor dem Stream festhalten.
  const origin = originFrom(req.headers);
  const reportToken = typeof body.trackId === "string" ? body.trackId : "";

  // Das volle Ergebnis wird beim Abschluss vom Gate geliefert; wir halten es
  // fest, um es NACH dem Stream dauerhaft zu speichern + die Mail zuzustellen.
  let fullResult: AnalysisResult | null = null;
  const onComplete = (full: AnalysisResult) => {
    fullResult = full;
    setCached(norm.normalized, full);
  };

  // Läuft (dank waitUntil) auch zu Ende, wenn der Nutzer die Seite verlässt.
  let resolveDone: () => void = () => {};
  const done = new Promise<void>((r) => {
    resolveDone = r;
  });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // Fehlertolerant: bricht der Client ab, schlägt enqueue fehl — wir fahren
      // trotzdem fort, damit Analyse, Speicherung und Mail serverseitig
      // vollständig durchlaufen.
      const send = (e: AnalysisEvent) => {
        try {
          controller.enqueue(enc.encode(encodeEvent(e)));
        } catch {
          // Client weg — ignorieren, Pipeline läuft weiter.
        }
      };

      try {
        // Cached → replay as events; live → run the pipeline. Both flow through
        // the gate, which redacts locked prose and caches the FULL result.
        const source = cached
          ? eventsFromResult(cached)
          : runAnalysis(ctx, norm.normalized);

        for await (const e of gateStream(source, onComplete)) {
          send(e);
        }
      } catch (err) {
        send({
          type: "error",
          message:
            err instanceof Error ? err.message : "Analyse fehlgeschlagen.",
        });
      } finally {
        try {
          controller.close();
        } catch {
          // bereits geschlossen
        }
        // Report dauerhaft sichern + (falls E-Mail hinterlegt) Mail zustellen.
        // Bewusst awaited und fehlertolerant — darf die Analyse nie brechen.
        try {
          if (fullResult && reportToken) {
            await saveReport(reportToken, fullResult);
            await deliverReport(reportToken, origin);
          }
        } catch (e) {
          console.error(
            "[analyze] report persist/deliver failed:",
            e instanceof Error ? e.message : e,
          );
        }
        resolveDone();
      }
    },
  });

  // Vercel die Instanz am Leben halten, bis die Pipeline (inkl. Speichern +
  // Mail) fertig ist — auch wenn der Browser längst weg ist. Lokal/ohne
  // Vercel-Kontext kein Problem (der Stream läuft ohnehin zu Ende).
  try {
    waitUntil(done);
  } catch {
    // kein Vercel-Kontext (z. B. lokal) — ignorieren
  }

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
      "x-accel-buffering": "no",
    },
  });
}

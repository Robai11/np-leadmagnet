/*
 * POST /api/discover  — auto-discover funnel page URLs for a given shop.
 *
 * Returns { home, plp, pdp, method } so the frontend can pre-fill the
 * per-stage URL inputs without the user having to look them up manually.
 *
 * This is a lightweight read-only flow: no Vision API, just sitemap + nav crawl.
 * Typical wall-clock: 5–15 s depending on sitemap size.
 */

import type { NextRequest } from "next/server";
import { normalizeUrl } from "@/lib/url";
import { withSession } from "@/lib/analysis/browser";
import { discoverPages } from "@/lib/analysis/discovery";
import { hasRealPipeline } from "@/lib/analysis/config";

export const maxDuration = 45; // seconds — discovery can take up to ~15 s on large sitemaps

export async function POST(req: NextRequest) {
  // Need at least a browser provider; Vision key isn't required for discovery.
  if (!hasRealPipeline()) {
    return Response.json(
      { error: "Browser-Pipeline nicht konfiguriert." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  const rawUrl =
    typeof body === "object" && body !== null && "url" in body
      ? String((body as { url: unknown }).url).trim()
      : "";

  if (!rawUrl) {
    return Response.json({ error: "URL fehlt." }, { status: 400 });
  }

  const normalized = normalizeUrl(rawUrl);
  if (!normalized) {
    return Response.json({ error: "Ungültige URL." }, { status: 400 });
  }

  try {
    // Race against a 35 s timeout so slow sitemaps don't block the UI forever.
    const discovered = await Promise.race([
      withSession((browser) => discoverPages(browser, normalized.normalized)),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), 35_000),
      ),
    ]);

    return Response.json({
      home: discovered.home,
      plp: discovered.plp ?? null,
      pdp: discovered.pdp ?? null,
      method: discovered.method,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unbekannter Fehler";
    // Return a soft error so the UI can show a fallback message.
    return Response.json(
      { error: `Seiten konnten nicht erkannt werden: ${msg}` },
      { status: 500 },
    );
  }
}

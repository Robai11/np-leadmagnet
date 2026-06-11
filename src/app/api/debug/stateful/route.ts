import type { NextRequest } from "next/server";
import { withSession } from "@/lib/analysis/browser";
import { runStatefulFlow } from "@/lib/analysis/stateful";
import { runAgentFunnel } from "@/lib/analysis/agentFunnel";
import { hasRealPipeline } from "@/lib/analysis/config";

/**
 * DEV-ONLY debug endpoint. Runs ONLY the stateful add-to-cart → cart → checkout
 * flow against a given PDP and returns which pages were captured (+ notes), with
 * NO Vision analysis — so the cart/checkout reachability can be verified against
 * many real shops quickly and for free, using the REAL compiled pipeline code.
 *
 *   GET /api/_debug/stateful?pdp=<PDP-URL>&device=60
 */
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return Response.json({ error: "not available in production" }, { status: 404 });
  }
  if (!hasRealPipeline()) {
    return Response.json({ error: "Browser-Pipeline nicht konfiguriert." }, { status: 503 });
  }
  const pdp = req.nextUrl.searchParams.get("pdp");
  const device = Number(req.nextUrl.searchParams.get("device") ?? "60");
  const engine = req.nextUrl.searchParams.get("engine") ?? "agent"; // "agent" | "heuristic"
  if (!pdp) return Response.json({ error: "?pdp=<url> fehlt" }, { status: 400 });

  const started = Date.now();
  try {
    const result =
      engine === "heuristic"
        ? await withSession((browser) => runStatefulFlow(browser, pdp, device))
        : await runAgentFunnel(pdp, device);
    return Response.json({
      pdp,
      ms: Date.now() - started,
      pages: result.pages.map((p) => ({
        id: p.id,
        url: p.url,
        reachable: p.reachable,
        elements: p.desktop?.elements?.length ?? 0,
        hasMobile: !!p.mobile,
        mobileElements: p.mobile?.elements?.length ?? 0,
        screenshotKB: p.desktop?.screenshot
          ? Math.round((p.desktop.screenshot as Buffer).length / 1024)
          : 0,
      })),
      notes: result.notes,
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "unbekannt", ms: Date.now() - started },
      { status: 500 },
    );
  }
}

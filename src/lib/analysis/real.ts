/*
 * Real analysis pipeline (M3 + M4), Build-Spec §4/§8.
 *
 *   discover page types
 *     → render read-only pages (home/plp/pdp) in PARALLEL sessions, analyze
 *       each with Vision, stream each page as soon as it's ready
 *     → run the stateful PDP→cart→checkout flow in ONE session, analyze, stream
 *     → score + overall uplift → done
 *
 * Every stage is guarded: a failed page becomes an honest note, never a fabricated
 * finding. Same async-generator signature as the mock pipeline.
 */

import { withSession } from "@/lib/analysis/browser";
import { discoverPages } from "@/lib/analysis/discovery";
import { renderPage } from "@/lib/analysis/render";
import { runStatefulFlow } from "@/lib/analysis/stateful";
import { analyzePageVision } from "@/lib/analysis/vision";
import { persistScreenshot } from "@/lib/analysis/blob";
import { opportunityClass, opportunityScore, overallUplift } from "@/lib/scoring";
import type { AnalysisContext, AnalyzedPage, PageType } from "@/lib/types";
import type { RenderedPage } from "@/lib/analysis/pipeline-types";
import type { AnalysisEvent } from "@/lib/analysis/events";

const PAGE_NAMES: Record<PageType, string> = {
  home: "Startseite",
  plp: "Kategorie",
  pdp: "Produktseite",
  cart: "Warenkorb",
  checkout: "Checkout",
};

async function analyzeRendered(
  rendered: RenderedPage,
  ctx: AnalysisContext,
): Promise<AnalyzedPage> {
  const screenshotUrl = await persistScreenshot(
    rendered.desktop.screenshot,
    rendered.type,
  );
  const levers = await analyzePageVision(rendered, ctx);
  return {
    id: rendered.id,
    type: rendered.type,
    name: rendered.name,
    screenshotUrl,
    viewport: "desktop",
    opportunity: opportunityClass(opportunityScore(rendered.type, levers)),
    levers,
  };
}

/** Render + analyze one read-only page in its own session. */
async function readOnlyPage(
  url: string,
  type: PageType,
  ctx: AnalysisContext,
): Promise<AnalyzedPage> {
  return withSession(async (browser) => {
    const rendered = await renderPage(browser, url, type, PAGE_NAMES[type]);
    return analyzeRendered(rendered, ctx);
  });
}

/** Yield results in completion order as the underlying promises settle. */
async function* asCompleted<T>(
  tasks: Promise<T>[],
): AsyncGenerator<{ index: number; value: T }> {
  const pending = new Map(
    tasks.map((p, i) => [i, p.then((value) => ({ index: i, value }))]),
  );
  while (pending.size) {
    const settled = await Promise.race(pending.values());
    pending.delete(settled.index);
    yield settled;
  }
}

export async function* runRealAnalysis(
  ctx: AnalysisContext,
  normalizedUrl: string,
): AsyncGenerator<AnalysisEvent> {
  const notes: string[] = [];
  const pages: AnalyzedPage[] = [];

  yield { type: "progress", step: "Shop wird aufgerufen …", pct: 5 };

  // ── Discovery ─────────────────────────────────────────────
  const discovered = await withSession((browser) =>
    discoverPages(browser, normalizedUrl),
  ).catch(() => null);

  const home = discovered?.home ?? normalizedUrl;
  const readOnly: { url: string; type: PageType }[] = [{ url: home, type: "home" }];
  if (discovered?.plp) readOnly.push({ url: discovered.plp, type: "plp" });
  if (discovered?.pdp) readOnly.push({ url: discovered.pdp, type: "pdp" });

  const analyzedIds = readOnly.map((r) => r.type);
  if (discovered?.pdp) analyzedIds.push("cart", "checkout");

  yield {
    type: "meta",
    meta: {
      url: normalizedUrl,
      industry: ctx.industry,
      device: ctx.device,
      channels: ctx.channels,
      analyzedPages: analyzedIds,
      date: new Date().toISOString(),
    },
  };
  if (discovered) {
    yield {
      type: "note",
      note: `Seiten ermittelt via ${discovered.method === "sitemap" ? "sitemap.xml" : discovered.method === "nav-fallback" ? "Navigation" : "nur Startseite"}.`,
    };
  }

  // ── Read-only pages in parallel, streamed as they complete ─
  yield { type: "progress", step: "Seiten werden gerendert …", pct: 20 };
  const tasks = readOnly.map((r) =>
    readOnlyPage(r.url, r.type, ctx).catch((err) => {
      notes.push(
        `${PAGE_NAMES[r.type]}: nicht analysierbar (${err instanceof Error ? err.message : "Fehler"}).`,
      );
      return null;
    }),
  );

  let done = 0;
  for await (const { value } of asCompleted(tasks)) {
    done++;
    if (value) {
      pages.push(value);
      yield { type: "page", page: value };
    }
    yield {
      type: "progress",
      step: `${done}/${readOnly.length} Seiten analysiert`,
      pct: 20 + Math.round((done / readOnly.length) * 50),
    };
  }

  // ── Stateful flow (cart, checkout) ────────────────────────
  if (discovered?.pdp) {
    yield { type: "progress", step: "Warenkorb & Checkout …", pct: 75 };
    try {
      const stateful = await withSession((browser) =>
        runStatefulFlow(browser, discovered.pdp!),
      );
      notes.push(...stateful.notes);
      for (const rendered of stateful.pages) {
        try {
          const page = await analyzeRendered(rendered, ctx);
          pages.push(page);
          yield { type: "page", page };
        } catch (err) {
          notes.push(
            `${rendered.name}: Analyse fehlgeschlagen (${err instanceof Error ? err.message : "Fehler"}).`,
          );
        }
      }
    } catch (err) {
      notes.push(
        `Warenkorb/Checkout nicht erreichbar (${err instanceof Error ? err.message : "Fehler"}).`,
      );
    }
  } else {
    notes.push("Keine Produktseite gefunden — Warenkorb & Checkout nicht analysiert.");
  }

  for (const note of notes) yield { type: "note", note };

  // ── Score + finish ────────────────────────────────────────
  yield { type: "progress", step: "Hebel werden bewertet und priorisiert …", pct: 95 };
  if (pages.length === 0) {
    yield { type: "error", message: "Keine Seite konnte analysiert werden." };
    return;
  }
  yield { type: "overall", overall: overallUplift(pages) };
  yield { type: "done" };
}

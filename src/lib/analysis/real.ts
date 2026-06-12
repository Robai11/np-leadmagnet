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
import { runAgentFunnel } from "@/lib/analysis/agentFunnel";
import { analyzePageVision } from "@/lib/analysis/vision";
import { persistScreenshot } from "@/lib/analysis/blob";
import { opportunityClass, opportunityScore, overallUplift } from "@/lib/scoring";
import { appendAnalysisLog } from "@/lib/analysis/log";
import type { AnalysisContext, AnalyzedPage, PageType, Viewport } from "@/lib/types";
import type { RenderedPage } from "@/lib/analysis/pipeline-types";
import type { AnalysisEvent } from "@/lib/analysis/events";

const PAGE_NAMES: Record<PageType, string> = {
  home: "Startseite",
  plp: "Produktlisting-Page",
  pdp: "Produktseite",
  cart: "Warenkorb",
  checkout: "Checkout",
};

async function analyzeRendered(
  rendered: RenderedPage,
  ctx: AnalysisContext,
): Promise<AnalyzedPage> {
  const hasMobile = Boolean(rendered.mobile);

  // Choose the primary view by the device split: mobile-majority → mobile,
  // desktop-majority → desktop, 50/50 → mobile primary + desktop secondary.
  let primaryVp: Viewport;
  let withSecondary = false;
  if (ctx.device > 50 && hasMobile) {
    primaryVp = "mobile";
  } else if (ctx.device === 50 && hasMobile) {
    primaryVp = "mobile";
    withSecondary = true;
  } else {
    primaryVp = "desktop";
  }

  const primaryView = primaryVp === "mobile" ? rendered.mobile! : rendered.desktop;
  const primaryLevers = await analyzePageVision(rendered, ctx, primaryVp);
  const screenshotUrl = await persistScreenshot(
    primaryView.screenshot,
    `${rendered.type}-${primaryVp}`,
  );

  const page: AnalyzedPage = {
    id: rendered.id,
    type: rendered.type,
    name: rendered.name,
    url: rendered.url,
    screenshotUrl,
    viewport: primaryVp,
    opportunity: opportunityClass(opportunityScore(rendered.type, primaryLevers)),
    levers: primaryLevers,
  };

  if (withSecondary) {
    const secLevers = await analyzePageVision(rendered, ctx, "desktop");
    const secShot = await persistScreenshot(
      rendered.desktop.screenshot,
      `${rendered.type}-desktop`,
    );
    page.secondary = {
      viewport: "desktop",
      screenshotUrl: secShot,
      levers: secLevers,
    };
  }

  return page;
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

/**
 * Resolve which pages to analyze: from the user's explicit targets when present,
 * otherwise via auto-discovery from the primary URL (backward-compatible).
 */
async function resolvePlan(
  ctx: AnalysisContext,
  normalizedUrl: string,
): Promise<{
  readOnly: { url: string; type: PageType }[];
  pdpUrl?: string;
  wantCart: boolean;
  wantCheckout: boolean;
  cartUrl?: string;
  checkoutUrl?: string;
  note: string | null;
}> {
  const anySelected = (ctx.targets ?? []).some((t) => t.selected);

  if (anySelected) {
    const selected = (ctx.targets ?? []).filter(
      (t) => t.selected && t.url.trim(),
    );
    const readOnly: { url: string; type: PageType }[] = [];
    let cartUrl: string | undefined;
    let checkoutUrl: string | undefined;
    let wantCart = false;
    let wantCheckout = false;
    for (const t of ctx.targets ?? []) {
      if (!t.selected) continue;
      const url = t.url.trim();
      if (t.type === "home" || t.type === "plp" || t.type === "pdp") {
        if (url) readOnly.push({ url, type: t.type });
      } else if (t.type === "cart") {
        wantCart = true;
        cartUrl = url || undefined;
      } else if (t.type === "checkout") {
        wantCheckout = true;
        checkoutUrl = url || undefined;
      }
    }
    return {
      readOnly,
      pdpUrl: selected.find((t) => t.type === "pdp")?.url.trim(),
      wantCart,
      wantCheckout,
      cartUrl,
      checkoutUrl,
      note: "Seiten gemäß deiner Auswahl analysiert.",
    };
  }

  // Fallback: discover page types from the primary URL.
  const discovered = await withSession((browser) =>
    discoverPages(browser, normalizedUrl),
  ).catch(() => null);
  const home = discovered?.home ?? normalizedUrl;
  const readOnly: { url: string; type: PageType }[] = [{ url: home, type: "home" }];
  if (discovered?.plp) readOnly.push({ url: discovered.plp, type: "plp" });
  if (discovered?.pdp) readOnly.push({ url: discovered.pdp, type: "pdp" });
  return {
    readOnly,
    pdpUrl: discovered?.pdp,
    wantCart: Boolean(discovered?.pdp),
    wantCheckout: Boolean(discovered?.pdp),
    note: discovered
      ? `Seiten ermittelt via ${discovered.method === "sitemap" ? "sitemap.xml" : discovered.method === "nav-fallback" ? "Navigation" : "nur Startseite"}.`
      : null,
  };
}

export async function* runRealAnalysis(
  ctx: AnalysisContext,
  normalizedUrl: string,
): AsyncGenerator<AnalysisEvent> {
  const notes: string[] = [];
  const pages: AnalyzedPage[] = [];
  const startedAt = Date.now();

  yield { type: "progress", step: "Shop wird aufgerufen …", pct: 5 };

  const plan = await resolvePlan(ctx, normalizedUrl);
  const { readOnly, pdpUrl, wantCart, wantCheckout, cartUrl, checkoutUrl } = plan;

  const analyzedIds: string[] = readOnly.map((r) => r.type);
  if (wantCart) analyzedIds.push("cart");
  if (wantCheckout) analyzedIds.push("checkout");

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
  if (plan.note) yield { type: "note", note: plan.note };

  // ── Read-only pages in parallel, streamed as they complete ─
  if (readOnly.length) {
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
  }

  // ── Cart / Checkout ───────────────────────────────────────
  if (wantCart || wantCheckout) {
    if (pdpUrl) {
      // Realistic: drive the product → add-to-cart → cart → checkout flow.
      // Primary path is the AI agent (Stagehand) — it handles ANY shop like a
      // human. If it yields nothing (e.g. agent/transport unavailable), fall
      // back to the heuristic flow so we still try the easy shops.
      yield { type: "progress", step: "Warenkorb & Checkout …", pct: 78 };
      try {
        let stateful = await runAgentFunnel(pdpUrl, ctx.device);
        if (stateful.pages.length === 0) {
          const heuristic = await withSession((browser) =>
            runStatefulFlow(browser, pdpUrl, ctx.device),
          ).catch(() => null);
          if (heuristic && heuristic.pages.length > 0) stateful = heuristic;
        }
        notes.push(...stateful.notes);
        for (const rendered of stateful.pages) {
          if (rendered.type === "cart" && !wantCart) continue;
          if (rendered.type === "checkout" && !wantCheckout) continue;
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
      // No product page → render any directly-provided cart/checkout URLs.
      const direct: { type: PageType; url?: string }[] = [];
      if (wantCart) direct.push({ type: "cart", url: cartUrl });
      if (wantCheckout) direct.push({ type: "checkout", url: checkoutUrl });
      for (const d of direct) {
        if (!d.url) {
          notes.push(
            `${PAGE_NAMES[d.type]}: keine Produktseite und keine eigene URL angegeben — nicht analysiert.`,
          );
          continue;
        }
        try {
          const page = await readOnlyPage(d.url, d.type, ctx);
          pages.push(page);
          yield { type: "page", page };
          if (d.type === "cart") {
            notes.push(
              "Warenkorb direkt über URL gerendert — er kann leer sein, da ohne Produktseite kein Artikel hinzugefügt wurde.",
            );
          }
        } catch (err) {
          notes.push(
            `${PAGE_NAMES[d.type]}: nicht analysierbar (${err instanceof Error ? err.message : "Fehler"}).`,
          );
        }
      }
    }
  }

  for (const note of notes) yield { type: "note", note };

  // ── Score + finish ────────────────────────────────────────
  yield { type: "progress", step: "Hebel werden bewertet und priorisiert …", pct: 95 };

  // Best-effort analysis log (which URLs were analyzed) — for the /admin view.
  // Never blocks or breaks the result.
  await appendAnalysisLog({
    date: new Date().toISOString(),
    shopUrl: ctx.url,
    normalizedUrl,
    industry: ctx.industry,
    device: ctx.device,
    channels: ctx.channels,
    planned: analyzedIds,
    pages: pages.map((p) => ({
      type: p.type,
      name: p.name,
      url: p.url ?? "",
      opportunity: p.opportunity,
    })),
    notes,
    durationMs: Date.now() - startedAt,
    ok: pages.length > 0,
  });

  if (pages.length === 0) {
    yield { type: "error", message: "Keine Seite konnte analysiert werden." };
    return;
  }
  yield { type: "overall", overall: overallUplift(pages) };
  yield { type: "done" };
}

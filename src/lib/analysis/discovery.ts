/*
 * Page-type discovery (Build-Spec §4). Gather candidate URLs from sitemap.xml
 * (incl. sitemap-index children) AND the homepage navigation, then classify:
 *   - PDP: keyword paths (/product/, /produkt/, …) OR a trailing long article id
 *          (e.g. …-889008323) — the common shape for Shopware/Shopify/Magento.
 *   - PLP: keyword paths OR, structurally, a shallow same-origin path that is not
 *          a product and not a CMS/utility page (agb, blog, checkout, …).
 * Always returns at least the homepage.
 */

import type { Browser } from "playwright-core";
import type { DiscoveredUrls } from "@/lib/analysis/pipeline-types";
import { settlePage, evalWithRetry } from "@/lib/analysis/render";

const PDP_HINTS = [/\/produkt\//i, /\/product\//i, /\/p\//i, /\/dp\//i, /-p-?\d+/i, /\/artikel\//i];
const PLP_HINTS = [
  /\/kategorie\//i,
  /\/category\//i,
  /\/categories\//i,
  /\/collections?\//i,
  /\/c\//i,
  /\/shop\//i,
  /\/produkte\//i,
];

// Trailing long numeric id ⇒ almost always a product detail page.
const PDP_ID = /-\d{5,}(?:[/?#]|$)|\/\d{5,}(?:[/?#]|$)/;

// First non-locale path segment that marks a non-listing page.
const CMS_SLUG =
  /^(blog|agb|impressum|datenschutz|kontakt|contact|checkout|cart|warenkorb|wishlist|merkliste|account|konto|login|logout|register|registrieren|search|suche|faq|hilfe|help|widgets|cms|newsletter|versand|zahlung|ueber-uns|about|jobs|karriere|presse|press|sitemap|terms|privacy|agbs|widerruf|retoure|service)$/i;

const LOCALE = /^[a-z]{2}(-[a-z]{2})?$/i;

function sameOrigin(u: string, origin: string): boolean {
  try {
    return new URL(u).origin === origin;
  } catch {
    return false;
  }
}

function isLikelyPdp(u: string): boolean {
  return PDP_HINTS.some((re) => re.test(u)) || PDP_ID.test(u);
}

/** Strip a leading locale segment (/de, /en-us) so depth/CMS checks are fair. */
function contentSegments(pathname: string): string[] {
  const segs = pathname.split("/").filter(Boolean);
  if (segs.length && LOCALE.test(segs[0]!)) return segs.slice(1);
  return segs;
}

/**
 * Pick a category (PLP). Keyword matches win; otherwise the most category-like
 * structural candidate: shallow (1–2 content segments), same origin, not a
 * product, not a CMS/utility page. Prefer depth-2 (e.g. /akkus/akkupacks) over
 * depth-1, then by how often it appears (real categories repeat in nav).
 */
function pickPlp(urls: string[], origin: string): string | undefined {
  const byKeyword = urls.find(
    (u) => sameOrigin(u, origin) && PLP_HINTS.some((re) => re.test(u)),
  );
  if (byKeyword) return byKeyword;

  const score = new Map<string, number>();
  for (const u of urls) {
    if (!sameOrigin(u, origin) || isLikelyPdp(u)) continue;
    let url: URL;
    try {
      url = new URL(u);
    } catch {
      continue;
    }
    const segs = contentSegments(url.pathname);
    if (segs.length < 1 || segs.length > 2) continue;
    if (CMS_SLUG.test(segs[0]!)) continue;
    const key = url.origin + url.pathname.replace(/\/$/, "");
    score.set(key, (score.get(key) ?? 0) + 1);
  }
  if (!score.size) return undefined;
  return [...score.entries()].sort((a, b) => {
    const da = contentSegments(new URL(a[0]).pathname).length;
    const db = contentSegments(new URL(b[0]).pathname).length;
    if (db !== da) return db - da; // prefer deeper (more specific category)
    return b[1] - a[1]; // then more frequent
  })[0]![0];
}

async function fetchText(url: string, ms = 8000): Promise<string | null> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    const res = await fetch(url, {
      signal: ac.signal,
      redirect: "follow",
      headers: {
        // Some shops 403 a default fetch UA.
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function extractLocs(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1]!);
}

/** All page URLs from sitemap.xml, following a sitemap index up to a few children. */
async function sitemapUrls(origin: string): Promise<string[]> {
  for (const path of ["/sitemap.xml", "/sitemap_index.xml"]) {
    const xml = await fetchText(origin + path);
    if (!xml) continue;
    const locs = extractLocs(xml);
    if (!locs.length) continue;

    if (/<sitemapindex/i.test(xml)) {
      const out: string[] = [];
      for (const child of locs.slice(0, 8)) {
        const cx = await fetchText(child);
        if (cx) out.push(...extractLocs(cx));
        if (out.length > 3000) break;
      }
      if (out.length) return out;
    } else {
      return locs;
    }
  }
  return [];
}

/** Homepage anchor hrefs (absolute, http(s)). */
async function navUrls(browser: Browser, homeUrl: string): Promise<string[]> {
  try {
    const ctx = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      locale: "de-DE",
    });
    const page = await ctx.newPage();
    try {
      await page.goto(homeUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await settlePage(page);
      return await evalWithRetry(page, () =>
        [...document.querySelectorAll("a[href]")]
          .map((a) => (a as HTMLAnchorElement).href)
          .filter((h) => h.startsWith("http")),
      );
    } finally {
      await ctx.close().catch(() => {});
    }
  } catch {
    return [];
  }
}

/** Open a category page and look inside it for a product link. */
async function peekForPdp(
  browser: Browser,
  plpUrl: string,
): Promise<string | undefined> {
  try {
    const ctx = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      locale: "de-DE",
    });
    const page = await ctx.newPage();
    try {
      await page.goto(plpUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await settlePage(page);
      const inner = await evalWithRetry(page, () =>
        [...document.querySelectorAll("a[href]")].map(
          (a) => (a as HTMLAnchorElement).href,
        ),
      );
      return inner.find(isLikelyPdp);
    } finally {
      await ctx.close().catch(() => {});
    }
  } catch {
    return undefined;
  }
}

export async function discoverPages(
  browser: Browser,
  homeUrl: string,
): Promise<DiscoveredUrls> {
  const origin = new URL(homeUrl).origin;

  const candidates = new Set<string>();
  const fromSitemap = await sitemapUrls(origin);
  fromSitemap.forEach((u) => candidates.add(u));
  const fromNav = await navUrls(browser, homeUrl);
  fromNav.forEach((u) => candidates.add(u));

  const all = [...candidates];
  let pdp = all.find((u) => sameOrigin(u, origin) && isLikelyPdp(u));
  const plp = pickPlp(all, origin);

  // Category found but no product yet → peek inside the category.
  if (plp && !pdp) {
    pdp = await peekForPdp(browser, plp);
  }

  const method: DiscoveredUrls["method"] =
    pdp || plp
      ? fromSitemap.length
        ? "sitemap"
        : "nav-fallback"
      : "home-only";

  return { home: homeUrl, plp, pdp, method };
}

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
import { settlePage, evalWithRetry, dismissConsent } from "@/lib/analysis/render";
import { SHOP_UA } from "@/lib/analysis/browser";

const PDP_HINTS = [
  /\/produkt\//i,
  /\/product\//i,
  /\/p\//i,
  /\/dp\//i,
  /-p-?\d+/i,
  /\/artikel\//i,
  /\/detail\//i,       // Shopware: /detail/SW100123
  /\/item\//i,
  /\/goods\//i,
  /\/sw-number\//i,
];
const PLP_HINTS = [
  /\/kategorie\//i,
  /\/category\//i,
  /\/categories\//i,
  /\/collections?\//i,
  /\/c\//i,
  /\/shop\//i,
  /\/produkte\//i,
  /\/sortiment\//i,
  /\/angebote\//i,
  /\/sale\//i,
];

// Trailing numeric id (4+ digits) ⇒ almost always a product detail page.
// Matches before /, ?, #, ., or end-of-string to also handle /slug-12345.html.
const PDP_ID = /-\d{4,}(?:[/?#.]|$)|\/\d{4,}(?:[/?#.]|$)/;

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

/**
 * A looser "same shop" test that survives redirect-based domain changes like
 * janvanderstorm.com → www.janvanderstorm.de (different TLD) or
 * shop.example.de → www.shop.example.de (www prefix).
 *
 * Strategy: strip common prefixes (www.) and compare root hostnames; if the
 * root of either is a suffix of the other (e.g. "janvanderstorm") they're
 * treated as the same shop. Falls back to strict origin equality.
 */
function sameShop(u: string, homeOrigin: string, discoveredOrigins: Set<string>): boolean {
  try {
    const uOrigin = new URL(u).origin;
    if (uOrigin === homeOrigin) return true;
    // Accept any origin that appeared in the sitemap / navigation (the site
    // owner controls those URLs, so they're all the same shop).
    if (discoveredOrigins.has(uOrigin)) return true;
    // Strip www. and compare root hostnames as a last resort.
    const strip = (host: string) =>
      host.replace(/^www\./, "").replace(/^[a-z0-9-]+\./, ""); // strip one subdomain
    const uRoot = strip(new URL(u).hostname);
    const hRoot = strip(new URL(homeOrigin).hostname);
    return uRoot.length > 4 && (uRoot === hRoot || uRoot.includes(hRoot) || hRoot.includes(uRoot));
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
 * Pick a category (PLP) from a pre-filtered list of same-shop URLs.
 * Keyword matches win; otherwise the most category-like structural candidate:
 * shallow (1–3 content segments), not a product, not a CMS/utility page.
 * Prefer depth-2 (e.g. /akkus/akkupacks) over depth-1, then by frequency.
 *
 * NOTE: the input `urls` is already pre-filtered to same-shop — no origin check
 * needed here (which also avoids false negatives for redirect-changed domains).
 */
function pickPlp(urls: string[]): string | undefined {
  const byKeyword = urls.find(
    (u) => PLP_HINTS.some((re) => re.test(u)),
  );
  if (byKeyword) return byKeyword;

  const score = new Map<string, number>();
  for (const u of urls) {
    if (isLikelyPdp(u)) continue;
    let url: URL;
    try {
      url = new URL(u);
    } catch {
      continue;
    }
    const segs = contentSegments(url.pathname);
    // Allow 1–3 segments — many German shops nest categories two levels deep
    // (e.g. /akkus/akkupacks/ or /elektrowerkzeuge/bohrschrauber/).
    if (segs.length < 1 || segs.length > 3) continue;
    if (CMS_SLUG.test(segs[0]!)) continue;
    const key = url.origin + url.pathname.replace(/\/$/, "");
    score.set(key, (score.get(key) ?? 0) + 1);
  }
  if (!score.size) return undefined;
  return [...score.entries()].sort((a, b) => {
    const da = contentSegments(new URL(a[0]).pathname).length;
    const db = contentSegments(new URL(b[0]).pathname).length;
    // Prefer depth-2, then depth-1, then depth-3; ties broken by frequency.
    const preferA = da === 2 ? 1 : 0;
    const preferB = db === 2 ? 1 : 0;
    if (preferB !== preferA) return preferB - preferA;
    return b[1] - a[1];
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

/** Find sitemap URLs referenced in robots.txt (many shops list them there). */
async function sitemapPathsFromRobots(origin: string): Promise<string[]> {
  const robots = await fetchText(`${origin}/robots.txt`);
  if (!robots) return [];
  return [...robots.matchAll(/^sitemap:\s*(\S+)/gim)].map((m) => m[1]!);
}

async function parseSitemap(xml: string, limit = 3000): Promise<string[]> {
  const locs = extractLocs(xml);
  if (!locs.length) return [];
  if (!/<sitemapindex/i.test(xml)) return locs;
  // Sitemap index — follow child sitemaps.
  const out: string[] = [];
  for (const child of locs.slice(0, 12)) {
    const cx = await fetchText(child);
    if (cx) out.push(...extractLocs(cx));
    if (out.length >= limit) break;
  }
  return out;
}

/** All page URLs from sitemap.xml / sitemap_index.xml / robots.txt referrals. */
async function sitemapUrls(origin: string): Promise<string[]> {
  // 1) Try well-known paths first.
  for (const path of ["/sitemap.xml", "/sitemap_index.xml", "/sitemap_index.xml.gz"]) {
    const xml = await fetchText(origin + path);
    if (!xml) continue;
    const result = await parseSitemap(xml);
    if (result.length) return result;
  }
  // 2) robots.txt may point to a non-standard sitemap path.
  const robotsPaths = await sitemapPathsFromRobots(origin);
  for (const u of robotsPaths.slice(0, 4)) {
    const xml = await fetchText(u);
    if (!xml) continue;
    const result = await parseSitemap(xml);
    if (result.length) return result;
  }
  return [];
}

/** Homepage anchor hrefs (absolute, http(s)). */
async function navUrls(browser: Browser, homeUrl: string): Promise<string[]> {
  try {
    const ctx = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      locale: "de-DE",
      userAgent: SHOP_UA,
    });
    const page = await ctx.newPage();
    try {
      await page.goto(homeUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await settlePage(page);
      // Dismiss consent banners so navigation links are not obscured.
      await dismissConsent(page);
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
      userAgent: SHOP_UA,
    });
    const page = await ctx.newPage();
    try {
      await page.goto(plpUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await settlePage(page);
      await dismissConsent(page);
      await settlePage(page);
      const inner = await evalWithRetry(page, () =>
        [...document.querySelectorAll("a[href]")].map(
          (a) => (a as HTMLAnchorElement).href,
        ),
      );
      const byPattern = inner.find(isLikelyPdp);
      if (byPattern) return byPattern;

      // Fallback: the deepest same-origin link on the page is likely a product.
      // This catches shops where product URLs carry no numeric ID but are just
      // slug-based (e.g. /akkus/bosch-akku-18v-4ah).
      const origin = new URL(plpUrl).origin;
      const deepest = inner
        .filter((u) => {
          try {
            const uu = new URL(u);
            if (uu.origin !== origin) return false;
            const segs = uu.pathname.split("/").filter(Boolean);
            // Must be deeper than the category page and not a CMS page.
            return segs.length >= 2 && !CMS_SLUG.test(segs[0]!);
          } catch {
            return false;
          }
        })
        .sort((a, b) => {
          const da = new URL(a).pathname.split("/").filter(Boolean).length;
          const db = new URL(b).pathname.split("/").filter(Boolean).length;
          return db - da;
        })[0];
      return deepest;
    } finally {
      await ctx.close().catch(() => {});
    }
  } catch {
    return undefined;
  }
}

/**
 * Click-through discovery: navigate the homepage like a human would.
 * 1. Open homepage, dismiss consent.
 * 2. Click the first plausible category link in the nav → record the landed URL as PLP.
 * 3. Click the first product-card link on that page → record as PDP.
 *
 * This approach does NOT rely on URL patterns — it works for any shop system
 * (Shopware, Shopify, WooCommerce, custom SPAs) as long as the UI has a
 * standard header navigation.
 */
async function clickThroughDiscovery(
  browser: Browser,
  homeUrl: string,
): Promise<{ plp?: string; pdp?: string }> {
  const origin = new URL(homeUrl).origin;
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    locale: "de-DE",
    userAgent: SHOP_UA,
  });
  try {
    const page = await ctx.newPage();
    await page.goto(homeUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await settlePage(page);
    await dismissConsent(page);
    await settlePage(page);

    // ── Step 1: find a category link in the header navigation ──────────
    // Pull all same-origin nav links with 1–3 content segments, non-CMS.
    const navCandidates: string[] = await evalWithRetry(page, () => {
      const sels = "nav a[href], header a[href], [class*='nav' i] a[href], [class*='menu' i] a[href], [role='navigation'] a[href]";
      return [...new Set(
        [...document.querySelectorAll(sels)]
          .map((a) => (a as HTMLAnchorElement).href)
          .filter((h) => h.startsWith("http")),
      )];
    }).catch(() => [] as string[]);

    const catLinks = navCandidates.filter((u) => {
      try {
        if (new URL(u).origin !== origin) return false;
        const segs = u
          .replace(/^https?:\/\/[^/]+/, "")
          .split("/")
          .filter(Boolean);
        // Strip locale prefix
        const content = /^[a-z]{2}(-[a-z]{2})?$/i.test(segs[0] ?? "") ? segs.slice(1) : segs;
        if (content.length < 1 || content.length > 3) return false;
        if (CMS_SLUG.test(content[0]!)) return false;
        if (isLikelyPdp(u)) return false;
        return true;
      } catch {
        return false;
      }
    });

    if (!catLinks.length) return {};

    // Prefer the most-repeated link (appears in multiple nav positions = real category).
    const freq = new Map<string, number>();
    for (const u of catLinks) {
      const key = new URL(u).origin + new URL(u).pathname.replace(/\/$/, "");
      freq.set(key, (freq.get(key) ?? 0) + 1);
    }
    const plpUrl = [...freq.entries()].sort((a, b) => b[1] - a[1])[0]![0];

    // Navigate to the chosen category.
    await page.goto(plpUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await settlePage(page);
    await dismissConsent(page);
    await settlePage(page);

    // ── Step 2: find the first product link on the category page ───────
    const plpLinks: string[] = await evalWithRetry(page, () =>
      [...document.querySelectorAll("a[href]")]
        .map((a) => (a as HTMLAnchorElement).href)
        .filter((h) => h.startsWith("http")),
    ).catch(() => [] as string[]);

    // Prefer pattern-matched PDPs first.
    let pdpUrl = plpLinks.find(
      (u) => sameOrigin(u, origin) && isLikelyPdp(u),
    );

    // Fallback: pick the deepest same-origin link that isn't the category itself.
    if (!pdpUrl) {
      pdpUrl = plpLinks
        .filter((u) => {
          if (!sameOrigin(u, origin)) return false;
          const segs = new URL(u).pathname.split("/").filter(Boolean);
          if (segs.length < 2) return false; // must be deeper than a top category
          if (CMS_SLUG.test(segs[0]!)) return false;
          const norm = new URL(u).origin + new URL(u).pathname.replace(/\/$/, "");
          return norm !== plpUrl; // not the PLP itself
        })
        .sort(
          (a, b) =>
            new URL(b).pathname.split("/").filter(Boolean).length -
            new URL(a).pathname.split("/").filter(Boolean).length,
        )[0];
    }

    return { plp: plpUrl, pdp: pdpUrl };
  } catch {
    return {};
  } finally {
    await ctx.close().catch(() => {});
  }
}

export async function discoverPages(
  browser: Browser,
  homeUrl: string,
): Promise<DiscoveredUrls> {
  const origin = new URL(homeUrl).origin;
  // ── Phase 1: sitemap + homepage nav-link harvest ────────────────────
  const candidates = new Set<string>();
  const fromSitemap = await sitemapUrls(origin);
  fromSitemap.forEach((u) => candidates.add(u));
  const fromNav = await navUrls(browser, homeUrl);
  fromNav.forEach((u) => candidates.add(u));

  const all = [...candidates];

  // Determine the shop's "real" origin: after redirects, the domain in the
  // harvested URLs may differ from the input (e.g. .com → .de, no-www → www).
  // Build a frequency map and take the top origin as the canonical one.
  const originFreq = new Map<string, number>();
  for (const u of all) {
    try {
      const o = new URL(u).origin;
      originFreq.set(o, (originFreq.get(o) ?? 0) + 1);
    } catch { /* ignore */ }
  }
  // Top 2 origins by frequency are likely all from this shop (e.g. www + root).
  const topOrigins = new Set(
    [...originFreq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([o]) => o),
  );

  // Use sameShop (origin-redirect aware) instead of strict sameOrigin.
  const isMine = (u: string) => sameShop(u, origin, topOrigins);

  let pdp = all.find((u) => isMine(u) && isLikelyPdp(u));
  let plp = pickPlp(all.filter(isMine));

  // Category found but no product yet → peek inside the category.
  if (plp && !pdp) {
    pdp = await peekForPdp(browser, plp);
  }

  // ── Phase 2: click-through navigation (shop-system agnostic) ────────
  if (!plp || !pdp) {
    const clicked = await clickThroughDiscovery(browser, homeUrl).catch(
      (): { plp?: string; pdp?: string } => ({}),
    );
    plp = plp ?? clicked.plp;
    pdp = pdp ?? clicked.pdp;
  }
  const method: DiscoveredUrls["method"] =
    pdp || plp
      ? fromSitemap.length
        ? "sitemap"
        : "nav-fallback"
      : "home-only";

  return { home: homeUrl, plp, pdp, method };
}

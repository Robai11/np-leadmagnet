/*
 * Page-type discovery (Build-Spec §4). Try sitemap.xml and classify URLs by
 * pattern (category vs product); fall back to rendering the homepage and
 * classifying nav links. Always returns at least the homepage.
 */

import type { Browser } from "playwright-core";
import type { DiscoveredUrls } from "@/lib/analysis/pipeline-types";

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

type Kind = "pdp" | "plp" | "other";

function classify(url: string): Kind {
  if (PDP_HINTS.some((re) => re.test(url))) return "pdp";
  if (PLP_HINTS.some((re) => re.test(url))) return "plp";
  return "other";
}

async function fetchText(url: string, ms = 8000): Promise<string | null> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    const res = await fetch(url, { signal: ac.signal, redirect: "follow" });
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

async function fromSitemap(origin: string): Promise<DiscoveredUrls | null> {
  for (const path of ["/sitemap.xml", "/sitemap_index.xml"]) {
    let xml = await fetchText(origin + path);
    if (!xml) continue;
    let locs = extractLocs(xml);

    // Sitemap index → fetch the first child sitemap.
    if (/<sitemapindex/i.test(xml) && locs.length) {
      const child = await fetchText(locs[0]!);
      if (child) {
        xml = child;
        locs = extractLocs(child);
      }
    }
    if (!locs.length) continue;

    const pdp = locs.find((u) => classify(u) === "pdp");
    const plp = locs.find((u) => classify(u) === "plp");
    if (pdp || plp) {
      return { home: origin + "/", plp, pdp, method: "sitemap" };
    }
  }
  return null;
}

async function fromNav(
  browser: Browser,
  homeUrl: string,
): Promise<DiscoveredUrls> {
  try {
    const ctx = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      locale: "de-DE",
    });
    const page = await ctx.newPage();
    await page.goto(homeUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
    const hrefs: string[] = await page.evaluate(() =>
      [...document.querySelectorAll("a[href]")]
        .map((a) => (a as HTMLAnchorElement).href)
        .filter((h) => h.startsWith("http")),
    );
    await ctx.close().catch(() => {});

    const plp = hrefs.find((u) => classify(u) === "plp");
    let pdp = hrefs.find((u) => classify(u) === "pdp");

    // If a category page was found but no product, peek into it for a product.
    if (plp && !pdp) {
      const ctx2 = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        locale: "de-DE",
      });
      const p2 = await ctx2.newPage();
      try {
        await p2.goto(plp, { waitUntil: "domcontentloaded", timeout: 30_000 });
        const inner: string[] = await p2.evaluate(() =>
          [...document.querySelectorAll("a[href]")].map(
            (a) => (a as HTMLAnchorElement).href,
          ),
        );
        pdp = inner.find((u) => classify(u) === "pdp");
      } catch {
        /* ignore */
      } finally {
        await ctx2.close().catch(() => {});
      }
    }

    return {
      home: homeUrl,
      plp,
      pdp,
      method: plp || pdp ? "nav-fallback" : "home-only",
    };
  } catch {
    return { home: homeUrl, method: "home-only" };
  }
}

export async function discoverPages(
  browser: Browser,
  homeUrl: string,
): Promise<DiscoveredUrls> {
  const origin = new URL(homeUrl).origin;
  const viaSitemap = await fromSitemap(origin);
  if (viaSitemap) return viaSitemap;
  return fromNav(browser, homeUrl);
}

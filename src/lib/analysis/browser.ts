/*
 * Browser layer — a hosted headless browser driven via Playwright over CDP
 * (Build-Spec §1). Browserbase is the provider; because we only consume a CDP
 * connect URL, swapping providers is just swapping where that URL comes from.
 */

import Browserbase from "@browserbasehq/sdk";
import { chromium, type Browser } from "playwright-core";
import { readEnv } from "@/lib/analysis/config";

/**
 * Realistic desktop-Chrome User-Agent for every context. Playwright's default
 * headless UA contains "HeadlessChrome", which many shops bot-detect — serving
 * a degraded page or silently blocking add-to-cart. A normal UA avoids that
 * whole class of "new shop, cart/checkout missing" failures in local mode.
 */
export const SHOP_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function createConnectUrl(): Promise<string> {
  const env = readEnv();
  if (!env.browserbaseApiKey) {
    throw new Error("BROWSERBASE_API_KEY missing");
  }
  const bb = new Browserbase({ apiKey: env.browserbaseApiKey });
  const session = await bb.sessions.create({
    projectId: env.browserbaseProjectId ?? "",
    // Residential proxies (PAID) let real shops load past IP/WAF blocks. We
    // pin the exit to Germany since the target shops are DE e-commerce. Gated
    // behind BROWSERBASE_PROXIES so a non-proxy plan still works.
    proxies: env.browserbaseProxies
      ? [{ type: "browserbase", geolocation: { country: "DE" } }]
      : undefined,
    // Stealth: solve CAPTCHAs + a realistic fingerprint so SPA/anti-bot shops
    // (e.g. JYSK) don't silently block add-to-cart.
    browserSettings: { solveCaptchas: true },
  });
  return session.connectUrl;
}

/**
 * Open one hosted browser session, run `fn`, and always tear it down. Each call
 * is an independent session, so read-only pages can render in parallel
 * (Build-Spec §4) by calling withSession concurrently.
 */
/**
 * Thrown by render/stateful code when a page is unreachable or bot-blocked, to
 * signal withSession that retrying on a stealthier transport (Browserbase +
 * residential proxy) is worthwhile.
 */
export class BlockedError extends Error {
  constructor(message = "blocked") {
    super(message);
    this.name = "BlockedError";
  }
}

/** Does this error look like a bot/IP block worth retrying on Browserbase? */
export function isBlockError(err: unknown): boolean {
  if (err instanceof BlockedError) return true;
  const msg = err instanceof Error ? err.message : String(err);
  return /ERR_CONNECTION_REFUSED|ERR_TUNNEL_CONNECTION_FAILED|ERR_CONNECTION_RESET|ERR_CONNECTION_CLOSED|ERR_TIMED_OUT|ERR_SSL|ERR_HTTP2|ERR_ACCESS_DENIED|net::ERR_FAILED|403|429/i.test(
    msg,
  );
}

async function runLocal<T>(fn: (b: Browser) => Promise<T>): Promise<T> {
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--disable-features=IsolateOrigins,site-per-process",
    ],
  });
  try {
    return await fn(browser);
  } finally {
    await browser.close().catch(() => {});
  }
}

async function runBrowserbase<T>(fn: (b: Browser) => Promise<T>): Promise<T> {
  const connectUrl = await createConnectUrl();
  const browser = await chromium.connectOverCDP(connectUrl);
  try {
    return await fn(browser);
  } finally {
    // Closing the CDP connection ends the Browserbase session.
    await browser.close().catch(() => {});
  }
}

/**
 * Run `fn` in a browser session. HYBRID by default: when BROWSER_MODE=local we
 * try the fast local browser first and, only if `fn` hits a bot/IP block (and
 * Browserbase is configured), transparently retry that one page on Browserbase
 * + residential proxy. So the common case stays fast/free and the stealth
 * transport is spent only on shops that actually need it. Set
 * `{ fallback: false }` to opt out (e.g. a lightweight discovery crawl).
 */
export async function withSession<T>(
  fn: (browser: Browser) => Promise<T>,
  opts: { fallback?: boolean } = {},
): Promise<T> {
  const env = readEnv();
  const fallback = opts.fallback ?? true;

  if (env.browserMode !== "local") {
    return runBrowserbase(fn);
  }

  try {
    return await runLocal(fn);
  } catch (err) {
    if (fallback && env.browserbaseApiKey && isBlockError(err)) {
      // Local hit a bot/IP block — retry this page on the stealth transport.
      return runBrowserbase(fn);
    }
    throw err;
  }
}

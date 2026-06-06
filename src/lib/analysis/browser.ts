/*
 * Browser layer — a hosted headless browser driven via Playwright over CDP
 * (Build-Spec §1). Browserbase is the provider; because we only consume a CDP
 * connect URL, swapping providers is just swapping where that URL comes from.
 */

import Browserbase from "@browserbasehq/sdk";
import { chromium, type Browser } from "playwright-core";
import { readEnv } from "@/lib/analysis/config";

async function createConnectUrl(): Promise<string> {
  const env = readEnv();
  if (!env.browserbaseApiKey) {
    throw new Error("BROWSERBASE_API_KEY missing");
  }
  const bb = new Browserbase({ apiKey: env.browserbaseApiKey });
  const session = await bb.sessions.create({
    projectId: env.browserbaseProjectId ?? "",
    // Stealth proxies help get past basic bot blocks on real shops.
    proxies: true,
  });
  return session.connectUrl;
}

/**
 * Open one hosted browser session, run `fn`, and always tear it down. Each call
 * is an independent session, so read-only pages can render in parallel
 * (Build-Spec §4) by calling withSession concurrently.
 */
export async function withSession<T>(
  fn: (browser: Browser) => Promise<T>,
): Promise<T> {
  const connectUrl = await createConnectUrl();
  const browser = await chromium.connectOverCDP(connectUrl);
  try {
    return await fn(browser);
  } finally {
    // Closing the CDP connection ends the Browserbase session.
    await browser.close().catch(() => {});
  }
}

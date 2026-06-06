/*
 * Stateful flow (Build-Spec §4/§6): one sequential session — PDP → choose a
 * variant → add to cart → cart → checkout entry. We STOP before any data entry
 * or login wall: we capture the checkout's first screen but never type into a
 * field, create an account, or submit personal data. Anything unreachable
 * (out of stock, forced login, bot block) is logged honestly, never invented.
 */

import type { Browser, Page } from "playwright-core";
import type { PageType } from "@/lib/types";
import type { RenderedPage } from "@/lib/analysis/pipeline-types";
import { captureView, dismissConsent, viewportSize, NAV_TIMEOUT } from "@/lib/analysis/render";

export interface StatefulResult {
  pages: RenderedPage[];
  notes: string[];
}

const ADD_TO_CART = /(in den warenkorb|add to cart|zum warenkorb|jetzt kaufen|in den korb)/i;
const GO_TO_CHECKOUT = /(zur kasse|zum checkout|checkout|kasse|weiter zur kasse|bezahlen)/i;
const LOGIN_WALL = /(passwort|password|anmelden|einloggen|konto erstellen|create account|sign in)/i;

async function clickByText(page: Page, re: RegExp, timeout = 2500): Promise<boolean> {
  try {
    const btn = page.getByRole("button", { name: re }).first();
    if (await btn.isVisible({ timeout })) {
      await btn.click({ timeout });
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const link = page.getByRole("link", { name: re }).first();
    if (await link.isVisible({ timeout: 1200 })) {
      await link.click({ timeout });
      return true;
    }
  } catch {
    /* none */
  }
  return false;
}

async function buildPage(
  page: Page,
  id: PageType,
  name: string,
  url: string,
): Promise<RenderedPage> {
  const desktop = await captureView(page, "desktop");
  const content = desktop.elements.map((e) => e.text).filter(Boolean).join(" · ").slice(0, 4000);
  return { id, type: id, name, url, desktop, content, reachable: true };
}

export async function runStatefulFlow(
  browser: Browser,
  pdpUrl: string,
): Promise<StatefulResult> {
  const notes: string[] = [];
  const pages: RenderedPage[] = [];

  const ctx = await browser.newContext({
    viewport: viewportSize("desktop"),
    locale: "de-DE",
  });
  const page = await ctx.newPage();

  try {
    await page.goto(pdpUrl, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
    await dismissConsent(page);

    // Choose a variant if the PDP presents required options (best-effort).
    try {
      const swatch = page
        .locator("[class*='variant' i] button, [class*='option' i] button, select")
        .first();
      if (await swatch.isVisible({ timeout: 1200 })) {
        const tag = await swatch.evaluate((el) => el.tagName.toLowerCase());
        if (tag === "select") {
          await swatch.selectOption({ index: 1 }).catch(() => {});
        } else {
          await swatch.click({ timeout: 1500 }).catch(() => {});
        }
      }
    } catch {
      /* no variant selector — fine */
    }

    const added = await clickByText(page, ADD_TO_CART);
    if (!added) {
      notes.push("Warenkorb: Add-to-Cart nicht auffindbar (evtl. ausverkauft) — nicht analysiert.");
      return { pages, notes };
    }
    await page.waitForTimeout(1500);

    // Go to cart: prefer a checkout/cart control; else navigate to /cart|/warenkorb.
    const origin = new URL(pdpUrl).origin;
    const wentToCart = await clickByText(page, /(warenkorb|zum warenkorb|cart|zur kasse)/i, 2000);
    if (!wentToCart) {
      let reached = false;
      for (const path of ["/cart", "/warenkorb", "/checkout/cart"]) {
        try {
          await page.goto(origin + path, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
          reached = true;
          break;
        } catch {
          /* try next */
        }
      }
      if (!reached) {
        notes.push("Warenkorb: nicht erreichbar — nicht analysiert.");
        return { pages, notes };
      }
    } else {
      await page.waitForTimeout(1200);
    }
    await dismissConsent(page);
    pages.push(await buildPage(page, "cart", "Warenkorb", page.url()));

    // Proceed toward checkout — capture the FIRST checkout screen, no input.
    const wentToCheckout = await clickByText(page, GO_TO_CHECKOUT, 2500);
    if (!wentToCheckout) {
      notes.push("Checkout: kein „Zur Kasse“-Einstieg gefunden — nicht analysiert.");
      return { pages, notes };
    }
    await page.waitForTimeout(1500);

    const bodyText = (await page.evaluate(() => document.body.innerText || "")).slice(0, 5000);
    const hasPasswordField = await page.locator("input[type=password]").count();
    if (hasPasswordField > 0 && LOGIN_WALL.test(bodyText)) {
      notes.push("Checkout: nur nach Login/Kontoerstellung erreichbar — vor Dateneingabe gestoppt.");
    }
    // Capture the checkout entry screen WITHOUT entering any data.
    pages.push(await buildPage(page, "checkout", "Checkout", page.url()));

    return { pages, notes };
  } catch (err) {
    notes.push(
      `Stateful-Flow abgebrochen: ${err instanceof Error ? err.message : "unbekannt"}.`,
    );
    return { pages, notes };
  } finally {
    await ctx.close().catch(() => {});
  }
}

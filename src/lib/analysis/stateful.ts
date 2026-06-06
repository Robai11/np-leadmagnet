/*
 * Stateful flow (Build-Spec §4/§6): one sequential session — PDP → choose a
 * variant → add to cart → cart → checkout entry. We STOP before any data entry
 * or login wall: we capture the checkout's first screen but never type into a
 * field, create an account, or submit personal data. Anything unreachable
 * (out of stock, forced login, bot block) is logged honestly, never invented.
 */

import type { Browser, Page, Locator } from "playwright-core";
import type { PageType } from "@/lib/types";
import type { RenderedPage } from "@/lib/analysis/pipeline-types";
import { captureView, dismissConsent, viewportSize, NAV_TIMEOUT, settlePage } from "@/lib/analysis/render";

export interface StatefulResult {
  pages: RenderedPage[];
  notes: string[];
}

const ADD_TO_CART = /(in den warenkorb|add to cart|zum warenkorb|jetzt kaufen|in den korb)/i;
const GO_TO_CHECKOUT = /(zur kasse|zum checkout|checkout|kasse|weiter zur kasse|bezahlen)/i;
const LOGIN_WALL = /(passwort|password|anmelden|einloggen|konto erstellen|create account|sign in)/i;

/**
 * Close marketing/newsletter modals (Klaviyo, Privy, OptinMonster, …) and
 * generic dialogs. These overlays intercept pointer events and block clicks on
 * the real page — a very common cause of "add-to-cart not clickable".
 */
async function dismissPopups(page: Page): Promise<void> {
  await page.keyboard.press("Escape").catch(() => {});
  const closeSelectors = [
    "button.klaviyo-close-form",
    "[class*='kl-private'] [aria-label*='close' i]",
    "[class*='kl-private'] [aria-label*='schließen' i]",
    "div[role=dialog] button[aria-label*='close' i]",
    "div[role=dialog] button[aria-label*='schließen' i]",
    "[class*='modal' i] button[aria-label*='close' i]",
    "[class*='popup' i] button[aria-label*='close' i]",
    "[aria-label='Close dialog']",
  ];
  for (const sel of closeSelectors) {
    try {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 500 })) {
        await el.click({ timeout: 1200, force: true }).catch(() => {});
      }
    } catch {
      /* next */
    }
  }
}

/** Click that survives overlays: retry after dismissing popups, then force. */
async function robustClick(page: Page, el: Locator): Promise<boolean> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await el.scrollIntoViewIfNeeded({ timeout: 1500 }).catch(() => {});
      await el.click({ timeout: 2500, force: attempt === 2 });
      return true;
    } catch {
      await dismissPopups(page);
    }
  }
  return false;
}

async function clickByText(page: Page, re: RegExp, timeout = 2500): Promise<boolean> {
  for (const role of ["button", "link"] as const) {
    try {
      const el = page.getByRole(role, { name: re }).first();
      if (await el.isVisible({ timeout: role === "button" ? timeout : 1200 })) {
        if (await robustClick(page, el)) return true;
      }
    } catch {
      /* try next role / strategy */
    }
  }
  return false;
}

/**
 * Add-to-cart is the most shop-specific click. Try the accessible name first,
 * then a battery of CSS selectors common to Shopware/Shopify/Woo/Magento.
 */
async function clickAddToCart(page: Page): Promise<boolean> {
  await dismissPopups(page);
  if (await clickByText(page, ADD_TO_CART, 2500)) return true;
  const selectors = [
    "button.btn-buy",
    "form[action*='line-item' i] button[type=submit]",
    "form[action*='line-item' i] button",
    ".product-detail-buy-container button",
    "[class*='add-to-cart' i]",
    "[class*='addtocart' i]",
    "[class*='AddToCart']",
    "button[name='addtocart']",
    "button[title*='warenkorb' i]",
    "button[aria-label*='warenkorb' i]",
    "button[data-action*='cart' i]",
    "form[action*='cart' i] button[type=submit]",
    "form[action*='checkout' i] button[type=submit]",
  ];
  for (const sel of selectors) {
    try {
      const el = page.locator(sel).first();
      if (!(await el.count())) continue;
      if (!(await el.isVisible({ timeout: 1000 }))) continue;
      if (await robustClick(page, el)) return true;
    } catch {
      /* next selector */
    }
  }
  return false;
}

/**
 * Proceed from cart to checkout. The CTA is usually a LINK — navigate its href
 * directly rather than clicking, which bypasses marketing-popup overlays that
 * silently swallow the click (a real failure mode we hit on live shops).
 */
async function clickToCheckout(page: Page): Promise<boolean> {
  await dismissPopups(page);
  // Link-based checkout CTAs (Shopware/Shopify/Woo): read href, navigate to it.
  const linkSelectors = [
    "a.begin-checkout-btn",
    "a[href*='/checkout/confirm' i]",
    "a[href*='/checkout/register' i]",
    "a[href*='/checkout/onepage' i]",
  ];
  for (const sel of linkSelectors) {
    try {
      const el = page.locator(sel).first();
      if (!(await el.count())) continue;
      const href = await el.getAttribute("href");
      if (href) {
        const dest = new URL(href, page.url()).toString();
        await page.goto(dest, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
        await settlePage(page);
        return true;
      }
    } catch {
      /* next selector */
    }
  }
  // Form-submit checkouts (no link href): click the submit control.
  const btnSelectors = [
    "button[name='checkout']",
    "form[action*='checkout' i] button[type=submit]",
    ".checkout-aside-action button",
  ];
  for (const sel of btnSelectors) {
    try {
      const el = page.locator(sel).first();
      if (!(await el.count()) || !(await el.isVisible({ timeout: 1000 }))) continue;
      if (await robustClick(page, el)) {
        await settlePage(page);
        return true;
      }
    } catch {
      /* next selector */
    }
  }
  // Last resort: a checkout control matched only by its accessible name.
  return clickByText(page, GO_TO_CHECKOUT, 2500);
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
    await settlePage(page);
    await dismissConsent(page);
    // Consent may reload; let the product page settle before interacting.
    await settlePage(page);
    await page.waitForTimeout(500);
    // Marketing popups (e.g. Klaviyo) often appear after a short delay and would
    // intercept the add-to-cart click — close them first.
    await dismissPopups(page);

    // Choose a variant if the PDP presents required options (best-effort).
    // Strictly scoped to the product-detail configurator so we never touch the
    // shop's language/currency <select> (those submit and navigate away).
    try {
      const swatch = page
        .locator(
          ".product-detail-configurator button, .product-detail-configurator select, .product-detail [class*='variant' i] button",
        )
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

    const added = await clickAddToCart(page);
    if (!added) {
      notes.push("Warenkorb: Add-to-Cart nicht auffindbar (evtl. ausverkauft) — nicht analysiert.");
      return { pages, notes };
    }
    await page.waitForTimeout(1500);

    // Go to cart: prefer a checkout/cart control; else navigate to the cart path.
    // Include the PDP's locale prefix (e.g. /de) — many shops mount cart under it.
    const pdpParsed = new URL(pdpUrl);
    const origin = pdpParsed.origin;
    const firstSeg = pdpParsed.pathname.split("/").filter(Boolean)[0] ?? "";
    const locale = /^[a-z]{2}(-[a-z]{2})?$/i.test(firstSeg) ? `/${firstSeg}` : "";
    const cartPaths = [
      `${locale}/checkout/cart`,
      `${locale}/cart`,
      `${locale}/warenkorb`,
      "/checkout/cart",
      "/cart",
      "/warenkorb",
    ];
    // Reach the cart page deterministically — offcanvas links ("Zur Kasse" vs
    // "Warenkorb anzeigen") are ambiguous and can skip straight to checkout.
    let reachedCart = false;
    for (const path of cartPaths) {
      try {
        await page.goto(origin + path, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
        await settlePage(page);
        reachedCart = true;
        break;
      } catch {
        /* try next */
      }
    }
    if (!reachedCart) {
      notes.push("Warenkorb: nicht erreichbar — nicht analysiert.");
      return { pages, notes };
    }
    await dismissConsent(page);
    await dismissPopups(page);
    pages.push(await buildPage(page, "cart", "Warenkorb", page.url()));

    // Proceed toward checkout — capture the FIRST checkout screen, no input.
    const wentToCheckout = await clickToCheckout(page);
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

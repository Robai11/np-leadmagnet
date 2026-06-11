/*
 * Stateful flow (Build-Spec §4/§6): one sequential session — PDP → choose a
 * variant → add to cart → cart → checkout entry. We STOP before any data entry
 * or login wall: we capture the checkout's first screen but never type into a
 * field, create an account, or submit personal data. Anything unreachable
 * (out of stock, forced login, bot block) is logged honestly, never invented.
 */

import type { Browser, Page, Locator } from "playwright-core";
import type { PageType } from "@/lib/types";
import type { RenderedPage, RenderedView } from "@/lib/analysis/pipeline-types";
import {
  captureView,
  captureElementView,
  dismissConsent,
  viewportSize,
  NAV_TIMEOUT,
  settlePage,
  isBotChallenge,
} from "@/lib/analysis/render";
import { SHOP_UA, BlockedError, isBlockError } from "@/lib/analysis/browser";
import { platformAddToCart, PLATFORM_LABEL } from "@/lib/analysis/platform";

export interface StatefulResult {
  pages: RenderedPage[];
  notes: string[];
}

const ADD_TO_CART =
  /(in den warenkorb|in den korb|in den einkaufswagen|zum warenkorb|warenkorb hinzu|add to cart|add to bag|add to basket|add to trolley|zur tasche hinzu)/i;
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
    "form[action*='/cart/add' i] [type=submit]", // Shopify
    "button[name='add']", // Shopify
    ".product-form__submit", // Shopify
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
 * Pick ONE value per variant group when the buy button is gated behind a
 * required selection (size/colour) implemented as BUTTON/label swatches rather
 * than radios/selects (common on Shopify/fashion themes). Scoped to swatch /
 * variant / option containers, skips sold-out & disabled values, and never
 * clicks add-to-cart / quantity / wishlist controls. Best-effort.
 */
async function selectVariantSwatches(page: Page): Promise<boolean> {
  let any = false;
  // Variant/size/colour containers. Broad — incl. bare divs (snocks uses
  // <div class="prd-Detail_Variants">, not a <fieldset>) and radiogroups.
  const groups = page.locator(
    [
      "[class*='variant' i]",
      "[class*='swatch' i]",
      "[class*='option' i]",
      "[class*='size' i]",
      "[class*='product-form__input' i]",
      "[class*='variant-picker' i]",
      "[class*='option-selector' i]",
      "[class*='product-options' i]",
      "fieldset",
      "[role=radiogroup]",
    ].join(","),
  );
  const gc = Math.min(await groups.count().catch(() => 0), 10);
  // Skip non-value controls that live among swatches: size-guide, info, close.
  const JUNK =
    /in den warenkorb|add to cart|add to bag|checkout|zur kasse|menge|quantity|wunschliste|wishlist|merkzettel|nicht sicher|size ?guide|größentabelle|größenberater|hilfe|^\?$|^[×✕✖x]$/i;
  for (let gi = 0; gi < gc; gi++) {
    const group = groups.nth(gi);
    // Real user-clickable option values: a radio's LABEL (the hidden input
    // itself isn't clickable), pill buttons, swatches. Clicking the LABEL (not
    // setting input.checked in JS) is what triggers the shop's framework to
    // reveal/enable the buy button.
    const values = group.locator(
      "label, [role=radio], [role=option], button, a[role=button], [class*='swatch' i]",
    );
    const n = Math.min(await values.count().catch(() => 0), 16);
    for (let i = 0; i < n; i++) {
      const v = values.nth(i);
      try {
        const txt = ((await v.innerText().catch(() => "")) || "").trim();
        if (txt && JUNK.test(txt)) continue;
        const cls = (await v.getAttribute("class").catch(() => "")) || "";
        const aria = await v.getAttribute("aria-disabled").catch(() => null);
        if (aria === "true" || /disabled|sold-?out|unavailable|ausverkauft|out-of-stock|not-available/i.test(cls))
          continue;
        if (!(await v.isVisible({ timeout: 250 }).catch(() => false))) continue;
        await v.click({ timeout: 1200, force: true });
        any = true;
        break; // one value per group is enough
      } catch {
        /* next value */
      }
    }
  }
  return any;
}

/**
 * Fill REQUIRED non-sensitive product options (engraving/personalization/name)
 * with a neutral placeholder so add-to-cart isn't blocked. Strictly scoped to
 * the product/buy form — never touches search, coupon, quantity, or anything on
 * checkout/login (those data fields remain off-limits per Build-Spec §6).
 */
async function fillProductOptions(page: Page): Promise<void> {
  try {
    await page.evaluate(() => {
      const scopeSel = [
        "form[action*='/cart/add' i]",
        "form[action*='line-item' i]",
        ".product-form",
        ".product-detail-buy",
        ".product-detail-configurator",
        "[class*='product-detail' i] form",
      ].join(",");
      const roots = Array.from(document.querySelectorAll(scopeSel));
      const visible = (el: HTMLElement) =>
        el.offsetParent !== null && getComputedStyle(el).visibility !== "hidden";
      const SKIP = /search|suche|gutschein|coupon|voucher|qty|menge|quantity|email|e-mail|plz|zip/i;
      const PERSONAL =
        /personalis|gravur|wunsch|beschriftung|name|text|message|nachricht|monogramm|aufdruck/i;
      for (const root of roots) {
        root.querySelectorAll("input, textarea").forEach((node) => {
          const el = node as HTMLInputElement;
          const type = (el.getAttribute("type") || el.tagName).toLowerCase();
          const isText =
            el.tagName === "TEXTAREA" || ["text", ""].includes(type);
          const ident = `${el.name || ""} ${el.id || ""} ${el.getAttribute("placeholder") || ""}`;
          if (isText && !SKIP.test(ident)) {
            const required =
              el.required || el.getAttribute("aria-required") === "true";
            if ((required || PERSONAL.test(ident)) && !el.value && visible(el)) {
              el.value = "Muster";
              el.dispatchEvent(new Event("input", { bubbles: true }));
              el.dispatchEvent(new Event("change", { bubbles: true }));
            }
          } else if (type === "checkbox") {
            if (el.required && !el.checked && visible(el)) {
              el.checked = true;
              el.dispatchEvent(new Event("change", { bubbles: true }));
            }
          }
        });
      }
    });
  } catch {
    /* best-effort */
  }
}

/**
 * Some shops gate add-to-cart behind a personalization MODAL (e.g. enter an
 * engraving name, then confirm). After the add click, if such a modal opened,
 * fill its non-sensitive text fields and confirm so the product is added.
 */
async function fillPersonalizationModal(page: Page): Promise<void> {
  try {
    await page.waitForTimeout(900);
    const modal = page
      .locator(
        "[role=dialog], dialog[open], [class*='modal' i], [class*='popup' i], [class*='personali' i], [class*='customiz' i]",
      )
      .filter({ has: page.locator("input[type=text], input:not([type]), textarea") })
      .first();
    if (!(await modal.count())) return;
    if (!(await modal.isVisible({ timeout: 800 }).catch(() => false))) return;

    const fields = modal.locator("input[type=text], input:not([type]), textarea");
    const count = await fields.count();
    for (let i = 0; i < Math.min(count, 6); i++) {
      try {
        const f = fields.nth(i);
        if ((await f.isVisible().catch(() => false)) && !(await f.inputValue().catch(() => "x"))) {
          await f.fill("Muster", { timeout: 1500 }).catch(() => {});
        }
      } catch {
        /* next */
      }
    }
    // Required selects / checkboxes inside the modal.
    await modal
      .evaluate((root) => {
        root.querySelectorAll("select").forEach((s) => {
          const sel = s as HTMLSelectElement;
          if (sel.options.length > 1 && sel.selectedIndex <= 0) {
            sel.selectedIndex = 1;
            sel.dispatchEvent(new Event("change", { bubbles: true }));
          }
        });
        root.querySelectorAll("input[type=checkbox]").forEach((c) => {
          const cb = c as HTMLInputElement;
          if (cb.required && !cb.checked) {
            cb.checked = true;
            cb.dispatchEvent(new Event("change", { bubbles: true }));
          }
        });
      })
      .catch(() => {});

    // Confirm the modal (its own add/apply button).
    await clickByText(
      page,
      /(in den warenkorb|add to cart|hinzufügen|übernehmen|anwenden|speichern|fertig|bestätigen|weiter|ok)/i,
      2500,
    );
    await page.waitForTimeout(800);
  } catch {
    /* best-effort */
  }
}

/** Heuristic: is the current page a NON-empty cart? Uses STRUCTURAL signals
 * (line-item rows, quantity inputs, a checkout control) rather than body text,
 * which on most shops is dominated by header/nav/skip-links and buries the
 * real cart state. Explicit "empty cart" markers veto it. */
/** True if the current page is a 404 / "page not found" error page. */
async function isErrorPage(page: Page): Promise<boolean> {
  try {
    const title = (await page.title()).toLowerCase();
    const heads = (
      await page.evaluate(() => {
        const t = (sel: string) => document.querySelector(sel)?.textContent || "";
        return `${t("h1")} ${t("h2")}`;
      })
    ).toLowerCase();
    const hay = `${title} ${heads}`;
    // Broad, mostly-German error wording. Custom 404s rarely say "404" — they
    // say "existiert nicht", "gesuchte Seite", "gibt es nicht" etc. The HTTP
    // status is checked separately at call sites; this catches soft-404s (200).
    return /\b404\b|fehler ?404|seite (wurde )?nicht gefunden|\bnicht gefunden\b|page not found|\bnot found\b|existiert (leider )?nicht( mehr)?|gibt es (diese seite )?(leider )?nicht( mehr)?|gesuchte seite|diese seite (existiert|gibt es)|konnten? .{0,20}nicht (gefunden|finden)|leider nicht (gefunden|finden)|nicht (mehr )?(verfügbar|vorhanden)|fehlerseite|no longer (exists|available)|does ?n.?t exist|could ?n.?t (be )?found|can.?t be found|page you.{0,30}(not|n.t).{0,12}(exist|found)/i.test(
      hay,
    );
  } catch {
    return false;
  }
}

/**
 * True if the current page is a REAL checkout entry (not a 404, not the cart,
 * not an empty cart). Accepts a login/register wall — that IS the checkout
 * entry for guest-gated shops. Strong signals only, so the cart page (which
 * may carry header login links / a "Zur Kasse" label) is not misread.
 */
async function isCheckoutPage(page: Page): Promise<boolean> {
  if (await isErrorPage(page)) return false;
  try {
    return await page.evaluate(() => {
      const url = location.href.toLowerCase();
      const body = (document.body.innerText || "").toLowerCase();
      if (/(warenkorb ist leer|dein warenkorb ist leer|cart is empty|warenkorb.{0,12}leer)/.test(body.slice(0, 500)))
        return false;
      const urlOk = /checkout|\/kasse|onepage|\/order|confirm|\/buy\/(checkout|address|payment|delivery)/.test(url);
      // Address fields and a login wall are real checkout-entry signals. A bare
      // email field (newsletter sign-up, common on 404/footer) is NOT — that was
      // misreading error pages as checkouts.
      const addressFields = document.querySelectorAll(
        "input[name*='street' i],input[name*='strasse' i],input[name*='zip' i],input[name*='plz' i],input[name*='postal' i],input[name*='hausnummer' i],input[name*='city' i],input[name*='ort' i],input[autocomplete*='address' i],input[autocomplete*='postal' i],input[autocomplete='street-address']",
      ).length;
      const loginFields = document.querySelectorAll("input[type=password]").length;
      return urlOk || addressFields > 0 || loginFields > 0;
    });
  } catch {
    return false;
  }
}

async function isCartPopulated(page: Page): Promise<boolean> {
  try {
    const r = await page.evaluate(() => {
      const n = (sel: string) => document.querySelectorAll(sel).length;
      const lineItems = n(
        "[class*='cart-item' i],[class*='line-item' i],tr.cart__row,[class*='cart__row' i],[data-line-item],.cart_item",
      );
      const qtyInputs = n(
        "input[name='updates[]'],input[name*='quantity' i],[class*='quantity' i] input,input[type='number'][class*='qty' i]",
      );
      const checkoutCtl = n(
        "a.begin-checkout-btn,button[name='checkout'],input[name='checkout'],a[href*='/checkout' i],[class*='checkout' i] button,[class*='checkout' i] a",
      );
      const emptyEl = n(
        ".cart--empty,.cart__empty,[class*='cart' i][class*='empty' i],[class*='empty-cart' i]",
      );
      const emptyText =
        /(dein warenkorb ist leer|warenkorb.{0,15}(ist )?leer|cart is empty|your (shopping )?cart is empty)/i.test(
          (document.body.innerText || "").toLowerCase(),
        );
      return { lineItems, qtyInputs, checkoutCtl, emptyEl, emptyText };
    });
    if (r.emptyEl > 0 || r.emptyText) return false;
    return r.lineItems > 0 || r.qtyInputs > 0 || r.checkoutCtl > 0;
  } catch {
    return false;
  }
}

/**
 * Click the cart control the way a shopper would — the header cart icon / "view
 * cart" link. Surfaces the cart on shops with no dedicated cart URL: depending
 * on the shop this OPENS an off-canvas drawer/mini-cart, or NAVIGATES to a cart
 * page. The caller captures whatever results. Accessible-name first (pierces
 * open shadow DOM), then aria-label / href / common header patterns.
 */
async function clickCartControl(page: Page): Promise<boolean> {
  const candidates: Locator[] = [
    page.getByRole("link", { name: /warenkorb|einkaufswagen|\bcart\b|basket|\bbag\b/i }).first(),
    page.getByRole("button", { name: /warenkorb|einkaufswagen|\bcart\b|basket|\bbag\b/i }).first(),
    page
      .locator(
        "a[aria-label*='warenkorb' i], a[aria-label*='cart' i], button[aria-label*='warenkorb' i], button[aria-label*='cart' i]",
      )
      .first(),
    page
      .locator(
        "header [class*='cart' i] a, header [class*='cart' i] button, [class*='cart-icon' i], [class*='minicart' i] a, [class*='mini-cart' i] a, [class*='basket' i] a",
      )
      .first(),
    page
      .locator(
        "a[href*='/cart' i], a[href*='warenkorb' i], a[href*='/order' i], a[href*='basket' i], a[href*='/checkout/cart' i]",
      )
      .first(),
  ];
  for (const el of candidates) {
    try {
      if ((await el.count()) && (await el.isVisible({ timeout: 700 }))) {
        await el.scrollIntoViewIfNeeded({ timeout: 1200 }).catch(() => {});
        await el.click({ timeout: 2000, force: true });
        return true;
      }
    } catch {
      /* next candidate */
    }
  }
  return false;
}

/**
 * Detect an off-canvas / mini-cart panel that is CURRENTLY OPEN — what a real
 * shopper sees on shops without a dedicated cart page. Purely STRUCTURAL (no
 * per-shop selectors): a positioned, visible panel carrying cart signals (a
 * checkout CTA, or a cart heading with a price / quantity / remove control).
 * Tags the winner with data-cs-cart, dims any backdrop for a clean shot, and
 * returns a selector for captureElementView. null = no open cart panel.
 * Shadow-DOM aware; Playwright CSS locators pierce the open shadow root.
 */
async function detectCartOverlay(page: Page): Promise<string | null> {
  const found = await page
    .evaluate(() => {
      const headRe =
        /(warenkorb|mein korb|einkaufswagen|\bcart\b|basket|shopping bag|your bag|\bbag\b|tasche|\bkorb\b)/i;
      const checkoutRe =
        /(zur kasse|zur kassa|kasse|checkout|bezahlen|proceed to checkout|view (cart|bag)|warenkorb ansehen|go to cart)/i;
      const priceRe = /\d[\d.,]*\s*(€|eur|chf|\$|£)/i;
      const removeRe = /\b(entfernen|löschen|remove|delete)\b/i;

      const all: Element[] = [];
      const stack: Array<Document | ShadowRoot> = [document];
      while (stack.length && all.length < 9000) {
        const root = stack.pop()!;
        for (const el of Array.from(root.querySelectorAll("*"))) {
          all.push(el);
          const sr = (el as HTMLElement).shadowRoot;
          if (sr) stack.push(sr);
          if (all.length >= 9000) break;
        }
      }
      const vw = window.innerWidth || 1280;
      const vh = window.innerHeight || 800;
      const isCartish = (el: Element): boolean => {
        const txt = (el as HTMLElement).innerText || "";
        if (txt.length < 8) return false;
        const head = headRe.test(txt);
        const checkout = checkoutRe.test(txt);
        const price = priceRe.test(txt);
        const qty = !!el.querySelector(
          "input[type=number], [class*='qty' i], [class*='quantity' i], [class*='menge' i]",
        );
        const remove = removeRe.test(txt);
        return checkout || (head && (price || qty || remove));
      };

      let best: { el: Element; score: number; areaFrac: number } | null = null;
      for (const el of all) {
        const s = getComputedStyle(el);
        if (s.display === "none" || s.visibility === "hidden" || parseFloat(s.opacity || "1") < 0.05)
          continue;
        const pos = s.position;
        const dialogish =
          el.getAttribute("role") === "dialog" || el.getAttribute("aria-modal") === "true";
        // A drawer/mini-cart is an OVERLAY (fixed/absolute or a dialog). A cart
        // PAGE is position:static and is handled by full-page capture instead.
        if (pos !== "fixed" && pos !== "absolute" && !dialogish) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 200 || r.height < 150) continue;
        if (r.right < 40 || r.bottom < 40 || r.left > vw - 40 || r.top > vh - 40) continue; // off-screen
        const areaFrac = (r.width * r.height) / (vw * vh);
        if (!isCartish(el)) continue;
        const txt = (el as HTMLElement).innerText || "";
        const z = parseInt(s.zIndex, 10) || 0;
        let score = 0;
        if (checkoutRe.test(txt)) score += 4;
        if (headRe.test(txt)) score += 2;
        if (priceRe.test(txt)) score += 1;
        if (pos === "fixed") score += 1;
        if (z >= 100) score += 1;
        // Prefer a tight drawer panel, but DON'T reject full-screen dialog
        // wrappers (e.g. gymshark's role=dialog modal is 100vw×100vh and holds
        // the real cart panel as a child — we drill into it below).
        if (areaFrac > 0.85) score -= 1;
        if (!best || score > best.score) best = { el, score, areaFrac };
      }
      if (!best || best.score < 4) return false;

      // If the winner is (near-)full-screen, it's a modal/backdrop wrapper —
      // drill in to the actual visible drawer PANEL: the SMALLEST descendant
      // that still carries the cart and is a sensible panel size. Keeps the
      // element screenshot to the real cart, not a dimmed full-page split.
      let target: Element = best.el;
      if (best.areaFrac > 0.7) {
        let panel: { el: Element; area: number } | null = null;
        for (const d of Array.from(best.el.querySelectorAll("*"))) {
          const ds = getComputedStyle(d);
          if (ds.display === "none" || ds.visibility === "hidden") continue;
          const dr = d.getBoundingClientRect();
          if (dr.width < 250 || dr.height < 200) continue;
          const af = (dr.width * dr.height) / (vw * vh);
          if (af > 0.85 || af < 0.05) continue;
          if (!isCartish(d)) continue;
          const area = dr.width * dr.height;
          if (!panel || area < panel.area) panel = { el: d, area };
        }
        if (panel) target = panel.el;
      }
      (target as HTMLElement).setAttribute("data-cs-cart", "1");
      return true;
    })
    .catch(() => false);
  if (!found) return null;
  // Dim any separate backdrop so the element screenshot of the drawer is clean.
  await page
    .addStyleTag({
      content:
        "[class*='overlay' i],[class*='backdrop' i],[class*='drawer__overlay' i],[class*='modal-backdrop' i]{opacity:0!important;background:transparent!important;backdrop-filter:none!important}",
    })
    .catch(() => {});
  return "[data-cs-cart='1']";
}

const CHECKOUT_CTA =
  /(zur kasse(?: gehen)?|weiter zur kasse|zur kassa|zum checkout|checkout|jetzt bezahlen|bezahlen|kostenpflichtig bestellen|proceed to checkout|go to checkout)/i;

/** Click a visible "proceed to checkout" CTA wherever we are (open drawer or
 * cart page) and confirm we landed on a real checkout. Only clicks CHECKOUT
 * CTAs (never "view cart"), so a miss does not navigate us off the cart. */
async function clickCheckoutCtaHere(page: Page): Promise<boolean> {
  const finders: (() => Locator)[] = [
    () => page.getByRole("button", { name: CHECKOUT_CTA }).first(),
    () => page.getByRole("link", { name: CHECKOUT_CTA }).first(),
    () => page.locator("a.begin-checkout-btn, button[name='checkout'], input[name='checkout']").first(),
    () => page.locator("form[action*='/checkout' i] [type=submit], form[action*='/cart' i] [type=submit]").first(),
    () => page.locator("[class*='checkout' i] button, [class*='checkout' i] a[href]").first(),
  ];
  for (const f of finders) {
    try {
      const el = f();
      if (!(await el.count())) continue;
      if (!(await el.isVisible({ timeout: 800 }).catch(() => false))) continue;
      if (!(await robustClick(page, el))) continue;
      await page.waitForTimeout(1400);
      await settlePage(page);
      if (await isCheckoutPage(page)) return true;
    } catch {
      /* next finder */
    }
  }
  return false;
}

/**
 * Reach the checkout — robust across shop systems AND drawer/mini-cart UIs:
 *  1. Click a visible checkout CTA where we are (the open drawer or cart page).
 *  2. Navigate to the REAL cart PAGE (harvested by label, e.g. /Order) — which
 *     reliably carries a "Zur Kasse" CTA — and click checkout there. This is the
 *     key step for shops whose mini-cart only links "view cart", not checkout.
 *  3. Short, verified platform path guesses (a 404 never counts as success).
 * Returns true only on a real checkout (incl. a login wall — valid guest gate).
 */
async function reachCheckout(
  page: Page,
  origin: string,
  cartPageUrl?: string,
): Promise<boolean> {
  await dismissPopups(page);

  // 1) Checkout CTA in the current view (open drawer / current cart page).
  if (await clickCheckoutCtaHere(page)) return true;

  // 2) Go to the given URL (the platform checkout, or the cart page). If it's
  //    already a checkout, we're done; otherwise click its checkout CTA.
  if (cartPageUrl) {
    try {
      const r = await page.goto(cartPageUrl, {
        waitUntil: "domcontentloaded",
        timeout: NAV_TIMEOUT,
      });
      await settlePage(page);
      await dismissConsent(page);
      await dismissPopups(page);
      if ((!r || r.status() < 400) && !(await isErrorPage(page))) {
        if (await isCheckoutPage(page)) return true;
        if (await clickCheckoutCtaHere(page)) return true;
      }
    } catch {
      /* fall through to path guesses */
    }
  }

  // 3) Short, verified platform path guesses.
  const ref = cartPageUrl || page.url();
  const seg = new URL(ref).pathname.split("/").filter(Boolean)[0] ?? "";
  const locale = /^[a-z]{2}(-[a-z]{2})?$/i.test(seg) ? `/${seg}` : "";
  const paths = [
    `${locale}/checkout`,
    "/checkout",
    `${locale}/checkout/confirm`,
    "/checkout/confirm",
    `${locale}/kasse`,
    "/kasse",
  ];
  for (const p of paths) {
    try {
      const r = await page.goto(origin + p, { waitUntil: "domcontentloaded", timeout: 12_000 });
      await page.waitForTimeout(800);
      if (r && r.status() < 400 && (await isCheckoutPage(page))) return true;
    } catch {
      /* next */
    }
  }
  return false;
}

async function buildPage(
  page: Page,
  id: PageType,
  name: string,
  url: string,
  needMobile: boolean,
): Promise<RenderedPage> {
  const desktop = await captureView(page, "desktop");
  // Only capture the MOBILE view (a viewport resize of the same populated page)
  // when the device split actually needs it — saves a full render otherwise.
  let mobile: RenderedView | undefined;
  if (needMobile) {
    try {
      await page.setViewportSize(viewportSize("mobile"));
      await settlePage(page);
      await page.waitForTimeout(500);
      mobile = await captureView(page, "mobile");
    } catch {
      mobile = undefined; // mobile is a bonus dimension; never fail the page on it
    } finally {
      await page.setViewportSize(viewportSize("desktop")).catch(() => {});
    }
  }
  const content = desktop.elements.map((e) => e.text).filter(Boolean).join(" · ").slice(0, 4000);
  return { id, type: id, name, url, desktop, mobile, content, reachable: true };
}

/**
 * UI-heuristic add-to-cart — the fallback when the platform isn't recognised.
 * Choose a variant (programmatic radios/selects), wait for the buy button to
 * render, click it; if a required variant kept it hidden/disabled, real-click a
 * swatch and retry. Returns whether a click was made.
 */
async function heuristicAddToCart(page: Page): Promise<boolean> {
  // Choose a variant if the PDP presents required options (best-effort). Scoped
  // to the product configurator so we never touch a language/currency <select>.
  try {
    await page
      .evaluate(() => {
        const grouped = new Map<string, HTMLInputElement[]>();
        document
          .querySelectorAll<HTMLInputElement>(
            [
              "input[type=radio][name^='option' i]",
              ".product-form__input input[type=radio]",
              "fieldset[class*='variant' i] input[type=radio]",
              ".product-detail-configurator input[type=radio]",
              "[class*='configurator-option' i] input[type=radio]",
              "[class*='configurator-group' i] input[type=radio]",
              "[class*='variant' i] input[type=radio]",
              "[class*='configurator' i] input[type=radio]",
            ].join(","),
          )
          .forEach((r) => {
            const key = r.name || r.getAttribute("data-option-name") || r.id;
            if (!key) return;
            if (!grouped.has(key)) grouped.set(key, []);
            grouped.get(key)!.push(r);
          });
        grouped.forEach((options) => {
          if (options.some((o) => o.checked)) return;
          const first = options.find((o) => !o.disabled);
          if (!first) return;
          first.checked = true;
          first.dispatchEvent(new Event("input", { bubbles: true }));
          first.dispatchEvent(new Event("change", { bubbles: true }));
          first.click();
        });
        document
          .querySelectorAll<HTMLSelectElement>(
            [
              ".product-form select",
              "select[name^='option' i]",
              ".product-detail-configurator select",
              "[class*='configurator' i] select",
              "table.variations select",
              ".product-variations select",
            ].join(","),
          )
          .forEach((s) => {
            if (s.options.length > 1 && s.selectedIndex <= 0) {
              s.selectedIndex = 1;
              s.dispatchEvent(new Event("change", { bubbles: true }));
            }
          });
      })
      .catch(() => {});
    await page.waitForTimeout(1500);
  } catch {
    /* no variant selector — fine */
  }

  // Wait until the buy button has rendered (JS-heavy PDPs render it late).
  await page
    .locator(
      "button:has-text('Warenkorb'), button:has-text('cart'), button:has-text('bag'), button[name='add'], [class*='add-to-cart' i], [class*='addtocart' i], .product-form__submit",
    )
    .first()
    .waitFor({ state: "visible", timeout: 10_000 })
    .catch(() => {});

  // Add to cart FIRST (don't pre-click variants: a size/colour swatch is often a
  // LINK to another variant PDP — clicking it navigates away). Only if the button
  // isn't clickable do we select a variant and retry (covers shops that keep the
  // button hidden/disabled until a size is chosen).
  await fillProductOptions(page);
  let added = await clickAddToCart(page);
  for (let attempt = 0; attempt < 2 && !added; attempt++) {
    await selectVariantSwatches(page);
    await page.waitForTimeout(900);
    await fillProductOptions(page);
    added = await clickAddToCart(page);
  }
  return added;
}

export async function runStatefulFlow(
  browser: Browser,
  pdpUrl: string,
  device: number,
): Promise<StatefulResult> {
  const notes: string[] = [];
  const pages: RenderedPage[] = [];
  // Mobile view is needed when mobile is the primary (>50%) or it's a 50/50 split.
  const needMobile = device >= 50;

  const ctx = await browser.newContext({
    viewport: viewportSize("desktop"),
    locale: "de-DE",
    userAgent: SHOP_UA,
  });
  const page = await ctx.newPage();

  try {
    await page.goto(pdpUrl, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
    await settlePage(page);

    // Bot-challenge interstitial (Cloudflare "Just a moment…", etc.)? Throw so
    // the hybrid withSession() retries the whole stateful flow on Browserbase +
    // residential proxy (where the challenge is solved). On Browserbase this
    // won't fire, so we proceed normally.
    if (await isBotChallenge(page)) throw new BlockedError("bot-challenge");

    await dismissConsent(page);
    // Consent may reload; let the product page settle before interacting.
    await settlePage(page);
    await page.waitForTimeout(500);
    // Marketing popups (e.g. Klaviyo) often appear after a short delay and would
    // intercept the add-to-cart click — close them first.
    await dismissPopups(page);

    // ── ADD TO CART ──────────────────────────────────────────────────────
    // 1) Platform-native (the reliable path): use the shop system's OWN
    //    deterministic cart mechanism (Shopify permalink / Woo query / Shopware
    //    form) instead of clicking the fragile, bot-protected UI button.
    let added = false;
    let platformCartUrl: string | undefined;
    let platformCheckoutUrl: string | undefined;
    const plat = await platformAddToCart(page, pdpUrl).catch(() => null);
    if (plat?.added) {
      added = true;
      platformCartUrl = plat.cartUrl;
      platformCheckoutUrl = plat.checkoutUrl;
      notes.push(
        `Warenkorb über den ${PLATFORM_LABEL[plat.platform]}-Standardmechanismus befüllt (ohne UI-Klick).`,
      );
    }
    // 2) UI heuristic fallback — unknown platform, or the platform add didn't take.
    if (!added) added = await heuristicAddToCart(page);

    if (!added) {
      notes.push(
        (await isBotChallenge(page))
          ? "Warenkorb: Shop hat eine Bot-Prüfung (z. B. Cloudflare) ausgespielt — Add-to-Cart lokal nicht möglich. Mit Stealth-Proxy (Produktion) umgehbar."
          : "Warenkorb: Add-to-Cart nicht möglich (evtl. ausverkauft, Pflicht-Variante oder unbekanntes Shop-System) — nicht analysiert.",
      );
      return { pages, notes };
    }
    // Some shops open a personalization modal on add — fill + confirm it.
    await fillPersonalizationModal(page);
    // Let an off-canvas drawer / mini-cart animate in. IMPORTANT: do NOT run a
    // generic popup-dismiss here — a cart drawer is frequently role=dialog WITH
    // a close button, so dismissing "popups" would throw away the very cart we
    // are trying to capture (this was a root cause of off-canvas carts failing).
    await page.waitForTimeout(1800);

    const pdpParsed = new URL(pdpUrl);
    const origin = pdpParsed.origin;
    const firstSeg = pdpParsed.pathname.split("/").filter(Boolean)[0] ?? "";
    const locale = /^[a-z]{2}(-[a-z]{2})?$/i.test(firstSeg) ? `/${firstSeg}` : "";

    // Harvest the shop's own cart-PAGE link by LABEL (e.g. "Warenkorb (1)" →
    // /Order). Used for the URL fallback AND — crucially — as the reliable place
    // to click "Zur Kasse" for the checkout step (mini-carts often link only
    // "view cart", not checkout).
    const harvestedCartHrefs: string[] = await page
      .evaluate(() => {
        const out: string[] = [];
        const urlRe = /\/(cart|warenkorb|korb|basket|bag|order|checkout\/cart)(\/|\?|#|$|\.aspx)/i;
        const labelRe = /(warenkorb|cart|basket|einkaufswagen|shopping bag|mein korb)/i;
        document.querySelectorAll("a[href]").forEach((a) => {
          const el = a as HTMLAnchorElement;
          const h = el.getAttribute("href") || "";
          if (!h || /add|hinzuf|remove|entfern|login|logout|account|konto|wunsch|wish/i.test(h))
            return;
          const label = `${el.getAttribute("aria-label") || ""} ${el.getAttribute("title") || ""} ${el.textContent || ""}`;
          if (urlRe.test(h) || labelRe.test(label)) out.push(el.href);
        });
        return out;
      })
      .catch(() => [] as string[]);
    const cartPageUrl = harvestedCartHrefs.find((u) => {
      try {
        return new URL(u).origin === origin;
      } catch {
        return false;
      }
    });

    const isCartEmpty = (): Promise<boolean> =>
      page
        .evaluate(() =>
          /(dein warenkorb ist leer|ihr warenkorb ist leer|warenkorb.{0,25}(ist |sind )?(noch )?leer|cart is empty|your (shopping )?cart is empty|es befinden sich.{0,30}keine|keine (produkte|artikel|waren).{0,30}warenkorb|noch keine (artikel|produkte|waren))/i.test(
            (document.body.innerText || "").slice(0, 2000).toLowerCase(),
          ),
        )
        .catch(() => false);

    // Capture an open drawer/mini-cart as a clean ELEMENT screenshot.
    const pushDrawer = async (sel: string): Promise<boolean> => {
      // Capture the drawer at DESKTOP (reliable). For a mobile-primary analysis
      // ALSO capture it at MOBILE, so the report frames it in the SAME iPhone
      // mockup as the other pages (consistent sizing). Desktop is the fallback
      // if the mobile re-capture fails (e.g. the drawer reflows away on resize).
      const desktopView = await captureElementView(page, sel, "desktop");
      let mobileView: RenderedView | undefined;
      if (needMobile) {
        try {
          await page.setViewportSize(viewportSize("mobile"));
          await settlePage(page);
          await page.waitForTimeout(400);
          mobileView = (await captureElementView(page, sel, "mobile")) ?? undefined;
        } catch {
          mobileView = undefined;
        } finally {
          await page.setViewportSize(viewportSize("desktop")).catch(() => {});
          await settlePage(page).catch(() => {});
        }
      }
      const hasMobile = !!mobileView && mobileView.elements.length >= 3;
      const base = hasMobile ? mobileView! : desktopView;
      if (!base || base.elements.length < 3) return false;
      const content = base.elements.map((e) => e.text).filter(Boolean).join(" · ").slice(0, 4000);
      pages.push({
        id: "cart",
        type: "cart",
        name: "Warenkorb",
        url: page.url(),
        desktop: desktopView ?? base,
        mobile: hasMobile ? mobileView : undefined,
        content,
        reachable: true,
      });
      return true;
    };

    let cartReached = false;
    let sawEmptyCart = false;

    // 0) Platform-native cart PAGE (deterministic URL). After a platform add the
    //    item is guaranteed in the cart, so this is the most reliable capture.
    if (platformCartUrl) {
      try {
        const resp = await page.goto(platformCartUrl, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
        await settlePage(page);
        await dismissConsent(page);
        if (
          (!resp || resp.status() < 400) &&
          !(await isErrorPage(page)) &&
          !(await isCartEmpty()) &&
          (await isCartPopulated(page))
        ) {
          pages.push(await buildPage(page, "cart", "Warenkorb", page.url(), needMobile));
          cartReached = true;
        }
      } catch {
        /* fall through to interaction-based capture */
      }
    }

    // The remaining steps reach the cart the way a SHOPPER does — by INTERACTION,
    // not URL guessing — and are the fallback for unknown platforms.
    let drawerSel: string | null = null;

    // 1) Did add-to-cart auto-open an off-canvas drawer / mini-cart? Capture it.
    if (!cartReached) {
      drawerSel = await detectCartOverlay(page);
      if (drawerSel && (await pushDrawer(drawerSel))) {
        cartReached = true;
        notes.push("Warenkorb als Off-Canvas/Mini-Cart erfasst — so, wie ihn der Kunde sieht.");
      }
    }

    // 2) Otherwise click the cart icon and capture WHATEVER surfaces — a drawer
    //    that opens, or the cart PAGE it navigates to.
    if (!cartReached) {
      const beforeUrl = page.url();
      if (await clickCartControl(page)) {
        await settlePage(page);
        await page.waitForTimeout(1200);
        drawerSel = await detectCartOverlay(page);
        if (drawerSel && (await pushDrawer(drawerSel))) {
          cartReached = true;
          notes.push("Warenkorb über das Warenkorb-Symbol geöffnet und erfasst.");
        } else if (page.url() !== beforeUrl && !(await isErrorPage(page))) {
          if (await isCartEmpty()) sawEmptyCart = true;
          else if (await isCartPopulated(page)) {
            pages.push(await buildPage(page, "cart", "Warenkorb", page.url(), needMobile));
            cartReached = true;
          }
        }
      }
    }

    // 3) Last-resort fallback: conventional cart URLs (kept for shops where the
    //    cart icon isn't reliably clickable). Reuses the label-harvested links
    //    (e.g. parfumdreams → /Order). All 404 / empty pages rejected.
    if (!cartReached) {
      const cartCandidates = [
        ...new Set([
          ...harvestedCartHrefs,
          `${origin}${locale}/cart`,
          `${origin}/cart`,
          `${origin}${locale}/checkout/cart`,
          `${origin}/checkout/cart`,
          `${origin}${locale}/warenkorb`,
          `${origin}/warenkorb`,
        ]),
      ].filter((u) => {
        try {
          return new URL(u).origin === origin;
        } catch {
          return false;
        }
      });

      for (const cu of cartCandidates) {
        try {
          const resp = await page.goto(cu, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
          await settlePage(page);
          await dismissConsent(page);
          // Reject 404/error pages FIRST: a not-found page still carries the
          // header's cart+checkout links, which would otherwise make
          // isCartPopulated() report a populated cart. HTTP status catches hard
          // 404s; isErrorPage() catches soft-404s served with status 200.
          if (resp && resp.status() >= 400) continue;
          if (await isErrorPage(page)) continue;
          if (await isCartEmpty()) {
            sawEmptyCart = true;
            continue;
          }
          if (await isCartPopulated(page)) {
            pages.push(await buildPage(page, "cart", "Warenkorb", page.url(), needMobile));
            cartReached = true;
            break;
          }
        } catch {
          /* try next candidate */
        }
      }
    }

    if (!cartReached) {
      notes.push(
        sawEmptyCart
          ? "Warenkorb blieb leer — das Produkt ließ sich nicht hinzufügen (vermutlich Pflicht-Variante oder Personalisierung erforderlich). Warenkorb & Checkout nicht analysiert."
          : "Warenkorb: nicht erreichbar — weder ein Off-Canvas-Warenkorb noch eine Warenkorb-Seite ließen sich öffnen. Nicht analysiert.",
      );
      return { pages, notes };
    }

    // Proceed toward checkout — capture the FIRST checkout screen, no input.
    // Prefer the platform's deterministic checkout URL; else the harvested cart
    // page (where "Zur Kasse" reliably lives).
    const wentToCheckout = await reachCheckout(page, origin, platformCheckoutUrl ?? cartPageUrl);
    if (!wentToCheckout) {
      notes.push(
        "Checkout: nicht erreichbar — der Kassen-Einstieg ist JS-/Login-gesteuert und nicht automatisch ansteuerbar. Nicht analysiert.",
      );
      return { pages, notes };
    }
    await page.waitForTimeout(1500);

    // Don't present a 404 / error page as the checkout (some shops route a bad
    // /checkout guess to a not-found page). Report it honestly instead.
    if (await isErrorPage(page)) {
      notes.push(
        "Checkout: führte auf eine Fehlerseite (404) — nicht erreichbar, nicht analysiert.",
      );
      return { pages, notes };
    }

    const bodyText = (await page.evaluate(() => document.body.innerText || "")).slice(0, 5000);
    const hasPasswordField = await page.locator("input[type=password]").count();
    if (hasPasswordField > 0 && LOGIN_WALL.test(bodyText)) {
      notes.push("Checkout: nur nach Login/Kontoerstellung erreichbar — vor Dateneingabe gestoppt.");
    }
    // Capture the checkout entry screen WITHOUT entering any data.
    pages.push(await buildPage(page, "checkout", "Checkout", page.url(), needMobile));

    return { pages, notes };
  } catch (err) {
    // A bot/IP block must PROPAGATE so the hybrid withSession() can retry the
    // whole flow on Browserbase + proxy — don't swallow it into a note. (The
    // finally below still closes the context.)
    if (isBlockError(err)) throw err;
    notes.push(
      `Stateful-Flow abgebrochen: ${err instanceof Error ? err.message : "unbekannt"}.`,
    );
    return { pages, notes };
  } finally {
    await ctx.close().catch(() => {});
  }
}

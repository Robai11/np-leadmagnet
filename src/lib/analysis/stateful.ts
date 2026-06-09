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
} from "@/lib/analysis/render";

/** Off-canvas / mini-cart drawer containers across the common platforms. */
const DRAWER_SELECTOR =
  "cart-drawer, [class*='cart-drawer' i], #CartDrawer, [class*='mini-cart' i], [class*='minicart' i], [class*='offcanvas' i][class*='cart' i], [class*='drawer' i][class*='cart' i], [class*='cart' i][class*='drawer' i], .offcanvas-cart, .cart-offcanvas";

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
    const h1 = (
      await page.evaluate(() => document.querySelector("h1")?.textContent || "")
    ).toLowerCase();
    const hay = `${title} ${h1}`;
    return /\b404\b|seite (wurde )?nicht gefunden|\bnicht gefunden\b|page not found|not found|fehler 404/.test(
      hay,
    );
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

/** Re-open the off-canvas cart drawer (shops without a dedicated cart page). */
async function openCartDrawer(page: Page, pdpUrl: string): Promise<boolean> {
  try {
    const origin = new URL(pdpUrl).origin;
    if (!page.url().startsWith(origin)) {
      await page.goto(pdpUrl, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
      await settlePage(page);
    }
    await dismissPopups(page);
    const toggles = [
      "[aria-label*='warenkorb' i]",
      "[aria-label*='cart' i]",
      "[class*='cart-icon' i]",
      "[class*='cart' i][class*='toggle' i]",
      "header a[href$='/cart' i]",
      "a[href$='/cart' i]",
    ];
    for (const sel of toggles) {
      try {
        const el = page.locator(sel).first();
        if ((await el.count()) && (await el.isVisible({ timeout: 700 }))) {
          await el.click({ timeout: 1500, force: true });
          break;
        }
      } catch {
        /* next */
      }
    }
    await page.waitForTimeout(1200);
    const drawer = page
      .locator(
        "cart-drawer, [class*='cart-drawer' i], #CartDrawer, [class*='mini-cart' i], [class*='minicart' i], [class*='offcanvas' i][class*='cart' i], [class*='drawer' i][class*='cart' i]",
      )
      .first();
    const visible = await drawer.isVisible({ timeout: 1500 }).catch(() => false);
    if (!visible) return false;
    // Hide the dimmed backdrop so the captured screenshot shows the cart cleanly.
    await page
      .addStyleTag({
        content:
          "[class*='overlay' i],[class*='backdrop' i],.drawer__overlay,[class*='drawer__overlay' i]{opacity:0!important;background:transparent!important;backdrop-filter:none!important}",
      })
      .catch(() => {});
    return true;
  } catch {
    return false;
  }
}

/**
 * Proceed from cart to checkout. Strategies in order: link-href navigation
 * (Shopware/Woo), form-submit (Shopify cart), then a direct /checkout hit
 * (Shopify uses the cart cookie), then accessible-name as a last resort.
 */
async function clickToCheckout(page: Page, origin: string): Promise<boolean> {
  await dismissPopups(page);
  for (const sel of [
    "a.begin-checkout-btn",
    "a[href*='/checkout/confirm' i]",
    "a[href*='/checkout/register' i]",
    "a[href*='/checkout/onepage' i]",
  ]) {
    try {
      const el = page.locator(sel).first();
      if (!(await el.count())) continue;
      const href = await el.getAttribute("href");
      if (href) {
        await page.goto(new URL(href, page.url()).toString(), {
          waitUntil: "domcontentloaded",
          timeout: NAV_TIMEOUT,
        });
        await settlePage(page);
        return true;
      }
    } catch {
      /* next */
    }
  }
  for (const sel of [
    "button[name='checkout']",
    "input[name='checkout']",
    "form[action*='/cart' i] button[type=submit]",
    "form[action*='checkout' i] button[type=submit]",
    ".checkout-aside-action button",
  ]) {
    try {
      const el = page.locator(sel).first();
      if (!(await el.count()) || !(await el.isVisible({ timeout: 800 }))) continue;
      if (await robustClick(page, el)) {
        await settlePage(page);
        return true;
      }
    } catch {
      /* next */
    }
  }
  // Platform fallback: go straight to /checkout (Shopify resolves via the cart
  // cookie). Guarded so a redirect back to cart/home doesn't count as success.
  try {
    await page.goto(`${origin}/checkout`, {
      waitUntil: "domcontentloaded",
      timeout: NAV_TIMEOUT,
    });
    await settlePage(page);
    const body = (await page.evaluate(() => document.body.innerText || "")).slice(0, 1200);
    if (
      /\/checkout/i.test(page.url()) ||
      /(versand|lieferung|zahlung|rechnungsadresse|e-?mail|kontaktdaten|kasse)/i.test(body)
    ) {
      return true;
    }
  } catch {
    /* fall through */
  }
  return clickByText(page, GO_TO_CHECKOUT, 2500);
}

async function buildPage(
  page: Page,
  id: PageType,
  name: string,
  url: string,
): Promise<RenderedPage> {
  const desktop = await captureView(page, "desktop");
  // Capture a MOBILE view of the SAME (still-populated) page by resizing the
  // viewport in-session — so cart & checkout get both views like read-only
  // pages do (the report frames them per the device split).
  let mobile: RenderedView | undefined;
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
  const content = desktop.elements.map((e) => e.text).filter(Boolean).join(" · ").slice(0, 4000);
  return { id, type: id, name, url, desktop, mobile, content, reachable: true };
}

/** Wrap an already-captured view (e.g. an off-canvas drawer) into a page. */
function buildPageFromView(
  view: RenderedView,
  id: PageType,
  name: string,
  url: string,
): RenderedPage {
  const content = view.elements.map((e) => e.text).filter(Boolean).join(" · ").slice(0, 4000);
  return { id, type: id, name, url, desktop: view, content, reachable: true };
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
      // Select ONE value per option group (Shopify needs a full variant before
      // it will add). Radios grouped by name, plus any <select> options.
      await page
        .evaluate(() => {
          const seen = new Set<string>();
          document
            .querySelectorAll<HTMLInputElement>(
              "input[type=radio][name^='option' i], .product-form__input input[type=radio], fieldset[class*='variant' i] input[type=radio], .product-detail-configurator input[type=radio]",
            )
            .forEach((r) => {
              if (seen.has(r.name)) return;
              seen.add(r.name);
              r.checked = true;
              r.dispatchEvent(new Event("input", { bubbles: true }));
              r.dispatchEvent(new Event("change", { bubbles: true }));
              r.click();
            });
          document
            .querySelectorAll<HTMLSelectElement>(
              ".product-form select, select[name^='option' i], .product-detail-configurator select",
            )
            .forEach((s) => {
              if (s.options.length > 1 && s.selectedIndex <= 0) {
                s.selectedIndex = 1;
                s.dispatchEvent(new Event("change", { bubbles: true }));
              }
            });
        })
        .catch(() => {});
      await page.waitForTimeout(600);
    } catch {
      /* no variant selector — fine */
    }

    await fillProductOptions(page);
    const added = await clickAddToCart(page);
    if (!added) {
      notes.push("Warenkorb: Add-to-Cart nicht auffindbar (evtl. ausverkauft) — nicht analysiert.");
      return { pages, notes };
    }
    // Some shops open a personalization modal on add — fill + confirm it.
    await fillPersonalizationModal(page);
    await page.waitForTimeout(1800);
    await dismissPopups(page);

    const pdpParsed = new URL(pdpUrl);
    const origin = pdpParsed.origin;
    const firstSeg = pdpParsed.pathname.split("/").filter(Boolean)[0] ?? "";
    const locale = /^[a-z]{2}(-[a-z]{2})?$/i.test(firstSeg) ? `/${firstSeg}` : "";

    // Cart-page candidates: links surfaced by the open drawer/header first
    // (e.g. Shopify "View cart" → /cart), then conventional paths. We accept the
    // first that is actually a POPULATED cart — never an empty cart or a 404.
    const drawerCartHrefs: string[] = await page
      .evaluate(() => {
        const out: string[] = [];
        document.querySelectorAll("a[href]").forEach((a) => {
          const h = (a as HTMLAnchorElement).getAttribute("href") || "";
          if (/\/(cart|warenkorb|checkout\/cart)(\/|\?|$)/i.test(h) && !/add/i.test(h)) {
            out.push((a as HTMLAnchorElement).href);
          }
        });
        return out;
      })
      .catch(() => [] as string[]);

    const cartCandidates = [
      ...new Set([
        ...drawerCartHrefs,
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

    let cartReached = false;
    let sawEmptyCart = false;
    for (const cu of cartCandidates) {
      try {
        await page.goto(cu, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
        await settlePage(page);
        await dismissConsent(page);
        await dismissPopups(page);
        const empty = await page.evaluate(() =>
          /(dein warenkorb ist leer|warenkorb.{0,15}(ist )?leer|cart is empty|your (shopping )?cart is empty)/i.test(
            (document.body.innerText || "").toLowerCase(),
          ),
        );
        if (empty) {
          sawEmptyCart = true;
          continue;
        }
        if (await isCartPopulated(page)) {
          cartReached = true;
          break;
        }
      } catch {
        /* try next candidate */
      }
    }

    if (cartReached) {
      // A real, populated cart PAGE (the richest, cleanest cart view).
      pages.push(await buildPage(page, "cart", "Warenkorb", page.url()));
    } else {
      // No usable cart PAGE → true off-canvas-only shop. Re-open the drawer and
      // capture JUST the drawer panel cleanly (element screenshot), so the cart
      // is analyzed as the real off-canvas UX — not a dimmed full-page split.
      const opened = await openCartDrawer(page, pdpUrl);
      if (opened) {
        const dv = await captureElementView(page, DRAWER_SELECTOR, "desktop");
        if (dv && dv.elements.length >= 4) {
          notes.push("Warenkorb als Off-Canvas erfasst — dieser Shop hat keine eigene Warenkorb-Seite.");
          pages.push(buildPageFromView(dv, "cart", "Warenkorb", page.url()));
        } else {
          notes.push("Warenkorb (Off-Canvas) erfasst.");
          pages.push(await buildPage(page, "cart", "Warenkorb", page.url()));
        }
      } else {
        notes.push(
          sawEmptyCart
            ? "Warenkorb blieb leer — das Produkt ließ sich nicht hinzufügen (vermutlich Pflicht-Variante oder Personalisierung erforderlich). Warenkorb & Checkout nicht analysiert."
            : "Warenkorb: weder Warenkorb-Seite noch Off-Canvas-Warenkorb erreichbar — nicht analysiert.",
        );
        return { pages, notes };
      }
    }

    // Proceed toward checkout — capture the FIRST checkout screen, no input.
    const wentToCheckout = await clickToCheckout(page, origin);
    if (!wentToCheckout) {
      notes.push("Checkout: kein „Zur Kasse“-Einstieg gefunden — nicht analysiert.");
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

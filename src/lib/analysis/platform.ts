/*
 * Platform-native funnel entry (the reliable path).
 *
 * Instead of CLICKING the add-to-cart button — the most shop-specific, most
 * bot-protected, most fragile UI on the page — we detect the shop's e-commerce
 * platform and use ITS deterministic, documented mechanism to put a product in
 * the cart. This sidesteps variant guessing, SPA click handlers and silent
 * bot-blocks for the large majority of shops (Shopify / WooCommerce / Shopware).
 *
 *   Shopify     → /cart/{variantId}:1   (variant id from /products/{handle}.js)
 *   WooCommerce → ?add-to-cart={productId}
 *   Shopware 6  → submit the real /checkout/line-item/add form (incl. CSRF)
 *
 * Returns the platform + (when added) the known cart/checkout URLs. The caller
 * captures those pages with the normal render pipeline. Unknown platform or a
 * failure → returns added:false so the caller falls back to the UI heuristic.
 */

import type { Page } from "playwright-core";
import { NAV_TIMEOUT, settlePage } from "@/lib/analysis/render";

export type Platform = "shopify" | "woocommerce" | "shopware" | "magento" | "unknown";

export interface PlatformResult {
  platform: Platform;
  added: boolean;
  cartUrl?: string;
  checkoutUrl?: string;
}

export const PLATFORM_LABEL: Record<Platform, string> = {
  shopify: "Shopify",
  woocommerce: "WooCommerce",
  shopware: "Shopware",
  magento: "Magento",
  unknown: "—",
};

/** Detect the shop platform from page fingerprints (runs on the loaded PDP). */
export async function detectPlatform(page: Page): Promise<Platform> {
  return page
    .evaluate(() => {
      const w = window as unknown as Record<string, unknown>;
      const html = document.documentElement.innerHTML;
      const hasForm = (re: RegExp) =>
        [...document.querySelectorAll("form")].some((f) => re.test(f.getAttribute("action") || ""));

      if (w.Shopify || /cdn\.shopify\.com|\/cdn\/shop\//.test(html)) return "shopify";
      if (
        /\bwoocommerce(-page)?\b/.test(document.body.className) ||
        w.wc_add_to_cart_params ||
        w.woocommerce_params ||
        /wp-content\/plugins\/woocommerce/.test(html)
      )
        return "woocommerce";
      if (
        hasForm(/\/checkout\/line-item\/add/i) ||
        /\/checkout\/line-item\/add/.test(html) ||
        /\/bundles\/storefront\/|window\.PluginManager|data-cms-page-id|csrf\/generate/.test(html) ||
        document.querySelector("[data-cms-page-id], .cms-page, .product-detail-buy-container")
      )
        return "shopware";
      if (
        w.Magento ||
        document.querySelector("script[type='text/x-magento-init']") ||
        /\/static\/(version\d+\/)?frontend\/|Magento_/.test(html)
      )
        return "magento";
      return "unknown";
    })
    .catch(() => "unknown" as Platform);
}

/** Read Shopify cart item_count for the current session (same-origin fetch). */
async function shopifyCartCount(page: Page): Promise<number> {
  return page
    .evaluate(async () => {
      try {
        const r = await fetch("/cart.js", { headers: { accept: "application/json" } });
        if (!r.ok) return 0;
        const j = (await r.json()) as { item_count?: number };
        return j.item_count ?? 0;
      } catch {
        return 0;
      }
    })
    .catch(() => 0);
}

async function shopifyAdd(page: Page, pdpUrl: string): Promise<PlatformResult> {
  const origin = new URL(pdpUrl).origin;
  // 1) Resolve a variant id (no UI). Prefer the product .js (has availability);
  //    fall back to the in-page ShopifyAnalytics meta, which works regardless of
  //    the URL shape (custom /p/ rewrites, locale prefixes, …).
  const vid = await page
    .evaluate(async () => {
      const tryFetch = async (path: string) => {
        try {
          const r = await fetch(path, { headers: { accept: "application/json" } });
          if (!r.ok) return null;
          return (await r.json()) as { variants?: { id: number; available?: boolean }[] };
        } catch {
          return null;
        }
      };
      const clean = location.pathname.split("?")[0].replace(/\/$/, "");
      const handle =
        clean.match(/\/(?:products|p)\/([^/]+)/)?.[1] || clean.split("/").filter(Boolean).pop();
      const candidates = [clean + ".js", handle ? `/products/${handle}.js` : null].filter(
        Boolean,
      ) as string[];
      for (const path of candidates) {
        const data = await tryFetch(path);
        const vs = data?.variants;
        if (vs?.length) return (vs.find((v) => v.available) ?? vs[0]).id;
      }
      // Fallback: variant ids from the storefront analytics meta.
      const w = window as unknown as {
        ShopifyAnalytics?: { meta?: { product?: { variants?: { id: number }[] } } };
        meta?: { product?: { variants?: { id: number }[] } };
      };
      const metaVs = w.ShopifyAnalytics?.meta?.product?.variants || w.meta?.product?.variants;
      return metaVs?.[0]?.id ?? null;
    })
    .catch(() => null);
  if (!vid) return { platform: "shopify", added: false };

  // 2) Deterministic add via cart permalink — no button, no JS handler.
  await page
    .goto(`${origin}/cart/${vid}:1`, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT })
    .catch(() => {});
  await settlePage(page);
  if ((await shopifyCartCount(page)) < 1) return { platform: "shopify", added: false };

  return {
    platform: "shopify",
    added: true,
    cartUrl: `${origin}/cart`,
    checkoutUrl: `${origin}/checkout`,
  };
}

async function wooAdd(page: Page, pdpUrl: string): Promise<PlatformResult> {
  const origin = new URL(pdpUrl).origin;
  // Variable products need a chosen variation_id — skip to the UI heuristic.
  const info = await page
    .evaluate(() => {
      const variable = !!document.querySelector(".variations_form, form.variations_form");
      const btn = document.querySelector(
        "button[name='add-to-cart'], input[name='add-to-cart'], .single_add_to_cart_button[value]",
      ) as HTMLButtonElement | HTMLInputElement | null;
      let id = btn?.value || "";
      if (!id) {
        const m = document.body.className.match(/postid-(\d+)/);
        id = m?.[1] || "";
      }
      if (!id) {
        const inp = document.querySelector(
          "input[name='product_id'], input.product_id",
        ) as HTMLInputElement | null;
        id = inp?.value || "";
      }
      return { variable, id };
    })
    .catch(() => ({ variable: true, id: "" }));
  if (info.variable || !info.id) return { platform: "woocommerce", added: false };

  await page
    .goto(`${origin}/?add-to-cart=${info.id}`, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT })
    .catch(() => {});
  await settlePage(page);
  // No standard JSON cart on Woo — let the caller verify by loading the cart
  // page. We just hand back the conventional Woo URLs.
  return {
    platform: "woocommerce",
    added: true,
    cartUrl: `${origin}/cart/`,
    checkoutUrl: `${origin}/checkout/`,
  };
}

async function shopwareAdd(page: Page, pdpUrl: string): Promise<PlatformResult> {
  const origin = new URL(pdpUrl).origin;
  // Submit the real line-item/add form (carries product id + CSRF + redirect).
  // A full-page POST works even when the AJAX off-canvas JS doesn't fire.
  const submitted = await page
    .evaluate(() => {
      const form = [...document.querySelectorAll("form")].find((f) =>
        /\/checkout\/line-item\/add/i.test(f.getAttribute("action") || ""),
      ) as HTMLFormElement | undefined;
      if (!form) return false;
      // Ensure a quantity of 1 if a qty field exists and is empty.
      const qty = form.querySelector("input[name*='quantity' i]") as HTMLInputElement | null;
      if (qty && !qty.value) qty.value = "1";
      if (typeof form.requestSubmit === "function") form.requestSubmit();
      else form.submit();
      return true;
    })
    .catch(() => false);
  if (!submitted) return { platform: "shopware", added: false };

  await page.waitForLoadState("domcontentloaded", { timeout: NAV_TIMEOUT }).catch(() => {});
  await settlePage(page);
  return {
    platform: "shopware",
    added: true,
    cartUrl: `${origin}/checkout/cart`,
    checkoutUrl: `${origin}/checkout/confirm`,
  };
}

/**
 * Detect the platform and add a product to the cart deterministically. The
 * caller verifies + captures the returned cart/checkout URLs. added:false →
 * fall back to the UI heuristic.
 */
export async function platformAddToCart(page: Page, pdpUrl: string): Promise<PlatformResult> {
  const platform = await detectPlatform(page);
  try {
    if (platform === "shopify") return await shopifyAdd(page, pdpUrl);
    if (platform === "woocommerce") return await wooAdd(page, pdpUrl);
    if (platform === "shopware") return await shopwareAdd(page, pdpUrl);
  } catch {
    /* fall through */
  }
  return { platform, added: false };
}

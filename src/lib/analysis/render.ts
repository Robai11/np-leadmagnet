/*
 * Render layer (Build-Spec §4). Per page + viewport: dismiss consent, scroll to
 * trigger lazy-loading, take a full-page screenshot, and enumerate candidate
 * elements with absolute document bounding boxes + text. The bounding boxes are
 * the ground truth for pin geometry; the model never guesses coordinates.
 */

import type { Browser, Page } from "playwright-core";
import type { PageType, Viewport } from "@/lib/types";
import type { EnumeratedElement, RenderedView, RenderedPage } from "@/lib/analysis/pipeline-types";

const VIEWPORTS: Record<Viewport, { width: number; height: number }> = {
  desktop: { width: 1280, height: 800 },
  mobile: { width: 390, height: 844 },
};

const NAV_TIMEOUT = 30_000;

/** Wait for client-side redirects / hydration to settle before reading the DOM. */
async function settlePage(page: Page): Promise<void> {
  try {
    await page.waitForLoadState("domcontentloaded", { timeout: 5_000 });
  } catch {
    /* ignore */
  }
  try {
    await page.waitForLoadState("networkidle", { timeout: 8_000 });
  } catch {
    /* networkidle may never fire on chatty pages — fine */
  }
}

/**
 * page.evaluate that survives mid-read navigations. Real shops fire client-side
 * redirects / lazy hydration that destroy the execution context; on that
 * specific error we let the page settle and retry instead of failing the page.
 */
async function evalWithRetry<R>(
  page: Page,
  fn: () => R | Promise<R>,
  tries = 3,
): Promise<R> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      return await page.evaluate(fn);
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      if (/execution context was destroyed|navigation|frame was detached|target closed/i.test(msg)) {
        await settlePage(page);
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

// Hosts/containers of the common consent CMPs — hidden as a fallback so the
// banner never lands in the screenshot (Build-Spec §4 permits hiding it).
const CONSENT_HIDE_CSS = `
  #usercentrics-root, #usercentrics-cmp-ui, [id*='usercentrics' i],
  #onetrust-consent-sdk, #onetrust-banner-sdk, .onetrust-pc-dark-filter,
  #CybotCookiebotDialog, #CybotCookiebotDialogBodyUnderlay,
  #cookiescript_injected, #cookiescript_injected_wrapper,
  .cmplz-cookiebanner, #cmplz-cookiebanner-container, .cmplz-overlay,
  .klaro, #klaro, .cookie-notice, #cookie-notice, #cookie-law-info-bar,
  .cc-window, .cc-banner, [id^='sp_message_container'],
  [class*='cookie-permission' i], [class*='cookie-banner' i], [id*='cookie-banner' i],
  [class*='cookieconsent' i], [id*='cookieconsent' i], [class*='cookie-consent' i],
  [aria-label*='cookie' i][role='dialog'], [aria-label*='consent' i][role='dialog'] {
    display: none !important; visibility: hidden !important; pointer-events: none !important;
  }
  html, body { overflow: auto !important; }
`;

async function dismissConsent(page: Page): Promise<void> {
  // 1) Try to ACCEPT via known CMP buttons, then accessible-name heuristics.
  const acceptSelectors = [
    "#onetrust-accept-btn-handler",
    "#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll",
    "#CybotCookiebotDialogBodyButtonAccept",
    "#cookiescript_accept",
    "[data-testid='uc-accept-all-button']",
    ".cmplz-accept",
    ".cookie-permission--accept-button",
    ".js-cookie-permission-button",
    "[aria-label*='akzeptier' i]",
    "[aria-label*='accept all' i]",
  ];
  for (const sel of acceptSelectors) {
    try {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 500 })) {
        await el.click({ timeout: 1500, force: true });
        break;
      }
    } catch {
      /* keep trying */
    }
  }
  try {
    const byText = page
      .getByRole("button", {
        name: /(alle(s)? )?(akzeptieren|annehmen|zustimmen|einverstanden|verstanden|allow all|accept all|accept|got it|agree)/i,
      })
      .first();
    if (await byText.isVisible({ timeout: 500 })) {
      await byText.click({ timeout: 1500, force: true }).catch(() => {});
    }
  } catch {
    /* none found — fine */
  }

  // 2) Hide any consent UI still present and release scroll-lock, so the
  //    screenshot is clean even when the accept button couldn't be matched.
  await page.addStyleTag({ content: CONSENT_HIDE_CSS }).catch(() => {});
}

async function autoScroll(page: Page): Promise<void> {
  // Step to the bottom to trigger lazy-loaded content, then back to top.
  // Lazy-load is a bonus; if a navigation interrupts it, don't fail the page.
  try {
    await evalWithRetry(page, async () => {
      await new Promise<void>((resolve) => {
        let total = 0;
        const step = 600;
        const timer = setInterval(() => {
          window.scrollBy(0, step);
          total += step;
          if (total >= document.body.scrollHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 120);
      });
    });
    await page.waitForTimeout(600);
    await evalWithRetry(page, () => window.scrollTo(0, 0));
    await page.waitForTimeout(200);
  } catch {
    /* scrolling is best-effort; proceed with whatever is loaded */
  }
}

/** Runs in the browser: enumerate candidate elements + document dimensions. */
function enumerateInPage(): {
  docWidth: number;
  docHeight: number;
  elements: EnumeratedElement[];
} {
  const doc = document.documentElement;
  const docWidth = Math.max(doc.scrollWidth, doc.clientWidth);
  const docHeight = Math.max(doc.scrollHeight, doc.clientHeight);
  const priceRe = /(\d{1,4}[.,]\d{2})\s*(€|eur|chf|\$)|(€|chf|\$)\s*\d/i;

  const candidates = new Set<Element>();
  const sel =
    "a,button,[role=button],input,select,textarea,h1,h2,h3,img,[class*='price' i],[class*='cta' i],[class*='cart' i]";
  document.querySelectorAll(sel).forEach((el) => candidates.add(el));
  // Price-like text nodes.
  document.querySelectorAll("span,div,p,strong,b").forEach((el) => {
    const t = (el as HTMLElement).innerText || "";
    if (t.length < 40 && priceRe.test(t)) candidates.add(el);
  });

  const out: EnumeratedElement[] = [];
  let i = 0;
  candidates.forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) return;
    const style = getComputedStyle(el);
    if (style.visibility === "hidden" || style.display === "none") return;
    const he = el as HTMLElement;
    let text = (he.innerText || he.textContent || "").trim().replace(/\s+/g, " ");
    if (!text) {
      text =
        he.getAttribute("aria-label") ||
        he.getAttribute("alt") ||
        he.getAttribute("placeholder") ||
        he.getAttribute("name") ||
        "";
    }
    out.push({
      id: `el-${i++}`,
      tag: el.tagName.toLowerCase(),
      role: el.getAttribute("role") ?? undefined,
      text: text.slice(0, 140),
      x: Math.round(r.left + window.scrollX),
      y: Math.round(r.top + window.scrollY),
      w: Math.round(r.width),
      h: Math.round(r.height),
    });
  });

  // Cap to the largest/most-prominent candidates to keep the prompt bounded.
  out.sort((a, b) => b.w * b.h - a.w * a.h);
  return { docWidth, docHeight, elements: out.slice(0, 60) };
}

/**
 * Capture the CURRENT page state (scroll for lazy-load, enumerate, screenshot).
 * Used both by renderView and by the stateful flow, which navigates within one
 * page and captures at cart/checkout without creating fresh contexts.
 */
export async function captureView(
  page: Page,
  viewport: Viewport,
): Promise<RenderedView> {
  await settlePage(page);
  await autoScroll(page);
  // Wait for (lazy-loaded) images to finish so the screenshot has real content
  // — a half-loaded page makes the Vision model find fewer/no levers.
  await evalWithRetry(page, () =>
    Promise.all(
      Array.from(document.images)
        .filter((img) => !img.complete)
        .slice(0, 50)
        .map(
          (img) =>
            new Promise<void>((res) => {
              img.addEventListener("load", () => res(), { once: true });
              img.addEventListener("error", () => res(), { once: true });
              setTimeout(res, 2500);
            }),
        ),
    ).then(() => undefined),
  ).catch(() => {});
  await page.waitForTimeout(300);
  const { docWidth, docHeight, elements } = await evalWithRetry(page, enumerateInPage);
  // JPEG keeps the full-page payload small enough for the Vision API; the pin
  // overlay is positioned from real bounding boxes, so screenshot fidelity only
  // affects how well the model judges severity, not pin accuracy.
  const screenshot = (await page.screenshot({
    fullPage: true,
    type: "jpeg",
    quality: 80,
  })) as Buffer;
  return { viewport, screenshot, docWidth, docHeight, elements };
}

/**
 * Capture ONE element (e.g. an off-canvas cart drawer) as a clean screenshot +
 * enumerate the candidate elements WITHIN it, with bounding boxes relative to
 * the element. Used to analyze off-canvas carts as the real cart UX instead of
 * a dimmed full-page split.
 */
export async function captureElementView(
  page: Page,
  selector: string,
  viewport: Viewport,
): Promise<RenderedView | null> {
  const el = page.locator(selector).first();
  if (!(await el.count())) return null;
  if (!(await el.isVisible({ timeout: 1000 }).catch(() => false))) return null;
  await el.scrollIntoViewIfNeeded({ timeout: 1500 }).catch(() => {});

  const meta = await el
    .evaluate((root: Element) => {
      const rect = root.getBoundingClientRect();
      const priceRe = /(\d{1,4}[.,]\d{2})\s*(€|eur|chf|\$)|(€|chf|\$)\s*\d/i;
      const cands = new Set<Element>();
      root
        .querySelectorAll(
          "a,button,[role=button],input,select,textarea,h1,h2,h3,img,[class*='price' i],[class*='cta' i],[class*='checkout' i],[class*='cart' i]",
        )
        .forEach((e) => cands.add(e));
      root.querySelectorAll("span,div,p,strong,b").forEach((e) => {
        const t = (e as HTMLElement).innerText || "";
        if (t.length < 40 && priceRe.test(t)) cands.add(e);
      });
      const out: {
        id: string;
        tag: string;
        role?: string;
        text: string;
        x: number;
        y: number;
        w: number;
        h: number;
      }[] = [];
      let i = 0;
      cands.forEach((e) => {
        const r = e.getBoundingClientRect();
        if (r.width < 8 || r.height < 8) return;
        const st = getComputedStyle(e);
        if (st.visibility === "hidden" || st.display === "none") return;
        if (r.bottom < rect.top || r.top > rect.bottom) return; // outside visible drawer box
        const he = e as HTMLElement;
        let text = (he.innerText || he.textContent || "").trim().replace(/\s+/g, " ");
        if (!text) {
          text =
            he.getAttribute("aria-label") ||
            he.getAttribute("alt") ||
            he.getAttribute("placeholder") ||
            "";
        }
        out.push({
          id: `el-${i++}`,
          tag: e.tagName.toLowerCase(),
          role: e.getAttribute("role") ?? undefined,
          text: text.slice(0, 140),
          x: Math.round(r.left - rect.left),
          y: Math.round(r.top - rect.top),
          w: Math.round(r.width),
          h: Math.round(r.height),
        });
      });
      out.sort((a, b) => b.w * b.h - a.w * a.h);
      return {
        docWidth: Math.round(rect.width),
        docHeight: Math.round(rect.height),
        elements: out.slice(0, 40),
      };
    })
    .catch(() => null);
  if (!meta) return null;

  const screenshot = (await el.screenshot({ type: "jpeg", quality: 82 })) as Buffer;
  return {
    viewport,
    screenshot,
    docWidth: meta.docWidth,
    docHeight: meta.docHeight,
    elements: meta.elements,
  };
}

export const viewportSize = (v: Viewport) => VIEWPORTS[v];
export { dismissConsent, NAV_TIMEOUT, settlePage, evalWithRetry };

export async function renderView(
  browser: Browser,
  url: string,
  viewport: Viewport,
): Promise<RenderedView> {
  const context = await browser.newContext({
    viewport: VIEWPORTS[viewport],
    deviceScaleFactor: 1,
    locale: "de-DE",
  });
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
    await settlePage(page);
    await dismissConsent(page);
    // The consent click itself can trigger a navigation/reload — let it settle.
    await settlePage(page);
    return await captureView(page, viewport);
  } finally {
    await context.close().catch(() => {});
  }
}

export async function renderPage(
  browser: Browser,
  url: string,
  type: PageType,
  name: string,
): Promise<RenderedPage> {
  const desktop = await renderView(browser, url, "desktop");
  let mobile: RenderedView | undefined;
  try {
    mobile = await renderView(browser, url, "mobile");
  } catch {
    mobile = undefined; // mobile is a bonus dimension; don't fail the page on it
  }

  // Cleaned content from the desktop view's enumerated text.
  const content = desktop.elements
    .map((e) => e.text)
    .filter(Boolean)
    .join(" · ")
    .slice(0, 4000);

  return { id: type, type, name, url, desktop, mobile, content, reachable: true };
}

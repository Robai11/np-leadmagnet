/*
 * Render layer (Build-Spec §4). Per page + viewport: dismiss consent, scroll to
 * trigger lazy-loading, take a full-page screenshot, and enumerate candidate
 * elements with absolute document bounding boxes + text. The bounding boxes are
 * the ground truth for pin geometry; the model never guesses coordinates.
 */

import type { Browser, Page } from "playwright-core";
import type { PageType, Viewport } from "@/lib/types";
import type { EnumeratedElement, RenderedView, RenderedPage } from "@/lib/analysis/pipeline-types";
import { SHOP_UA, BlockedError } from "@/lib/analysis/browser";

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
    await page.waitForLoadState("networkidle", { timeout: 4_000 });
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

/*
 * Consent handling is SIGNAL-BASED, not shop-specific. A consent banner is
 * always the same thing structurally — a blocking overlay (fixed/sticky, high
 * z-index, covers the viewport) carrying a dismiss control — so we detect those
 * structural traits rather than maintaining per-shop selectors. Layers:
 *   1. Fast path: a small curated set of standard-CMP selectors (OneTrust,
 *      Usercentrics, Cookiebot, …) — precise & cheap for the ~80% that use them.
 *   2. Accessible-name accept (Playwright pierces OPEN shadow DOM).
 *   3. Heuristic, shadow-DOM- & iframe-aware: find the blocking consent overlay
 *      and click its best dismiss control (accept ▸ reject/necessary ▸ close —
 *      ANY of them unblocks the page). Multilingual.
 *   4. Verify the viewport is no longer covered; if not, retry once for late
 *      banners, then hide the DETECTED overlay element specifically (not a broad
 *      CSS hammer) and release the scroll-lock.
 */

// Multilingual vocab (sources are passed into page.evaluate). Kept broad on
// purpose: every major EU shop language. Used inside a CONSENT-scoped overlay,
// so generic words can't fire on unrelated page buttons.
const CONSENT_KEYWORDS_SRC =
  "cookie|privatsph|datenschutz|einwillig|zustimmung|consent|privacy|tracking|gdpr|dsgvo|préférenc|confidentialit|consentement|privacidad|consenso|riservatezz|prywatno|zgod|toestemming|cookiebeleid|integritet|samtycke";
const CONSENT_ACCEPT_SRC =
  "alle(s)?\\s+(akzeptier\\w*|annehmen|zulassen|erlauben|auswählen)|akzeptier\\w*|zustimmen|einverstanden|verstanden|allow all|accept all|accept( all)? cookies|i accept|\\baccept\\b|i agree|\\bagree\\b|got it|understood|tout accepter|j.?accepte|accepter|aceptar|acepto|accetta|accetto|aceitar|alles toestaan|accepteren|akkoord|zaakceptuj|akceptuj|godkänn|tillåt alla|prijať|приня";
const CONSENT_DISMISS_SRC =
  "alle(s)?\\s+ablehnen|ablehnen|nur (notwendige|essenziell|erforderlich|technisch)|reject all|\\breject\\b|decline|deny|necessary only|only necessary|essential( cookies)? only|continue without|weiter ohne|tout refuser|refuser|rechazar|rifiuta|weiger|odrzuć|bestätigen|confirm|speichern|save( & exit| choices)?|schließen|\\bclose\\b";
const CONSENT_SETTINGS_SRC =
  "einstellung|individuell|anpassen|verwalten|auswahl treffen|mehr (optionen|erfahren|info)|manage|customi[sz]e|more option|preferenc|settings|configure|paramètr|gérer|personnaliser|gestionar|configurar|impostazioni|gestisci|instellingen|beheren|ustawienia|zarządzaj";

const REGEX_BUNDLE = {
  consent: CONSENT_KEYWORDS_SRC,
  accept: CONSENT_ACCEPT_SRC,
  dismiss: CONSENT_DISMISS_SRC,
  settings: CONSENT_SETTINGS_SRC,
};

// Standard-CMP accept buttons — the cheap, precise fast path.
const KNOWN_ACCEPT_SELECTORS = [
  "#onetrust-accept-btn-handler",
  "#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll",
  "#CybotCookiebotDialogBodyButtonAccept",
  "#cookiescript_accept",
  "[data-testid='uc-accept-all-button']",
  "[data-testid='uc-accept-all']",
  ".cmplz-accept",
  ".cookie-permission--accept-button",
  ".js-cookie-permission-button",
  "[id*='accept-all' i]",
  "[id*='consent' i][id*='accept' i]",
  "[data-testid*='accept-all' i]",
  "[aria-label*='akzeptier' i]",
  "[aria-label*='accept all' i]",
];

// In-browser routine (runs per frame; passed to evaluate BY REFERENCE, so it
// must not close over module scope — only its arg + DOM globals). mode "click"
// tries to dismiss; mode "hide" removes the detected overlay as a last resort.
// Shadow-DOM aware.
function consentRoutine(opts: {
  R: { consent: string; accept: string; dismiss: string; settings: string };
  mode: "click" | "hide" | "detect";
}): { found: boolean; clicked: string | null; hidden: number } {
  const { R, mode } = opts;
  const consentRe = new RegExp(R.consent, "i");
  const acceptRe = new RegExp(R.accept, "i");
  const dismissRe = new RegExp(R.dismiss, "i");
  const settingsRe = new RegExp(R.settings, "i");
  const vw = window.innerWidth || 1280;
  const vh = window.innerHeight || 800;
  const cx = vw / 2;
  const cy = vh / 2;

  // Collect all elements incl. OPEN shadow roots (bounded to stay cheap).
  const all: Element[] = [];
  const stack: Array<Document | ShadowRoot> = [document];
  while (stack.length && all.length < 9000) {
    const root = stack.pop()!;
    const els = root.querySelectorAll("*");
    for (const el of Array.from(els)) {
      all.push(el);
      const sr = (el as HTMLElement).shadowRoot;
      if (sr) stack.push(sr);
      if (all.length >= 9000) break;
    }
  }

  const visible = (el: Element): boolean => {
    const s = getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden" || parseFloat(s.opacity || "1") < 0.05)
      return false;
    const r = el.getBoundingClientRect();
    return r.width > 4 && r.height > 4;
  };
  const labelOf = (b: Element): string =>
    (
      (b as HTMLElement).innerText ||
      (b as HTMLInputElement).value ||
      b.getAttribute("aria-label") ||
      b.getAttribute("title") ||
      ""
    )
      .trim()
      .replace(/\s+/g, " ");
  const attrsOf = (b: Element): string =>
    `${b.id} ${(b as HTMLElement).className} ${b.getAttribute("data-testid") || ""} ${b.getAttribute("name") || ""}`;
  // "Reject"-style controls — the OTHER half of a consent button pair. Highly
  // specific, so an accept+reject pair confirms a consent banner even with no
  // keywords (rare icon/locale-only banners).
  const rejectRe =
    /(ablehnen|reject|decline|deny|refuser|rechazar|rifiuta|weiger|odrzuć|nur (notwendige|essenziell|erforderlich|technisch)|necessary only|only necessary|essential( cookies)? only|avvisa)/i;

  // GATE: an overlay counts as CONSENT only with positive evidence — consent
  // keywords in its text, OR an accept+reject button pair. This deliberately
  // EXCLUDES off-canvas carts, newsletter pop-ups and mega-menus, which are
  // fixed/high-z too but carry neither signal (critical: never hide the cart).
  const hasConsentText = (el: Element): boolean =>
    consentRe.test(((el as HTMLElement).innerText || "").slice(0, 1000));
  const hasAcceptRejectPair = (el: Element): boolean => {
    const btns = Array.from(
      el.querySelectorAll("button, a, [role=button], input[type=button], input[type=submit]"),
    );
    let acc = false;
    let rej = false;
    for (const b of btns) {
      const t = labelOf(b);
      if (!t || t.length > 80) continue;
      if (acceptRe.test(t)) acc = true;
      if (rejectRe.test(t)) rej = true;
      if (acc && rej) return true;
    }
    return false;
  };

  // A blocking surface: fixed/sticky/dialog/high-z and reasonably large.
  const isBlocking = (el: Element): { ok: boolean; z: number; areaFrac: number; coversCenter: boolean } => {
    const s = getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden" || parseFloat(s.opacity || "1") < 0.05)
      return { ok: false, z: 0, areaFrac: 0, coversCenter: false };
    const r = el.getBoundingClientRect();
    if (r.width < 160 || r.height < 50) return { ok: false, z: 0, areaFrac: 0, coversCenter: false };
    const z = parseInt(s.zIndex, 10) || 0;
    const fixedish = s.position === "fixed" || s.position === "sticky";
    const dialogish =
      el.getAttribute("role") === "dialog" ||
      el.getAttribute("role") === "alertdialog" ||
      el.getAttribute("aria-modal") === "true";
    const areaFrac = (r.width * r.height) / (vw * vh);
    const coversCenter = r.left <= cx && r.right >= cx && r.top <= cy && r.bottom >= cy;
    return { ok: fixedish || dialogish || z >= 100, z, areaFrac, coversCenter };
  };

  // Does the page have ANY genuine consent dialog? (Used to decide whether a
  // bare dim backdrop is a consent backdrop vs. a cart/menu backdrop.)
  const consentDialogs = all.filter((el) => {
    const b = isBlocking(el);
    return b.ok && (hasConsentText(el) || hasAcceptRejectPair(el));
  });
  const pageHasConsent = consentDialogs.length > 0;

  // Qualifying consent overlays: the dialogs themselves, plus their dim
  // backdrops (textless, near-fullscreen) ONLY when a consent dialog exists.
  const qualified = all.filter((el) => {
    const b = isBlocking(el);
    if (!b.ok) return false;
    if (hasConsentText(el) || hasAcceptRejectPair(el)) return true;
    const textless = !((el as HTMLElement).innerText || "").trim();
    return pageHasConsent && textless && b.areaFrac > 0.6;
  });

  // Rank strongest first (consent text > coverage > z-index) for click priority.
  const overlays = qualified
    .map((el) => {
      const b = isBlocking(el);
      let score = 0;
      if (hasConsentText(el)) score += 4;
      if (hasAcceptRejectPair(el)) score += 3;
      if (b.coversCenter) score += 1;
      if (b.areaFrac > 0.5) score += 1;
      if (b.z >= 1000) score += 2;
      else if (b.z >= 100) score += 1;
      return { el, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  // "detect" just reports whether a consent overlay is still present (used by
  // the verify loop — catches bottom/top bars that don't cover the center).
  if (mode === "detect") {
    return { found: overlays.length > 0, clicked: null, hidden: 0 };
  }

  if (mode === "hide") {
    let hidden = 0;
    for (const { el } of overlays) {
      const he = el as HTMLElement;
      he.style.setProperty("display", "none", "important");
      he.style.setProperty("visibility", "hidden", "important");
      he.style.setProperty("pointer-events", "none", "important");
      hidden++;
    }
    // Release common scroll-locks so the page is interactive + fully scrollable.
    for (const el of [document.documentElement, document.body]) {
      if (!el) continue;
      el.style.setProperty("overflow", "auto", "important");
      el.style.setProperty("position", "static", "important");
    }
    return { found: overlays.length > 0, clicked: null, hidden };
  }

  // mode "click": within the strongest overlays, pick the best dismiss control.
  for (const { el: ov } of overlays) {
    const btns = Array.from(
      ov.querySelectorAll("button, a, [role=button], input[type=button], input[type=submit]"),
    ).filter(visible);
    if (!btns.length) continue;
    // Priority 1: accept by text (excluding "open settings" controls).
    const target =
      btns.find((b) => {
        const t = labelOf(b);
        return t && t.length < 80 && acceptRe.test(t) && !settingsRe.test(t);
      }) ||
      // Priority 2: accept by attribute (icon-only buttons).
      btns.find((b) => {
        const a = attrsOf(b);
        return /accept|agree|allow|zustimm|einverst/i.test(a) && !settingsRe.test(labelOf(b));
      }) ||
      // Priority 3: any dismiss (reject / necessary-only / close) — also unblocks.
      btns.find((b) => {
        const t = labelOf(b);
        return t && dismissRe.test(t) && !settingsRe.test(t);
      });
    if (target) {
      (target as HTMLElement).click();
      return { found: true, clicked: `${labelOf(target) || attrsOf(target)}`.slice(0, 50), hidden: 0 };
    }
  }
  return { found: overlays.length > 0, clicked: null, hidden: 0 };
}

// True if the viewport center is still covered by a blocking fixed/sticky layer.
function viewportBlocked(): boolean {
  const cx = (window.innerWidth || 1280) / 2;
  const cy = (window.innerHeight || 800) / 2;
  let el: Element | null = document.elementFromPoint(cx, cy);
  let depth = 0;
  while (el && el !== document.body && el !== document.documentElement && depth < 12) {
    const s = getComputedStyle(el);
    if (s.position === "fixed" || s.position === "sticky") {
      const z = parseInt(s.zIndex, 10) || 0;
      const r = el.getBoundingClientRect();
      const big = (r.width * r.height) / ((window.innerWidth || 1280) * (window.innerHeight || 800)) > 0.2;
      if (z >= 100 || big) return true;
    }
    el = el.parentElement;
    depth++;
  }
  return false;
}

async function dismissConsent(page: Page): Promise<void> {
  const frames = () => {
    const main = page.mainFrame();
    return [main, ...page.frames().filter((f) => f !== main && !/^about:/.test(f.url()))].slice(0, 8);
  };

  for (let round = 0; round < 2; round++) {
    // 1) Fast path — standard-CMP accept buttons (main frame).
    for (const sel of KNOWN_ACCEPT_SELECTORS) {
      try {
        const el = page.locator(sel).first();
        if (await el.isVisible({ timeout: 250 })) {
          await el.click({ timeout: 1500, force: true });
          await page.waitForTimeout(250);
          break;
        }
      } catch {
        /* keep trying */
      }
    }
    // 2) Accessible-name accept (pierces open shadow DOM).
    try {
      const byText = page.getByRole("button", { name: new RegExp(CONSENT_ACCEPT_SRC, "i") }).first();
      if (await byText.isVisible({ timeout: 250 })) {
        await byText.click({ timeout: 1500, force: true }).catch(() => {});
        await page.waitForTimeout(250);
      }
    } catch {
      /* none — fine */
    }
    // 3) Heuristic dismiss across all frames (shadow-DOM aware). consentRoutine
    //    is passed by reference — Playwright serializes it into each frame.
    for (const f of frames()) {
      try {
        const res = await f
          .evaluate(consentRoutine, { R: REGEX_BUNDLE, mode: "click" as const })
          .catch(() => null);
        if (res?.clicked) await page.waitForTimeout(300);
      } catch {
        /* frame may be cross-origin/detached — skip */
      }
    }

    await page.waitForTimeout(round === 0 ? 450 : 300);
    // Done only when the center is unblocked AND no consent overlay remains
    // anywhere (covers bottom/top bars that never overlap the viewport center).
    let stillThere = await page.evaluate(viewportBlocked).catch(() => false);
    if (!stillThere) {
      for (const f of frames()) {
        const d = await f
          .evaluate(consentRoutine, { R: REGEX_BUNDLE, mode: "detect" as const })
          .catch(() => null);
        if (d?.found) {
          stillThere = true;
          break;
        }
      }
    }
    if (!stillThere) return; // page is clear — done

    if (round === 0) await page.waitForTimeout(900); // late-appearing banner
  }

  // 4) Last resort — hide the DETECTED overlay element(s) in every frame and
  //    release the scroll-lock. Targets only scored consent overlays, so legit
  //    sticky headers/content are untouched.
  for (const f of frames()) {
    try {
      await f.evaluate(consentRoutine, { R: REGEX_BUNDLE, mode: "hide" as const });
    } catch {
      /* skip frame */
    }
  }
}

async function autoScroll(page: Page): Promise<void> {
  // Slowly scroll to the bottom to trigger lazy-loaded sections (SPAs render on
  // IntersectionObserver), waiting until the page height stops growing so
  // content has time to render. Best-effort — never fail the page on it.
  try {
    await evalWithRetry(page, async () => {
      await new Promise<void>((resolve) => {
        const step = 500;
        let lastH = 0;
        let stable = 0;
        const timer = setInterval(() => {
          window.scrollBy(0, step);
          const h = document.body.scrollHeight;
          const atBottom = window.scrollY + window.innerHeight >= h - 5;
          if (h === lastH) stable += 1;
          else {
            stable = 0;
            lastH = h;
          }
          // Done when we're at the bottom AND the height has settled.
          if (atBottom && stable >= 3) {
            clearInterval(timer);
            resolve();
          }
        }, 220);
        // Hard cap so a never-settling page (infinite scroll) can't hang.
        setTimeout(() => {
          clearInterval(timer);
          resolve();
        }, 8000);
      });
    });
    // Let just-revealed content finish loading, then return to the top.
    try {
      await page.waitForLoadState("networkidle", { timeout: 3000 });
    } catch {
      /* chatty page — fine */
    }
    await page.waitForTimeout(400);
    await evalWithRetry(page, () => window.scrollTo(0, 0));
    await page.waitForTimeout(400);
  } catch {
    /* scrolling is best-effort; proceed with whatever is loaded */
  }
}

/** Runs in the browser: enumerate candidate elements + document dimensions.
 * Exported so the Stagehand agent funnel can reuse it on its own page. */
export function enumerateInPage(): {
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

  const out: (EnumeratedElement & { _key: number })[] = [];
  let i = 0;
  const ctaText = /(in den warenkorb|in den korb|add to cart|add to bag|jetzt kaufen|zur kasse|checkout|kaufen|bezahlen)/i;
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
    const tag = el.tagName.toLowerCase();
    const cls = `${(el.className || "").toString()}`.toLowerCase();
    // Priority so small-but-important controls (CTA buttons, price) survive the
    // cap — otherwise a tiny "In den Warenkorb" button is dropped in favour of
    // big images and the model can only bind findings to the wrong element.
    let key = 0;
    if (["a", "button", "input", "select", "textarea"].includes(tag) || el.getAttribute("role") === "button")
      key += 2;
    if (/price|preis|cta|cart|warenkorb|korb|add-to|addto|checkout|kasse|buy|kaufen|basket/i.test(cls))
      key += 2;
    if (ctaText.test(text)) key += 4;
    if (priceRe.test(text)) key += 2;
    out.push({
      id: `el-${i++}`,
      tag,
      role: el.getAttribute("role") ?? undefined,
      text: text.slice(0, 140),
      x: Math.round(r.left + window.scrollX),
      y: Math.round(r.top + window.scrollY),
      w: Math.round(r.width),
      h: Math.round(r.height),
      _key: key,
    });
  });

  // Keep the most important candidates: key controls (CTA/price/interactive)
  // first, then the largest remaining — bounded to keep the prompt small.
  out.sort((a, b) => b._key - a._key || b.w * b.h - a.w * a.h);
  return {
    docWidth,
    docHeight,
    elements: out.slice(0, 70).map((e) => ({
      id: e.id,
      tag: e.tag,
      role: e.role,
      text: e.text,
      x: e.x,
      y: e.y,
      w: e.w,
      h: e.h,
    })),
  };
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
/**
 * True if the current page is a bot/anti-automation interstitial (Cloudflare
 * "Just a moment…", hCaptcha/Turnstile, "checking your browser"). In LOCAL
 * headless mode these can't be passed; the hybrid withSession() retries such a
 * page on Browserbase + residential proxy instead.
 */
export async function isBotChallenge(page: Page): Promise<boolean> {
  try {
    const r = await page.evaluate(() => ({
      title: (document.title || "").toLowerCase(),
      body: (document.body?.innerText || "").slice(0, 600).toLowerCase(),
      bodyLen: (document.body?.innerText || "").length,
      cf: !!document.querySelector(
        "#challenge-running, #cf-challenge-running, iframe[src*='challenges.cloudflare'], iframe[src*='hcaptcha'], iframe[title*='challenge' i], #turnstile-wrapper",
      ),
    }));
    const hay = `${r.title} ${r.body}`;
    const phrase =
      /just a moment|nur einen moment|checking your browser|verifying you are human|verify you are human|verbindung muss verifiziert|überprüfe deine verbindung|attention required|einen moment geduld|wird überprüft|sicherheitsüberprüfung|ddos|ray id/i.test(
        hay,
      );
    return r.cf || phrase || (r.bodyLen < 120 && /moment|verif|challenge|robot|human/i.test(hay));
  } catch {
    return false;
  }
}

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
    userAgent: SHOP_UA,
  });
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
    await settlePage(page);
    // Bot-blocked locally? Signal withSession to retry on Browserbase + proxy.
    if (await isBotChallenge(page)) throw new BlockedError("bot-challenge");
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

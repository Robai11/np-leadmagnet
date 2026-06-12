/*
 * AI-agent funnel (Stagehand). Instead of hand-coded per-shop heuristics, an
 * LLM-driven browser agent does what a human does on ANY shop: pick a variant,
 * add to cart, open the cart, proceed to checkout — reasoning from what it sees.
 * Runs on Browserbase (stealth + DE residential proxy) when configured, else a
 * local browser. We reuse the existing enumerate+screenshot capture so the
 * Vision analysis stays unchanged.
 *
 * Safety (Build-Spec §6): the agent is instructed to NEVER enter personal data,
 * create an account or submit payment — it stops at the first checkout screen.
 */

import { Stagehand } from "@browserbasehq/stagehand";
import type { PageType } from "@/lib/types";
import type { RenderedPage, RenderedView } from "@/lib/analysis/pipeline-types";
import { enumerateInPage } from "@/lib/analysis/render";
import { readEnv } from "@/lib/analysis/config";

export interface AgentFunnelResult {
  pages: RenderedPage[];
  notes: string[];
}

/** Subset of Stagehand's AgentResult we read for control flow + diagnostics. */
interface AgentRunResult {
  success?: boolean;
  message?: string;
  actions?: Array<{ type?: string; action?: string; pageUrl?: string }>;
  /** True when the run THREW (operation timeout / dead session) rather than the
   *  agent finishing with success:false. We never retry a thrown run. */
  _threw?: boolean;
}

/**
 * Race a promise against a hard timeout. Critical safety net: when a Browserbase
 * session dies mid-run (CDP socket-close 1006), the underlying agent/page calls
 * can hang FOREVER — which would freeze the whole analysis request. This caps
 * every such call so a dead session degrades into a clean failure instead.
 */
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label}: Zeitlimit (${Math.round(ms / 1000)}s) überschritten`)),
      ms,
    );
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

const AGENT_INSTRUCTIONS =
  "You operate a German e-commerce shop like a careful human shopper. " +
  "STRICT RULES: never type personal data (name, email, address, phone), never " +
  "create an account, never enter payment or coupon data, never actually place " +
  "an order. You only browse, select product options, add to cart and open the " +
  "checkout entry screen.";

export async function runAgentFunnel(pdpUrl: string, device: number): Promise<AgentFunnelResult> {
  const env = readEnv();
  const notes: string[] = [];
  const pages: RenderedPage[] = [];
  const needMobile = device >= 50;
  const useBrowserbase = Boolean(env.browserbaseApiKey);

  const sh = new Stagehand({
    env: useBrowserbase ? "BROWSERBASE" : "LOCAL",
    apiKey: env.browserbaseApiKey,
    projectId: env.browserbaseProjectId,
    browserbaseSessionCreateParams: useBrowserbase
      ? {
          projectId: env.browserbaseProjectId ?? "",
          proxies: env.browserbaseProxies
            ? [{ type: "browserbase", geolocation: { country: "DE" } }]
            : undefined,
          browserSettings: { solveCaptchas: true },
        }
      : undefined,
    localBrowserLaunchOptions: useBrowserbase
      ? undefined
      : {
          headless: true,
          viewport: { width: 1280, height: 800 },
          locale: "de-DE",
          args: ["--disable-blink-features=AutomationControlled"],
        },
    model: {
      modelName: `anthropic/${env.anthropicModel || "claude-sonnet-4-6"}`,
      apiKey: env.anthropicApiKey,
    },
    verbose: 0,
    actTimeoutMs: 60_000,
  });

  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  try {
    await sh.init();
    const page = sh.context.pages()[0] ?? (await sh.context.newPage());

    // Capture one view (screenshot + enumerated elements) from the agent's page.
    const capture = async (vp: "desktop" | "mobile"): Promise<RenderedView> => {
      await page.setViewportSize(vp === "mobile" ? 390 : 1280, vp === "mobile" ? 844 : 800).catch(() => {});
      await wait(500);
      // Trigger lazy-loaded content, then return to the top.
      await page
        .evaluate(async () => {
          await new Promise<void>((res) => {
            let y = 0;
            const t = setInterval(() => {
              window.scrollBy(0, 800);
              y += 800;
              if (y >= document.body.scrollHeight - window.innerHeight || y > 25000) {
                clearInterval(t);
                res();
              }
            }, 140);
            setTimeout(() => {
              clearInterval(t);
              res();
            }, 6000);
          });
          window.scrollTo(0, 0);
        })
        .catch(() => {});
      await wait(400);
      const meta = (await withTimeout(
        page.evaluate(enumerateInPage),
        20_000,
        "page.evaluate(enumerate)",
      )) as {
        docWidth: number;
        docHeight: number;
        elements: RenderedView["elements"];
      };
      const screenshot = (await withTimeout(
        page.screenshot({ fullPage: true, type: "jpeg", quality: 80 }),
        30_000,
        "page.screenshot",
      )) as Buffer;
      return { viewport: vp, screenshot, docWidth: meta.docWidth, docHeight: meta.docHeight, elements: meta.elements };
    };

    const buildPage = async (id: PageType, name: string): Promise<RenderedPage> => {
      const desktop = await capture("desktop");
      let mobile: RenderedView | undefined;
      if (needMobile) {
        try {
          mobile = await capture("mobile");
        } catch {
          mobile = undefined;
        }
        await page.setViewportSize(1280, 800).catch(() => {});
      }
      const base = mobile ?? desktop;
      const content = base.elements.map((e) => e.text).filter(Boolean).join(" · ").slice(0, 4000);
      return { id, type: id, name, url: page.url(), desktop, mobile, content, reachable: true };
    };

    await page.goto(pdpUrl, { timeoutMs: 45_000 });
    await wait(2000);

    const agent = sh.agent({ systemPrompt: AGENT_INSTRUCTIONS });

    // Compact, human-readable trace of an agent run — so a failure tells us WHY
    // (which page, last actions, the agent's own explanation) instead of a blank
    // "didn't work". Surfaced in notes for the debug endpoint and logs.
    const summarize = (r: AgentRunResult | undefined): string => {
      if (!r) return "kein Agent-Ergebnis";
      const acts = r.actions ?? [];
      const last = acts
        .slice(-5)
        .map((a) => a.action || a.type)
        .filter(Boolean)
        .join(" → ");
      const msg = (r.message ?? "").replace(/\s+/g, " ").slice(0, 500);
      return (
        `${acts.length} Schritte` +
        (last ? ` (zuletzt: ${last})` : "") +
        (msg ? ` — Agent: "${msg}"` : "")
      );
    };

    // Run one agent goal with ONE automatic retry on failure — the single biggest
    // lever against the agent's run-to-run variance. The retry appends a nudge so
    // the second attempt tries a different path rather than repeating the same dead end.
    const runStep = async (
      instruction: string,
      maxSteps: number,
      timeoutMs: number,
      retryNudge?: string,
    ): Promise<AgentRunResult> => {
      const exec = async (instr: string): Promise<AgentRunResult> => {
        try {
          return (await withTimeout(
            // toolTimeout 90s (default 45s): heavy pages over the residential
            // proxy can take >45s for a single click/screenshot — at 45s the op
            // aborts and the session can cascade into death. The outer withTimeout
            // still bounds the whole step so nothing runs away.
            agent.execute({ instruction: instr, maxSteps, toolTimeout: 90_000 }),
            timeoutMs,
            "agent.execute",
          )) as AgentRunResult;
        } catch (e: unknown) {
          // A THROW = infrastructure failure (operation timeout, dead Browserbase
          // session, CDP socket-close) — NOT the agent giving up. Tag it so we
          // don't retry: a dead session can't recover and would only hang again.
          return {
            success: false,
            message: e instanceof Error ? e.message : String(e),
            actions: [],
            _threw: true,
          };
        }
      };
      const first = await exec(instruction);
      // Retry only on a SOFT failure (agent ran to the end but couldn't do it) —
      // the lever against run-to-run variance. Never retry a crashed session.
      if (first?.success || !retryNudge || first._threw) return first;
      const second = await exec(`${instruction} ${retryNudge}`);
      return second?.success ? second : first;
    };

    // 1) Add a product to the cart (the agent self-verifies the item landed).
    const added = await runStep(
      "First clear anything that blocks interaction: accept the cookie/consent banner, and CLOSE any newsletter, promo or app-install popup. " +
        "If the shop asks for a country/region/language or a store selection, choose Germany / the default option so you can shop. " +
        "If the current page is NOT a single product page (e.g. a homepage, category or search/listing), navigate to any clearly in-stock product first (open a category, then a product). " +
        "On the product page, select EVERY required option before adding to cart: work through ALL variant groups (size, colour, material, length/dimensions, model, delivery/pickup choice, quantity, etc.) and pick an available value for EACH one. The 'add to cart' button often stays DISABLED/greyed out until all required selections are made — if it looks disabled or clicking does nothing, find the remaining unselected options and choose them, then try again. Then add the product to the shopping cart. " +
        "Verify that the cart counter increases / the item actually appears in the cart. If add-to-cart still fails, pick a different available variant or product and try again.",
      18,
      180_000,
      "The previous attempt failed: make sure EVERY required option/dropdown is selected so the add-to-cart button becomes active. If it stays blocked, pick a DIFFERENT, simpler in-stock product (open another category or product) and add it to the cart.",
    );
    if (!added?.success) {
      notes.push(
        `Warenkorb: Produkt ließ sich nicht in den Warenkorb legen — ${summarize(added)}`,
      );
      return { pages, notes };
    }

    // 2) Open the FULL cart PAGE (not just the off-canvas mini-cart) and capture it.
    //    Many shops only expose the checkout button on the dedicated cart page —
    //    the off-canvas drawer is a dead end for reaching checkout.
    await withTimeout(
      agent.execute({
        instruction:
          "Open the FULL shopping cart PAGE so all line items are visible. Navigate to the dedicated cart/basket page — click the cart icon and then 'Warenkorb anzeigen' / 'Zum Warenkorb' / 'View cart', or open the cart URL directly. A small off-canvas mini-cart drawer is NOT enough: many shops only offer the checkout button on the full cart page. Do not proceed to checkout yet.",
        maxSteps: 6,
        toolTimeout: 90_000,
      }),
      90_000,
      "agent.execute(cart)",
    ).catch(() => {});
    await wait(1500);
    pages.push(await buildPage("cart", "Warenkorb"));
    notes.push("Warenkorb per KI-Agent erreicht und erfasst.");

    // 3) Proceed to the checkout entry screen (NO data entry) and capture it.
    const checkout = await runStep(
      "Goal: reach the checkout entry screen. CRITICAL: make sure you are on the FULL cart PAGE, not the small off-canvas mini-cart drawer — many shops only show the checkout button on the full cart page. If only a drawer is open, click 'Warenkorb anzeigen' / 'Zum Warenkorb' / 'View cart' or navigate to the cart page first. Then click the 'Zur Kasse' / 'Checkout' / 'Proceed to checkout' button. Stop at the FIRST checkout screen (or the login/guest selection if the shop forces it). Do NOT enter any data and do NOT log in.",
      10,
      140_000,
      "The previous attempt failed — the checkout button is probably NOT in the off-canvas drawer: navigate to the FULL cart page ('Warenkorb anzeigen' / 'Zum Warenkorb' / the cart URL), then click the checkout button there.",
    );
    if (checkout?.success) {
      await wait(1500);
      pages.push(await buildPage("checkout", "Checkout"));
      notes.push("Checkout per KI-Agent erreicht und erfasst.");
    } else {
      notes.push(`Checkout: nicht erreichbar — ${summarize(checkout)}`);
    }

    return { pages, notes };
  } catch (err) {
    notes.push(`KI-Funnel abgebrochen: ${err instanceof Error ? err.message : "unbekannt"}.`);
    return { pages, notes };
  } finally {
    // Guard teardown too: closing an already-dead session can itself hang.
    await withTimeout(sh.close(), 12_000, "sh.close").catch(() => {});
  }
}

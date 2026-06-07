/*
 * Pipeline configuration + capability detection.
 *
 * The app must always run. If the real pipeline isn't fully configured, we fall
 * back to the mock pipeline (run.ts). "Fully configured" means at least a
 * browser provider + Anthropic key; Blob is optional (we inline screenshots as
 * data URLs when no Blob token is present, which is fine for local dev).
 */

export type BrowserMode = "browserbase" | "local";

export interface PipelineEnv {
  /** "local" drives the machine's installed Chrome; "browserbase" uses the cloud. */
  browserMode: BrowserMode;
  browserbaseApiKey?: string;
  browserbaseProjectId?: string;
  // Stealth proxies help past bot blocks but are a PAID-plan feature on
  // Browserbase. Off by default so the free tier works; set BROWSERBASE_PROXIES=true
  // once on a paid plan.
  browserbaseProxies: boolean;
  anthropicApiKey?: string;
  anthropicModel: string;
  blobToken?: string;
}

export function readEnv(): PipelineEnv {
  return {
    browserMode: process.env.BROWSER_MODE === "local" ? "local" : "browserbase",
    browserbaseApiKey: process.env.BROWSERBASE_API_KEY || undefined,
    browserbaseProjectId: process.env.BROWSERBASE_PROJECT_ID || undefined,
    browserbaseProxies: /^(1|true|yes)$/i.test(process.env.BROWSERBASE_PROXIES || ""),
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || undefined,
    // Most capable Vision model; override via env (e.g. claude-sonnet-4-6 for cost).
    anthropicModel: process.env.ANTHROPIC_MODEL || "claude-opus-4-8",
    blobToken: process.env.BLOB_READ_WRITE_TOKEN || undefined,
  };
}

/**
 * True when a browser provider AND the Vision model are configured. Local mode
 * needs only the Anthropic key (the browser is on this machine); Browserbase
 * mode additionally needs its API key.
 */
export function hasRealPipeline(env: PipelineEnv = readEnv()): boolean {
  if (!env.anthropicApiKey) return false;
  if (env.browserMode === "local") return true;
  return Boolean(env.browserbaseApiKey);
}

export function hasBlob(env: PipelineEnv = readEnv()): boolean {
  return Boolean(env.blobToken);
}

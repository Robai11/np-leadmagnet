/*
 * URL normalization — the cache key is the normalized URL (Build-Spec §1/§2).
 * Normalizes protocol, host case, www, trailing slash, and strips fragments +
 * common tracking params so the same shop maps to one cache entry.
 */

const TRACKING_PARAMS = [
  /^utm_/i,
  /^fbclid$/i,
  /^gclid$/i,
  /^mc_/i,
  /^ref$/i,
  /^_ga$/i,
];

export interface NormalizedUrl {
  normalized: string;
  host: string;
}

export function normalizeUrl(raw: string): NormalizedUrl | null {
  let input = raw.trim();
  if (!input) return null;
  if (!/^https?:\/\//i.test(input)) input = `https://${input}`;

  let u: URL;
  try {
    u = new URL(input);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;

  u.protocol = "https:";
  u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
  u.hash = "";

  for (const key of [...u.searchParams.keys()]) {
    if (TRACKING_PARAMS.some((re) => re.test(key))) u.searchParams.delete(key);
  }

  // Collapse a bare "/" path; keep deeper paths as-is.
  let path = u.pathname.replace(/\/+$/, "");
  if (path === "") path = "/";
  u.pathname = path;

  const search = u.searchParams.toString();
  const normalized = `${u.protocol}//${u.hostname}${
    u.port ? `:${u.port}` : ""
  }${path === "/" ? "" : path}${search ? `?${search}` : ""}`;

  return { normalized, host: u.hostname };
}

/*
 * Business-email helper, shared by the lead form (client) and /api/lead
 * (server). A "business" email is a syntactically valid address whose domain is
 * not a known free/consumer provider — so a real workplace address is required
 * to unlock the report.
 *
 * The list is intentionally pragmatic, not exhaustive: it covers the common DE +
 * international consumer providers. Server-side validation is the source of
 * truth; the client uses the same check only to give early inline feedback.
 */

const FREE_EMAIL_DOMAINS = new Set([
  // Google
  "gmail.com",
  "googlemail.com",
  // Microsoft
  "outlook.com",
  "outlook.de",
  "hotmail.com",
  "hotmail.de",
  "live.com",
  "live.de",
  "msn.com",
  // Yahoo
  "yahoo.com",
  "yahoo.de",
  "ymail.com",
  "rocketmail.com",
  // Apple
  "icloud.com",
  "me.com",
  "mac.com",
  // German consumer providers
  "gmx.de",
  "gmx.net",
  "gmx.at",
  "gmx.ch",
  "gmx.com",
  "gmx.eu",
  "web.de",
  "t-online.de",
  "freenet.de",
  "arcor.de",
  "online.de",
  "mail.de",
  "email.de",
  // Other common free providers
  "aol.com",
  "mail.com",
  "mail.ru",
  "yandex.com",
  "yandex.ru",
  "zoho.com",
  "gmx.us",
  "posteo.de",
  "proton.me",
  "protonmail.com",
  "pm.me",
  "fastmail.com",
]);

const EMAIL_RE = /^[^@\s]+@([^@\s]+\.[^@\s]+)$/;

/** Valid email syntax (no free-provider check). */
export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

/** True only for a syntactically valid address on a non-free-provider domain. */
export function isBusinessEmail(value: string): boolean {
  const m = EMAIL_RE.exec(value.trim().toLowerCase());
  if (!m) return false;
  return !FREE_EMAIL_DOMAINS.has(m[1]);
}

/*
 * Geschützter Health-Check (/api/health). Prüft in der ECHTEN Umgebung, ob die
 * für die Analyse + den Lead-Store nötigen Dienste erreichbar sind. Gibt NIE
 * Secret-Werte zurück — nur Vorhandensein (true/false) und Status/Fehlertext.
 *
 * Zugriff nur mit gültigem Admin-Session-Cookie (wie /admin).
 * Aufruf:  https://<domain>/api/health   (vorher in /admin einloggen)
 */

import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, adminToken } from "@/lib/admin-auth";
import { pingLeadStore } from "@/lib/leads-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // Gleiche Auth wie /admin.
  const token = await adminToken();
  const cookie = req.cookies.get(ADMIN_COOKIE)?.value;
  if (!token || cookie !== token) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const has = (k: string) => Boolean(process.env[k]);
  const env = {
    ANTHROPIC_API_KEY: has("ANTHROPIC_API_KEY"),
    ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL || "(default)",
    BROWSER_MODE: process.env.BROWSER_MODE || "(default: browserbase)",
    BROWSERBASE_API_KEY: has("BROWSERBASE_API_KEY"),
    BROWSERBASE_PROJECT_ID: has("BROWSERBASE_PROJECT_ID"),
    BROWSERBASE_PROXIES: process.env.BROWSERBASE_PROXIES || "(off)",
    BLOB_READ_WRITE_TOKEN: has("BLOB_READ_WRITE_TOKEN"),
    KV_REST_API_URL: has("KV_REST_API_URL") || has("UPSTASH_REDIS_REST_URL"),
    KV_REST_API_TOKEN: has("KV_REST_API_TOKEN") || has("UPSTASH_REDIS_REST_TOKEN"),
    ADMIN_USER: has("ADMIN_USER"),
    ADMIN_PASSWORD: has("ADMIN_PASSWORD"),
    RESEND_API_KEY: has("RESEND_API_KEY"),
  };

  // Redis / Lead-Store (der /admin-Verdächtige).
  const redis = await pingLeadStore();

  // Blob (read-only list) — bestätigt, dass das Token in Prod funktioniert.
  let blob: { ok: boolean; error?: string } = { ok: false, error: "no_token" };
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const { list } = await import("@vercel/blob");
      await list({ limit: 1, token: process.env.BLOB_READ_WRITE_TOKEN });
      blob = { ok: true };
    } catch (e) {
      blob = { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  return NextResponse.json({
    ok: redis.ok && (blob.ok || !process.env.BLOB_READ_WRITE_TOKEN),
    time: new Date().toISOString(),
    env,
    redis,
    blob,
    note: "Anthropic & Browserbase werden hier nicht kostenpflichtig getestet — dafür eine echte Analyse starten.",
  });
}

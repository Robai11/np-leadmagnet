/*
 * URL-Log — chronologische Liste ALLER gestarteten Analysen (unabhängig von
 * Leads). Zeigt, welche Shop-URLs gescannt wurden, auch wenn kein Lead entstand.
 * Eine Shop-URL ist keine PII → bewusst OHNE IP/personenbezogene Daten.
 *
 * Nutzt denselben privaten KV/Upstash-Store wie die Leads (eigener Key), Env:
 *   KV_REST_API_URL / KV_REST_API_TOKEN  (oder UPSTASH_REDIS_REST_URL / _TOKEN)
 * Ohne diese Variablen ist der Store inaktiv (lokal/Dev) — dann kein Crash.
 */

import { Redis } from "@upstash/redis";

const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token =
  process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

const redis =
  url && token
    ? new Redis({ url, token, automaticDeserialization: false })
    : null;

const KEY = "analyzed_urls";
// Log-Länge deckeln (Speicher/Kosten) — die neuesten Einträge bleiben.
const MAX = 20000;

export interface AnalyzedUrlEntry {
  /** Normalisierte Shop-URL. */
  url: string;
  /** ISO-Zeitstempel des Analyse-Starts. */
  at: string;
  industry?: string;
  /** Mobile-Anteil in % (Desktop = 100 − device). */
  device?: number;
  channels?: string[];
  audienceAge?: string;
  audienceGender?: string;
  audienceTraits?: string;
  challenges?: string;
}

export function hasUrlStore(): boolean {
  return redis !== null;
}

/** Einen Analyse-Start protokollieren (neueste zuerst). Wirft bei Store-Fehlern. */
export async function saveAnalyzedUrl(entry: AnalyzedUrlEntry): Promise<void> {
  if (!redis) return;
  await redis.lpush(KEY, JSON.stringify(entry));
  await redis.ltrim(KEY, 0, MAX - 1);
}

/** Alle protokollierten URLs, neueste zuerst. */
export async function listAnalyzedUrls(
  limit = 2000,
): Promise<AnalyzedUrlEntry[]> {
  if (!redis) return [];
  const raw = (await redis.lrange(KEY, 0, limit - 1)) as unknown[];
  const out: AnalyzedUrlEntry[] = [];
  for (const r of raw) {
    try {
      out.push(
        typeof r === "string"
          ? (JSON.parse(r) as AnalyzedUrlEntry)
          : (r as AnalyzedUrlEntry),
      );
    } catch {
      // fehlerhaften Eintrag überspringen
    }
  }
  return out;
}

/*
 * URL-Log — Einträge aller auf der Landingpage gestarteten Analysen (beim Klick
 * auf „Analysieren", unabhängig von Leads/Wizard-Abschluss). Ein Eintrag wird
 * per ID beim LP-Klick angelegt (nur URL + Zeit) und – falls der Nutzer den
 * Wizard durchläuft – über dieselbe ID mit dem eingegebenen Kontext angereichert.
 *
 * Speicherung im privaten KV/Upstash (eigene Keys, getrennt von den Leads):
 *   HASH  analyzed_urls_v2        → id → JSON(Eintrag)
 *   LIST  analyzed_urls_v2_order  → ids, neueste zuerst (nur fürs Kappen)
 * Neue Key-Namen (v2), damit es keinen WRONGTYPE-Konflikt mit der früheren
 * Listen-Variante gibt. Eine Shop-URL ist keine PII → bewusst OHNE IP.
 */

import { Redis } from "@upstash/redis";

const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token =
  process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

const redis =
  url && token
    ? new Redis({ url, token, automaticDeserialization: false })
    : null;

const HASH = "analyzed_urls_v2";
const ORDER = "analyzed_urls_v2_order";
const MAX = 10000; // Log-Größe deckeln (Speicher/Kosten) — die neuesten bleiben.

export interface AnalyzedUrlEntry {
  /** Eindeutige ID (Client-generiert beim LP-Klick), verknüpft Eintrag ↔ Analyse. */
  id: string;
  /** Normalisierte Shop-URL. */
  url: string;
  /** ISO-Zeitstempel des LP-Klicks. */
  at: string;
  // ── Kontext (erst vorhanden, wenn der Wizard durchlaufen wurde) ──
  industry?: string;
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

/** Ältere Einträge über MAX hinaus aus Reihenfolge-Liste + Hash entfernen. */
async function prune(): Promise<void> {
  if (!redis) return;
  const over = ((await redis.llen(ORDER)) as number) - MAX;
  if (over <= 0) return;
  const old = (await redis.lrange(ORDER, MAX, -1)) as string[];
  await redis.ltrim(ORDER, 0, MAX - 1);
  if (old.length) await redis.hdel(HASH, ...old);
}

/** Beim LP-Klick: neuen Eintrag (nur URL + Zeit) anlegen. */
export async function createAnalyzedUrl(entry: {
  id: string;
  url: string;
  at: string;
}): Promise<void> {
  if (!redis) return;
  await redis.hset(HASH, { [entry.id]: JSON.stringify(entry) });
  await redis.lpush(ORDER, entry.id);
  await prune();
}

/**
 * Beim Analyse-Start (Wizard abgeschlossen): denselben Eintrag um den Kontext
 * anreichern. Fehlt der Eintrag (Track-Call verpasst), wird er neu angelegt,
 * damit nichts verloren geht.
 */
export async function enrichAnalyzedUrl(
  id: string,
  patch: Partial<AnalyzedUrlEntry> & { url: string },
): Promise<void> {
  if (!redis) return;
  const existingRaw = (await redis.hget(HASH, id)) as string | null;
  let base: AnalyzedUrlEntry;
  if (existingRaw) {
    try {
      base = JSON.parse(existingRaw) as AnalyzedUrlEntry;
    } catch {
      base = { id, url: patch.url, at: new Date().toISOString() };
    }
  } else {
    base = { id, url: patch.url, at: new Date().toISOString() };
    await redis.lpush(ORDER, id);
  }
  const merged: AnalyzedUrlEntry = {
    ...base,
    ...patch,
    id,
    url: base.url || patch.url,
  };
  await redis.hset(HASH, { [id]: JSON.stringify(merged) });
  await prune();
}

/** Alle Einträge, neueste zuerst. */
export async function listAnalyzedUrls(
  limit = 2000,
): Promise<AnalyzedUrlEntry[]> {
  if (!redis) return [];
  const all = (await redis.hgetall(HASH)) as Record<string, string> | null;
  if (!all) return [];
  const out: AnalyzedUrlEntry[] = [];
  for (const v of Object.values(all)) {
    try {
      out.push(
        typeof v === "string" ? (JSON.parse(v) as AnalyzedUrlEntry) : v,
      );
    } catch {
      // fehlerhaften Eintrag überspringen
    }
  }
  out.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  return out.slice(0, limit);
}

/*
 * Dauerhafter Lead-Speicher (PII) — privater Key-Value-Store (Vercel/Upstash
 * Redis). Leads landen NICHT im öffentlichen Blob. Wird vom Lead-Sink
 * (Schreiben) und vom geschützten /admin-Bereich (Lesen) genutzt.
 *
 * Env (von Vercels Upstash/KV-Integration automatisch gesetzt):
 *   KV_REST_API_URL / KV_REST_API_TOKEN  — oder  UPSTASH_REDIS_REST_URL / _TOKEN
 * Ohne diese Variablen ist der Store inaktiv (lokal/Dev) — dann kein Crash,
 * es wird schlicht nichts gespeichert/gelistet.
 */

import { Redis } from "@upstash/redis";
import type { Lead } from "@/lib/lead-sink";

const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token =
  process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

// automaticDeserialization: false → wir kontrollieren JSON selbst (vorhersehbar).
const redis =
  url && token
    ? new Redis({ url, token, automaticDeserialization: false })
    : null;

const KEY = "leads";

export function hasLeadStore(): boolean {
  return redis !== null;
}

/** Neuen Lead vorne anhängen (neueste zuerst). Wirft bei Store-Fehlern — Aufrufer fängt ab. */
export async function saveLead(lead: Lead): Promise<void> {
  if (!redis) return;
  await redis.lpush(KEY, JSON.stringify(lead));
}

/** Alle Leads, neueste zuerst. */
export async function listLeads(limit = 1000): Promise<Lead[]> {
  if (!redis) return [];
  const raw = (await redis.lrange(KEY, 0, limit - 1)) as unknown[];
  const out: Lead[] = [];
  for (const r of raw) {
    try {
      out.push(typeof r === "string" ? (JSON.parse(r) as Lead) : (r as Lead));
    } catch {
      // fehlerhaften Eintrag überspringen
    }
  }
  return out;
}

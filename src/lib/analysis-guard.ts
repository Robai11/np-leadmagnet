/*
 * Missbrauchs-/Kostenschutz für die (teure) Analyse. Dauerhaftes, über alle
 * Serverless-Instanzen geteiltes Limit via KV/Upstash-Store:
 *   - pro IP/Tag          → bremst einzelne Abuser / versehentliche Loops
 *   - globales Tageslimit → Not-Aus gegen Kostenexplosion (z. B. Bot-Ansturm)
 *
 * Gezählt werden NUR echte, kostenpflichtige Analysen (die Route ruft den Check
 * nur bei Cache-Miss auf) — Wiederholungen aus dem Cache bleiben frei.
 *
 * Limits per Env einstellbar:
 *   ANALYSIS_MAX_PER_IP_PER_DAY  (Default 5)
 *   ANALYSIS_MAX_PER_DAY         (Default 100, globaler Not-Aus)
 *
 * Ohne KV-Store (lokal/Dev) oder bei Store-Fehlern fällt der Check OFFEN:
 * das Tool bleibt nutzbar, der Vorfall wird geloggt. Der harte Backstop bleibt
 * ohnehin das Anthropic-Spend-Limit im Console-Account.
 */

import { Redis } from "@upstash/redis";

const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token =
  process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

const redis =
  url && token
    ? new Redis({ url, token, automaticDeserialization: false })
    : null;

const PER_IP = Number(process.env.ANALYSIS_MAX_PER_IP_PER_DAY) || 5;
const GLOBAL = Number(process.env.ANALYSIS_MAX_PER_DAY) || 100;
const DAY_TTL = 60 * 60 * 26; // ~26h → deckt den Tageswechsel/Zeitzone ab

/** UTC-Tag als YYYY-MM-DD (Tages-Reset erfolgt um Mitternacht UTC ≈ 01–02 Uhr DE). */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Zähler hochsetzen und beim ersten Treffer die Ablaufzeit setzen. */
async function bump(key: string, ttl: number): Promise<number> {
  const n = (await redis!.incr(key)) as number;
  if (n === 1) await redis!.expire(key, ttl);
  return n;
}

export interface QuotaResult {
  allowed: boolean;
  reason?: "ip" | "global";
}

/**
 * Prüft (und verbucht) einen Analyse-Versuch. IP zuerst — ein IP-geblockter
 * Abuser soll nicht das globale Kontingent auffressen.
 */
export async function checkAnalysisQuota(ip: string): Promise<QuotaResult> {
  if (!redis) return { allowed: true }; // kein Store → offen (lokal/Dev)
  const day = today();
  try {
    const perIp = await bump(`analysis:ip:${ip}:${day}`, DAY_TTL);
    if (perIp > PER_IP) {
      console.warn(`[guard] IP-Tageslimit erreicht: ${ip} (${perIp}/${PER_IP})`);
      return { allowed: false, reason: "ip" };
    }
    const global = await bump(`analysis:count:${day}`, DAY_TTL);
    if (global > GLOBAL) {
      console.warn(`[guard] Globales Tageslimit erreicht (${global}/${GLOBAL})`);
      return { allowed: false, reason: "global" };
    }
    return { allowed: true };
  } catch (e) {
    // Store-Ausfall darf das Tool nicht blockieren — offen lassen + loggen.
    console.error(
      "[guard] Quota-Check fehlgeschlagen, lasse durch:",
      e instanceof Error ? e.message : e,
    );
    return { allowed: true };
  }
}

/*
 * Dauerhafter Report-Speicher (KV/Upstash). Anders als der In-Memory-Cache
 * (cache.ts, pro Instanz) überlebt dies Instanzwechsel — nötig, damit ein per
 * Mail verschickter Report-Link den fertigen Report später wieder laden kann
 * und die Zustellung auch dann klappt, wenn der Nutzer die Seite verlassen hat.
 *
 * Schlüssel (Token = trackId der Analyse):
 *   report:<token>          → JSON(AnalysisResult)   (fertiger, voller Report)
 *   report_req:<token>      → JSON({email,url,consentAt})  (Mail-Wunsch)
 *   report_sent:<token>     → "1"  (Einmal-Sperre, verhindert Doppelversand)
 */

import { Redis } from "@upstash/redis";
import type { AnalysisResult } from "@/lib/types";

const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token =
  process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

const redis =
  url && token
    ? new Redis({ url, token, automaticDeserialization: false })
    : null;

const REPORT_TTL = 60 * 60 * 24 * 30; // 30 Tage — Link soll eine Weile leben.
const REQ_TTL = 60 * 60 * 24; // 24 h — Mail-Wunsch gilt für diese Analyse.
const SENT_TTL = 60 * 60 * 24 * 30;

export interface ReportRequest {
  email: string;
  url: string;
  consentAt: string;
}

export function hasReportStore(): boolean {
  return redis !== null;
}

/** Fertigen Report dauerhaft ablegen (idempotent, overwrite ok). */
export async function saveReport(
  tok: string,
  result: AnalysisResult,
): Promise<void> {
  if (!redis || !tok) return;
  await redis.set(`report:${tok}`, JSON.stringify(result), { ex: REPORT_TTL });
}

export async function getReport(tok: string): Promise<AnalysisResult | null> {
  if (!redis || !tok) return null;
  const raw = (await redis.get(`report:${tok}`)) as string | null;
  if (!raw) return null;
  try {
    return (typeof raw === "string" ? JSON.parse(raw) : raw) as AnalysisResult;
  } catch {
    return null;
  }
}

/** Mail-Wunsch merken (beim E-Mail-Submit, evtl. bevor die Analyse fertig ist). */
export async function saveReportRequest(
  tok: string,
  req: ReportRequest,
): Promise<void> {
  if (!redis || !tok) return;
  await redis.set(`report_req:${tok}`, JSON.stringify(req), { ex: REQ_TTL });
}

export async function getReportRequest(
  tok: string,
): Promise<ReportRequest | null> {
  if (!redis || !tok) return null;
  const raw = (await redis.get(`report_req:${tok}`)) as string | null;
  if (!raw) return null;
  try {
    return (typeof raw === "string" ? JSON.parse(raw) : raw) as ReportRequest;
  } catch {
    return null;
  }
}

/**
 * Einmal-Sperre für den Versand: gibt true NUR dem ersten Aufrufer zurück
 * (NX-set). So geht die Report-Mail genau einmal raus, auch wenn sowohl der
 * Analyse-Abschluss als auch der E-Mail-Submit gleichzeitig zustellen wollen.
 */
export async function claimReportSend(tok: string): Promise<boolean> {
  if (!redis || !tok) return false;
  const res = await redis.set(`report_sent:${tok}`, "1", {
    nx: true,
    ex: SENT_TTL,
  });
  return res === "OK";
}

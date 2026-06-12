/*
 * Lightweight analysis log (Admin-Ansicht).
 *
 * Appends one JSON line per real analysis to .data/analyses.jsonl so an internal
 * admin page can show WHICH URLs were analyzed (entered shop URL + the exact
 * per-funnel-stage URLs the render/agent actually loaded), plus outcome + notes.
 *
 * Local / single-instance, append-only JSONL. Best-effort: writing the log must
 * NEVER throw into the analysis pipeline.
 */

import { promises as fs } from "fs";
import path from "path";
import type { PageType } from "@/lib/types";

const LOG_DIR = path.join(process.cwd(), ".data");
const LOG_FILE = path.join(LOG_DIR, "analyses.jsonl");

export interface LoggedPage {
  type: PageType;
  name: string;
  url: string;
  /** Opportunity level the page scored (low/medium/high), for a quick glance. */
  opportunity?: string;
}

export interface AnalysisLogEntry {
  /** ISO-8601 timestamp when the analysis finished. */
  date: string;
  /** The shop URL the user entered (raw). */
  shopUrl: string;
  /** Normalized form used as the cache key. */
  normalizedUrl: string;
  industry: string;
  /** Traffic split: percent mobile (0–100). */
  device: number;
  channels: string[];
  /** Page types that were planned/attempted. */
  planned: string[];
  /** Pages that were actually analyzed, each with its real URL. */
  pages: LoggedPage[];
  /** Honest notes (failures, fallbacks, agent diagnostics). */
  notes: string[];
  /** Wall-clock duration of the pipeline in ms. */
  durationMs: number;
  /** True when at least one page was analyzed. */
  ok: boolean;
}

/** Append one analysis record. Best-effort — swallows all errors. */
export async function appendAnalysisLog(entry: AnalysisLogEntry): Promise<void> {
  try {
    await fs.mkdir(LOG_DIR, { recursive: true });
    await fs.appendFile(LOG_FILE, JSON.stringify(entry) + "\n", "utf8");
  } catch {
    // logging must never break an analysis
  }
}

/** Read recorded analyses, newest first (capped). */
export async function readAnalysisLog(limit = 200): Promise<AnalysisLogEntry[]> {
  let raw: string;
  try {
    raw = await fs.readFile(LOG_FILE, "utf8");
  } catch {
    return [];
  }
  const entries: AnalysisLogEntry[] = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      entries.push(JSON.parse(trimmed) as AnalysisLogEntry);
    } catch {
      // skip malformed lines
    }
  }
  entries.reverse(); // newest first
  return entries.slice(0, limit);
}

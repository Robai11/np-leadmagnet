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

const LOG_DIR = path.join(process.cwd(), ".data");
const LOG_FILE = path.join(LOG_DIR, "analyses.jsonl");

export interface AnalysisLogEntry {
  /** ISO-8601 timestamp when the analysis finished. */
  date: string;
  /** The main shop URL the user entered — the only URL we record. */
  shopUrl: string;
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

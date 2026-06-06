/*
 * Canonical analysis schema — Build-Spec §4.
 *
 * This is the contract between the analysis pipeline (server) and the report
 * UI (client). M2 fills it from mock data; M3/M4 fill it from the real
 * browser + Vision pipeline. The shape does not change between them.
 */

import type { ImpactLevel } from "@/styles/tokens";
import type { LeverCategory } from "@/lib/taxonomy";

export type LeverType = "cr" | "aov";
export type Viewport = "desktop" | "mobile";
export type PageType = "home" | "plp" | "pdp" | "cart" | "checkout";

/**
 * One page the user wants analyzed: its type, the exact URL, and whether it's
 * selected. The user enters URLs per funnel stage and checks which to analyze
 * (replaces fragile auto-discovery). cart/checkout are reached via the stateful
 * add-to-cart flow when a product URL is selected; otherwise rendered directly.
 */
export interface PageTarget {
  type: PageType;
  url: string;
  selected: boolean;
}

/** Context-Formular payload (Build-Spec §3.1). */
export interface AnalysisContext {
  /** Primary shop URL (raw) — used for the cache key, meta, and report header. */
  url: string;
  /** Branche — one of INDUSTRIES, no default. */
  industry: string;
  /** Traffic-Verteilung: percent Mobile (0–100); Desktop = 100 − device. */
  device: number;
  /** Wichtigste Traffic-Kanäle (multi-select). */
  channels: string[];
  /**
   * Explicit per-stage URLs + selection. When present, the pipeline analyzes
   * exactly the selected targets (no auto-discovery). When absent, the pipeline
   * falls back to discovering page types from `url`.
   */
  targets?: PageTarget[];
}

/** A single conversion lever bound to one real element. */
export interface Lever {
  id: string;
  /** Display number on the pin + card. */
  n: number;
  /** Reference to the enumerated DOM element this finding is bound to. */
  elementId?: string;
  /** Pin position as percent of the full-page screenshot (from real bbox). */
  pin: { x: number; y: number };
  category: LeverCategory;
  /** Specific display label (may be finer than the taxonomy default). */
  categoryLabel: string;
  impact: ImpactLevel;
  /** CR uplift band in percentage points [low, high]; from the rubric. */
  range: [number, number];
  type: LeverType;
  title: string;
  observation: string;
  mechanism: string;
  test: string;
  /** Whether the element/page was reachable (Build-Spec §6 honesty rule). */
  reachable?: boolean;
}

/** One analyzed funnel page. */
export interface AnalyzedPage {
  id: string;
  type: PageType;
  name: string;
  opportunity: ImpactLevel;
  /** Persisted screenshot URL (Vercel Blob). Undefined → render mock screen. */
  screenshotUrl?: string;
  viewport: Viewport;
  levers: Lever[];
}

export interface AnalysisMeta {
  url: string;
  industry: string;
  device: number;
  channels: string[];
  analyzedPages: string[];
  /** ISO-8601 timestamp. */
  date: string;
}

export interface OverallUplift {
  low: number;
  high: number;
  note: string;
}

/** The complete analysis result (assembled client-side from the stream). */
export interface AnalysisResult {
  meta: AnalysisMeta;
  overall: OverallUplift;
  pages: AnalyzedPage[];
  notes: string[];
}

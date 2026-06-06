/*
 * Internal artifacts produced by the render layer (M3) and consumed by the
 * Vision layer (M4). These never leave the server.
 */

import type { PageType, Viewport } from "@/lib/types";

/**
 * A candidate element enumerated from the rendered page, with its bounding box
 * in ABSOLUTE document coordinates (px) — the basis for pin geometry. The model
 * picks an element by id; we compute the pin from this box, never from the
 * model's guess (Build-Spec §4).
 */
export interface EnumeratedElement {
  id: string;
  tag: string;
  role?: string;
  text: string;
  /** Absolute document coords in px. */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface RenderedView {
  viewport: Viewport;
  /** Full-page screenshot as PNG bytes. */
  screenshot: Buffer;
  /** Full document dimensions in px (for pin percentage math). */
  docWidth: number;
  docHeight: number;
  elements: EnumeratedElement[];
}

export interface RenderedPage {
  id: string;
  type: PageType;
  name: string;
  url: string;
  /** Primary (desktop) view shown in the report. */
  desktop: RenderedView;
  /** Mobile view — feeds the mobile dimension (Build-Spec §5). */
  mobile?: RenderedView;
  /** Cleaned text content of the page. */
  content: string;
  reachable: boolean;
}

/** Discovery result — the representative URLs to render. */
export interface DiscoveredUrls {
  home: string;
  plp?: string;
  pdp?: string;
  /** How discovery resolved these (for transparency in the report). */
  method: "sitemap" | "nav-fallback" | "home-only";
}

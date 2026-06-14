/*
 * Hero — "Dark cinematic" Einstieg (Design-Handoff "ConversionScan Hero",
 * Variante 01), adaptiert auf die Netzproduzenten-Marke (Navy-Bühne, NP-Logo,
 * Gantari, grüner CTA). Vollbild-Overlay (position:fixed) über der App-Topbar.
 *
 * Wand aus driftenden ECHTEN Shop-Screenshots (public/hero/*.jpg). Spalten mit
 * GEMISCHTER Breite: breite Desktop-Kacheln (Querformat) + schmale Mobile-
 * Kacheln (Hochformat) → sichtbarer Desktop/Mobile-Mix. Drift sehr langsam,
 * pausiert bei prefers-reduced-motion (CSS).
 */

/* eslint-disable @next/next/no-img-element -- statische lokale Bilder (Logo + Screenshot-Kacheln); next/image bringt hier keinen Vorteil */

import { Loader2 } from "lucide-react";

// Desktop = Querformat (breite Kacheln), Mobile = Hochformat (schmale Kacheln).
const DESKTOP_SHOTS = [
  "/hero/nikin-home-d.jpg",
  "/hero/ringladen-pdp-d.jpg",
  "/hero/leds24-pdp-d.jpg",
  "/hero/ringladen-home-d.jpg",
  "/hero/nikin-checkout-d.jpg",
];
const MOBILE_SHOTS = [
  "/hero/brandible-home-m.jpg",
  "/hero/leds24-pdp-m.jpg",
  "/hero/electropapa-checkout-m.jpg",
  "/hero/wunderwunsch-pdp-m.jpg",
  "/hero/nikin-checkout-m.jpg",
  "/hero/leds24-checkout-m.jpg",
];

// Spalten: gemischte Breite, weniger (breite) Desktop-Spalten als Mobile.
// Sehr langsamer Drift; leicht unterschiedliche Tempi je Spalte (Parallax).
type Col = { kind: "d" | "m"; w: number; dur: number };
const COLUMNS: Col[] = [
  { kind: "m", w: 196, dur: 138 },
  { kind: "d", w: 430, dur: 156 },
  { kind: "m", w: 196, dur: 120 },
  { kind: "d", w: 430, dur: 168 },
  { kind: "m", w: 196, dur: 130 },
  { kind: "d", w: 430, dur: 150 },
  { kind: "m", w: 196, dur: 124 },
];
const TILES_PER_COL = 5;

function Column({ index, col }: { index: number; col: Col }) {
  const pool = col.kind === "d" ? DESKTOP_SHOTS : MOBILE_SHOTS;
  const tiles = Array.from(
    { length: TILES_PER_COL },
    (_, i) => pool[(index * 2 + i) % pool.length],
  );
  const seq = [...tiles, ...tiles]; // doppelt → nahtlose Schleife
  const up = index % 2 === 0;
  return (
    <div className="hero-col" style={{ width: col.w }}>
      <div
        className="hero-col-stack"
        style={{
          animationName: up ? "hero-drift-up" : "hero-drift-down",
          animationDuration: `${col.dur}s`,
        }}
      >
        {seq.map((src, i) => (
          <div className={`hero-tile hero-tile--${col.kind}`} key={i}>
            <img src={src} alt="" loading="lazy" draggable={false} />
          </div>
        ))}
      </div>
    </div>
  );
}

export interface HeroProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  busy?: boolean;
  /** Optionale, dezente Status-Zeile unter der Pill (z.B. Seiten-Erkennung). */
  status?: React.ReactNode;
}

export function Hero({ value, onChange, onSubmit, busy, status }: HeroProps) {
  return (
    <div className="hero">
      {/* Ebene 0 — driftende Screenshot-Wand */}
      <div className="hero-wall" aria-hidden="true">
        {COLUMNS.map((col, i) => (
          <Column key={i} index={i} col={col} />
        ))}
      </div>

      {/* Ebene 1 — Scrims/Vignette für Lesbarkeit */}
      <div className="hero-scrim hero-scrim--radial" aria-hidden="true" />
      <div className="hero-scrim hero-scrim--vert" aria-hidden="true" />

      {/* Ebene 3 — Inhalt */}
      <div className="hero-content">
        <div className="hero-brand">
          <img
            className="hero-logo"
            src="/brand/netzproduzenten-logo-weiss.svg"
            alt="Netzproduzenten"
          />
        </div>

        <div className="hero-headline-block">
          <h1 className="hero-headline">
            Wo du in deinem Onlineshop Conversions verlierst
          </h1>
          <p className="hero-sub">Insights aus 350+ Optimierungsprojekten</p>
        </div>

        <form
          className="hero-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!busy) onSubmit();
          }}
        >
          <input
            className="hero-input"
            type="url"
            inputMode="url"
            placeholder="https://dein-shop.de"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            aria-label="Shop-URL"
          />
          <button className="hero-submit" type="submit" disabled={busy}>
            {busy ? (
              <>
                <Loader2 size={16} className="spin" /> Analysiere …
              </>
            ) : (
              "Analysieren"
            )}
          </button>
        </form>

        {status ? <div className="hero-status">{status}</div> : null}
      </div>
    </div>
  );
}

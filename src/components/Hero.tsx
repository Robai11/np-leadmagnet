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

import { Loader2, Sparkles } from "lucide-react";

// Nur die kuratierten Screenshots aus dem Ordner: Desktop = Querformat (breite
// Kacheln), Mobile = Hochformat (schmale Kacheln).
const DESKTOP_SHOTS = [
  "/hero/xd-1.jpg",
  "/hero/xd-2.jpg",
  "/hero/xd-3.jpg",
  "/hero/xd-4.jpg",
  "/hero/xd-5.jpg",
  "/hero/xd-6.jpg",
];
const MOBILE_SHOTS = [
  "/hero/xm-1.jpg",
  "/hero/xm-2.jpg",
  "/hero/xm-3.jpg",
];

// Dekoratives Uplift-Label pro Screenshot (illustrativ, keine echten Messwerte
// einzelner Shops). Pro Bild fix zugeordnet → beide Schleifen-Kopien zeigen
// denselben Wert; genug Werte für alle 20 Bilder (jeder Wert einmal).
const UPLIFT_VALUES = [
  "+3 %", "+0,8 %", "+5 %", "+12 %", "+2 %", "+18 %", "+1,5 %", "+7 %",
  "+9 %", "+4 %", "+24 %", "+0,5 %", "+6 %", "+15 %", "+2,5 %", "+11 %",
  "+8 %", "+1 %", "+33 %", "+4,5 %",
];
const ALL_SHOTS = [...DESKTOP_SHOTS, ...MOBILE_SHOTS];
const UPLIFT: Record<string, string> = Object.fromEntries(
  ALL_SHOTS.map((s, i) => [s, UPLIFT_VALUES[i % UPLIFT_VALUES.length]]),
);

// Dichte, randlose Wand: 5 Spalten im Wechsel schmal(Mobile)/breit(Desktop).
// Jede Spalte eine DISTINKTE Bildmenge → jedes Bild GENAU EINMAL (keine
// Dubletten); die Verdopplung dient nur der nahtlosen Endlos-Schleife.
type Col = { kind: "d" | "m"; dur: number; imgs: string[] };
const COLUMNS: Col[] = [
  { kind: "d", dur: 172, imgs: DESKTOP_SHOTS.slice(0, 3) },
  { kind: "m", dur: 146, imgs: MOBILE_SHOTS },
  { kind: "d", dur: 184, imgs: DESKTOP_SHOTS.slice(3, 6) },
];

function Column({ index, col }: { index: number; col: Col }) {
  const seq = [...col.imgs, ...col.imgs]; // doppelt NUR für die nahtlose Schleife
  const up = index % 2 === 0;
  return (
    <div className={`hero-col hero-col--${col.kind}`}>
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
            <span className="hero-uplift">{UPLIFT[src]}</span>
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
            In wenigen Sekunden zu 10+ personalisierten Optimierungen für
            deinen Shop
          </h1>
          <p className="hero-sub">
            Keine Optimierungen von der Stange, sondern individuell auf deinen
            Shop abgestimmt.
          </p>
        </div>

        <div className="hero-cta">
          <p className="hero-eyebrow">
            <Sparkles size={17} aria-hidden="true" />
            Unsere KI ist auf 10 Jahren Agentur-Kundenprojekten trainiert
          </p>

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
    </div>
  );
}

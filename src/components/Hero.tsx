/*
 * Hero — "Dark cinematic" Einstieg (Design-Handoff "ConversionScan Hero",
 * Variante 01), adaptiert auf die Netzproduzenten-Marke (Navy-Bühne, NP-Logo,
 * Gantari, grüner CTA). Vollbild-Overlay (position:fixed) über der App-Topbar.
 *
 * Effekt: eine leicht gekippte Wand aus driftenden ECHTEN Shop-Screenshots
 * (public/hero/*.jpg), darüber Vignette/Scrim für Lesbarkeit, zentrale Headline
 * + Glas-Pill mit URL-Feld und "Analysieren". Drift pausiert bei
 * prefers-reduced-motion (CSS).
 */

/* eslint-disable @next/next/no-img-element -- statische lokale Bilder (Logo + Screenshot-Kacheln); next/image bringt hier keinen Vorteil */

import { Loader2 } from "lucide-react";

// Echte Shop-Screenshots (oben zugeschnitten, optimiert). Mischung aus
// Startseite / Produktseite / Checkout und Desktop / Mobile.
const HERO_SHOTS = [
  "/hero/nikin-home-d.jpg",
  "/hero/leds24-pdp-m.jpg",
  "/hero/electropapa-checkout-m.jpg",
  "/hero/ringladen-pdp-d.jpg",
  "/hero/brandible-home-m.jpg",
  "/hero/nikin-checkout-m.jpg",
  "/hero/leds24-pdp-d.jpg",
  "/hero/wunderwunsch-pdp-m.jpg",
  "/hero/ringladen-home-d.jpg",
  "/hero/leds24-checkout-m.jpg",
  "/hero/nikin-checkout-d.jpg",
];

// Leicht unterschiedliche Tempi je Spalte → lebendiger Parallax (Handoff).
// Sehr langsamer, ruhiger Drift (~2,6× langsamer als der Handoff-Default).
const DURATIONS = [136, 114, 156, 122, 146, 110, 152, 130];
const TILES_PER_COL = 5;

function Column({ index }: { index: number }) {
  // Pro Spalte eine versetzte Screenshot-Folge; Liste DOPPELT rendern → nahtlose Schleife.
  const tiles = Array.from(
    { length: TILES_PER_COL },
    (_, i) => HERO_SHOTS[(index * 3 + i) % HERO_SHOTS.length],
  );
  const seq = [...tiles, ...tiles];
  const up = index % 2 === 0;
  return (
    <div className="hero-col">
      <div
        className="hero-col-stack"
        style={{
          animationName: up ? "hero-drift-up" : "hero-drift-down",
          animationDuration: `${DURATIONS[index % DURATIONS.length]}s`,
        }}
      >
        {seq.map((src, i) => (
          <div className="hero-tile" key={i}>
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
        {DURATIONS.map((_, i) => (
          <Column key={i} index={i} />
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

/*
 * Hero — Step-1-Inhalt (Logo, Headline, NP-blaue Eingabe-Karte) auf der
 * cinematic Navy-Bühne. Die driftende Screenshot-Wand + Scrims liegen als
 * persistenter Hintergrund im Flow-Container (siehe InputStage / HeroWall),
 * damit sie über die Schritte hinweg animieren können.
 */

/* eslint-disable @next/next/no-img-element -- statisches lokales Logo */

import { Loader2, Sparkles, TrendingUp } from "lucide-react";

// Seiten, die im Funnel analysiert werden (Anzeige im Karten-Kopf).
const ANALYZED_PAGES = [
  "Startseite",
  "Product Listing Page",
  "Produktdetailseite",
  "Warenkorb",
  "Checkout",
];

export interface HeroProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  busy?: boolean;
  /** Optionale, dezente Status-Zeile unter der Pill (z.B. Seiten-Erkennung). */
  status?: React.ReactNode;
  /** Übergang aktiv → Inhalt taucht in die geöffnete Wand-Mitte ab. */
  leaving?: boolean;
  /** Seiten werden gerade erkannt → Button ausgegraut + rotierender Text. */
  loading?: boolean;
  /** Rotierender Button-Text während loading. */
  loadingLabel?: string;
  /** Erkennung fertig → Button freigeschaltet ("Analyse starten"). */
  ready?: boolean;
}

export function Hero({
  value,
  onChange,
  onSubmit,
  busy,
  status,
  leaving,
  loading,
  loadingLabel,
  ready,
}: HeroProps) {
  return (
    <div className={`hero-content ${leaving ? "is-leaving" : ""}`}>
      <div className="hero-brand">
        <img
          className="hero-logo"
          src="/brand/netzproduzenten-logo-weiss.svg"
          alt="Netzproduzenten"
        />
      </div>

      <div className="hero-headline-block">
        <h1 className="hero-headline">
          In wenigen Sekunden zu 10+ personalisierten Optimierungen für deinen
          Shop
        </h1>
      </div>

      <div className="hero-prio">
        <TrendingUp size={18} aria-hidden="true" />
        Priorisiert nach Umsatz-Effekt und Änderungsaufwand
      </div>

      <div className="hero-cta">
        <div className={`hero-entry ${loading ? "is-scanning" : ""}`}>
          <div className="hero-entry-head">
            <p className="hero-eyebrow">
              <Sparkles size={17} aria-hidden="true" />
              Entwickelt aus 10 Jahren Conversion-Optimierung
            </p>

            <ul className="hero-scope">
              {ANALYZED_PAGES.map((page) => (
                <li key={page}>
                  <span className="hero-dot" aria-hidden="true" />
                  {page}
                </li>
              ))}
            </ul>
          </div>

          <form
            className="hero-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!busy && !loading) onSubmit();
            }}
          >
            <span className="hero-form-label">KI-Analyse</span>
            <input
              className="hero-input"
              type="url"
              inputMode="url"
              placeholder="https://dein-shop.de"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              aria-label="Shop-URL"
            />
            <button
              className={`hero-submit ${loading && !busy ? "is-loading" : ""}`}
              type="submit"
              disabled={busy || loading}
            >
              {busy ? (
                <>
                  <Loader2 size={16} className="spin" /> Analysiere …
                </>
              ) : loading ? (
                (loadingLabel ?? "Lese deine Seiten …")
              ) : ready ? (
                "Analyse starten"
              ) : (
                "Analysieren"
              )}
            </button>
          </form>
        </div>

        {status ? <div className="hero-status">{status}</div> : null}
      </div>
    </div>
  );
}

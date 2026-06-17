/*
 * Hero — Step-1-Inhalt (Logo, Headline, NP-blaue Eingabe-Karte) auf der
 * cinematic Navy-Bühne. Die driftende Screenshot-Wand + Scrims liegen als
 * persistenter Hintergrund im Flow-Container (siehe InputStage / HeroWall),
 * damit sie über die Schritte hinweg animieren können.
 */

/* eslint-disable @next/next/no-img-element -- statisches lokales Logo */

import {
  Loader2,
  TrendingUp,
  Briefcase,
  Trophy,
  Users,
  Brain,
  Cpu,
} from "lucide-react";

// "Die Knowledge Engine dahinter" — die vier Wissensquellen als Module der
// Engine, oberhalb des URL-Felds in die Eingabe-Karte eingewoben.
const KNOWLEDGE_ENGINE = [
  {
    icon: Briefcase,
    title: "10 Jahre Agenturkundenprojekte",
    sub: "in diversen Branchen",
  },
  {
    icon: Trophy,
    title: "Tricks & Kniffe der Top-500-Shops",
    sub: "aus echter Praxis",
  },
  {
    icon: Users,
    title: "Kuratierte Insights",
    sub: "von Senior-Conversion-Experten",
  },
  {
    icon: Brain,
    title: "Konsumpsychologie",
    sub: "von Nobelpreisträgern",
  },
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
          In wenigen Minuten zu 10+ personalisierten Optimierungen für deinen
          Shop
        </h1>
        <p className="hero-subline">
          <TrendingUp size={20} aria-hidden="true" />
          Priorisiert nach Umsatz-Effekt und Änderungsaufwand
        </p>
      </div>

      <div className="hero-cta">
        <div className={`hero-entry ${loading ? "is-scanning" : ""}`}>
          <div className="kev3-head">
            <span className="kev-kicker">
              <Cpu size={14} aria-hidden="true" /> Die Knowledge Engine dahinter
            </span>
            <div className="kev3-strip">
              {KNOWLEDGE_ENGINE.map((u) => (
                <div className="kev3-tile" key={u.title}>
                  <span className="kev3-ico">
                    <u.icon size={18} aria-hidden="true" />
                  </span>
                  <b>{u.title}</b>
                  <span>{u.sub}</span>
                </div>
              ))}
            </div>
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

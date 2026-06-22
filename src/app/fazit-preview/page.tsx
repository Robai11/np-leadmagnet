"use client";

/*
 * /fazit-preview — dev-only Auswahlseite: drei Layout-Varianten für den Kopf
 * der Ergebnisseite (Titel + Potenzial + Fazit), die zusammen stimmiger wirken
 * als drei konkurrierende Blöcke nebeneinander. Dev-only (404 in Produktion).
 */

import { Sparkles, Check, TrendingUp } from "lucide-react";
import { notFound } from "next/navigation";

const M = {
  url: "https://hoeffner.de",
  total: 25,
  pages: 5,
  mobile: 70,
  channels: "Google Ads, SEO / organisch",
  industry: "Consumer Electronics & Technik",
  low: 6,
  high: 15,
  verdict:
    "Über den gesamten Funnel liegen die größten Hebel auf der Produktseite und im Checkout — hier entscheidet sich, ob aus Interesse ein Kauf wird. Mobile ist besonders kritisch, da der Großteil deines Traffics dort landet. Mit gezielten Anpassungen an Kauf-Buttons, Trust-Elementen und Checkout-Reibung lässt sich das Potenzial am schnellsten heben.",
  points: [
    "Produktseite: klarer, durchgängig sichtbarer Kauf-Button — besonders mobil.",
    "Checkout: unnötige Felder und Ablenkungen entfernen, Fortschritt zeigen.",
    "Startseite: Wertversprechen above the fold schärfen statt nur Kategorien.",
    "Warenkorb: Versandkosten und Lieferzeit früh transparent ausweisen.",
  ],
};

function Title() {
  return (
    <div>
      <span className="kicker">Funnel-Analyse · {M.url}</span>
      <h2>
        {M.total} Conversion-Hebel über {M.pages} Seiten gefunden
      </h2>
      <div className="ctx-frame">
        Analysiert mit Blick auf: <b>{M.mobile}% Mobile</b> · <b>{M.channels}</b>{" "}
        · <b>{M.industry}</b>
      </div>
    </div>
  );
}

function UpliftPanel() {
  return (
    <div className="headline-uplift">
      <span>Geschätztes Gesamtpotenzial</span>
      <strong>
        +{M.low}–{M.high}%
      </strong>
      <em>Hypothese · konservativ gedeckelt, keine Summe der Einzelwerte.</em>
    </div>
  );
}

function Points({ cls }: { cls: string }) {
  return (
    <ul className={cls}>
      {M.points.map((p, i) => (
        <li key={i}>
          <Check size={14} aria-hidden="true" />
          <span>{p}</span>
        </li>
      ))}
    </ul>
  );
}

/* V1 — klassischer Kopf (Titel | Potenzial), Fazit als volle Band darunter. */
function Variant1() {
  return (
    <div className="stage">
      <div className="report-head">
        <Title />
        <UpliftPanel />
      </div>
      <div className="fazit-band">
        <span className="fazit-band-kicker">
          <Sparkles size={14} aria-hidden="true" /> Fazit
        </span>
        <p className="fazit-band-text">{M.verdict}</p>
        <Points cls="fazit-band-points" />
      </div>
    </div>
  );
}

/* V2 — Titel links, EIN vereintes Navy-Panel rechts (Potenzial + Fazit). */
function Variant2() {
  return (
    <div className="stage">
      <div className="report-head report-head--v2">
        <Title />
        <div className="summary-panel">
          <div className="summary-panel-uplift">
            <span>Geschätztes Gesamtpotenzial</span>
            <strong>
              +{M.low}–{M.high}%
            </strong>
          </div>
          <div className="summary-panel-body">
            <span className="summary-panel-kicker">
              <Sparkles size={14} aria-hidden="true" /> Fazit
            </span>
            <p>{M.verdict}</p>
            <Points cls="summary-panel-points" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* V3 — schlanker Titel oben, Fazit als großer Navy-Banner mit Potenzial-Stat. */
function Variant3() {
  return (
    <div className="stage">
      <div className="fazit-slim-head">
        <span className="kicker">Funnel-Analyse · {M.url}</span>
        <h2>
          {M.total} Conversion-Hebel über {M.pages} Seiten gefunden
        </h2>
        <div className="ctx-frame">
          Analysiert mit Blick auf: <b>{M.mobile}% Mobile</b> · <b>{M.channels}</b>{" "}
          · <b>{M.industry}</b>
        </div>
      </div>
      <div className="fazit-hero">
        <div className="fazit-hero-main">
          <span className="fazit-hero-kicker">
            <Sparkles size={15} aria-hidden="true" /> Fazit
          </span>
          <p className="fazit-hero-text">{M.verdict}</p>
          <Points cls="fazit-hero-points" />
        </div>
        <div className="fazit-hero-stat">
          <TrendingUp size={18} aria-hidden="true" />
          <span>Geschätztes Gesamtpotenzial</span>
          <strong>
            +{M.low}–{M.high}%
          </strong>
        </div>
      </div>
    </div>
  );
}

export default function FazitPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const variants = [
    { n: 1, name: "Fazit-Band unter dem Kopf (hell)", el: <Variant1 /> },
    { n: 2, name: "Vereintes Navy-Panel rechts (Potenzial + Fazit)", el: <Variant2 /> },
    { n: 3, name: "Fazit als Navy-Banner mit Potenzial-Stat", el: <Variant3 /> },
  ];

  return (
    <div className="cs-root fzv-preview">
      <header className="fzv-head">
        <h1>Fazit-Bereich — 3 Layout-Varianten</h1>
        <p>
          Für den Kopf der Ergebnisseite. Sag mir, welche dir gefällt — dann baue
          ich sie in die ReportStage ein.
        </p>
      </header>

      {variants.map((v) => (
        <section className="fzv-variant" key={v.n}>
          <div className="fzv-label">
            <span className="fzv-num">Variante {v.n}</span>
            {v.name}
          </div>
          {v.el}
        </section>
      ))}
    </div>
  );
}

/*
 * OverviewStep — "So läuft deine Analyse": erster geführter Schritt nach der
 * Landing. Erklärt den Ablauf (Seiten prüfen → Kontext → KI durchläuft den Shop
 * wie ein Mensch) und zeigt rechts eine visuelle Vorschau, wie der Report
 * aussieht. Gestaffelte Einblend-Effekte; sitzt im .fstep-Rahmen (Zurück +
 * Fortschritt kommen von InputStage).
 */

import {
  Search,
  SlidersHorizontal,
  MousePointer2,
  ArrowRight,
  BarChart3,
} from "lucide-react";

const STEPS = [
  {
    icon: Search,
    title: "Seiten prüfen",
    text: "Wir haben die wichtigsten Seiten deines Shops erkannt — du prüfst und korrigierst gleich die URLs.",
  },
  {
    icon: SlidersHorizontal,
    title: "Kurz-Kontext",
    text: "Ein paar Angaben zu Branche, Traffic-Verteilung und Kanälen schärfen die Empfehlungen.",
  },
  {
    icon: MousePointer2,
    title: "KI-Analyse wie ein echter Nutzer",
    text: "Unsere KI ruft deinen Shop auf, klickt sich durch, legt ein Produkt in den Warenkorb und durchläuft den Checkout — wie ein Mensch.",
  },
];

// Illustrative Beispiel-Hebel für die Report-Vorschau (KEINE echten Messwerte).
const PREVIEW_LEVERS = [
  { label: "Versandkosten früher anzeigen", impact: "high", bar: 88 },
  { label: "Produktbilder vergrößern", impact: "mid", bar: 64 },
  { label: "Trust-Siegel im Checkout", impact: "low", bar: 41 },
];

export function OverviewStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="fstep-body ovw">
      <div className="fstep-main ovw-main">
        <span className="fstep-kicker">So läuft deine Analyse</span>
        <h2 className="fstep-title">In wenigen Schritten zu deinem Report</h2>

        <ol className="ovw-steps">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            return (
              <li key={i} style={{ animationDelay: `${0.2 + i * 0.13}s` }}>
                <span className="ovw-step-ico">
                  <Icon size={18} aria-hidden="true" />
                </span>
                <div className="ovw-step-text">
                  <strong>{s.title}</strong>
                  <p>{s.text}</p>
                </div>
              </li>
            );
          })}
        </ol>

        <div className="fstep-actions">
          <button className="cta" onClick={onNext}>
            Los geht&rsquo;s <ArrowRight size={18} />
          </button>
        </div>
      </div>

      <div className="fstep-aside">
        <div className="ovw-preview">
          <div className="ovw-preview-head">
            <span className="ovw-preview-title">
              <BarChart3 size={15} aria-hidden="true" /> Dein Report
            </span>
            <span className="ovw-preview-tag">Beispiel</span>
          </div>

          <div className="ovw-stat">
            <strong>10+</strong>
            <span>
              priorisierte Optimierungen
              <br />
              mit Impact-Score je Seite
            </span>
          </div>

          <ul className="ovw-levers">
            {PREVIEW_LEVERS.map((l, i) => (
              <li key={i}>
                <span className={`ovw-imp ovw-imp--${l.impact}`} />
                <span className="ovw-lever-label">{l.label}</span>
                <span className="ovw-bar">
                  <i
                    style={{
                      width: `${l.bar}%`,
                      animationDelay: `${0.5 + i * 0.14}s`,
                    }}
                  />
                </span>
              </li>
            ))}
          </ul>

          <span className="ovw-more">
            + 7 weitere Hebel im vollständigen Report
          </span>
        </div>
      </div>
    </div>
  );
}

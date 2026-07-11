/* eslint-disable @next/next/no-img-element -- statisches SVG-Markenlogo; next/image bringt für SVG keinen Vorteil */

/**
 * Globale Topbar: NP-Logo oben links, Aktionen oben rechts (optionaler
 * "Neue Analyse"-Button + CTA "Jetzt Gespräch vereinbaren"). Von App und der
 * Report-Vorschau genutzt, damit das Logo überall auf der Ergebnisseite sitzt.
 */
export function Topbar({ onRestart }: { onRestart?: () => void }) {
  return (
    <header className="topbar">
      <div className="brand">
        <img
          className="brand-logo"
          src="/brand/netzproduzenten-logo-weiss.svg"
          alt="Netzproduzenten"
        />
        <span className="brand-sep" aria-hidden="true" />
        ConversionScan
      </div>
      <div className="topbar-actions">
        {onRestart && (
          <button className="restart" onClick={onRestart}>
            Neue Analyse
          </button>
        )}
        {/* TODO: echte Buchungs-URL (Calendly o.ä.) statt Platzhalter eintragen. */}
        <a className="topbar-cta" href="#kontakt">
          Jetzt Gespräch vereinbaren
        </a>
      </div>
    </header>
  );
}

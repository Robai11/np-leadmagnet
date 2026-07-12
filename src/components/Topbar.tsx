/* eslint-disable @next/next/no-img-element -- statisches SVG-Markenlogo; next/image bringt für SVG keinen Vorteil */

import type { CSSProperties } from "react";

/*
 * Team-Avatare (Variante 1): jeder Avatar ist ein rundes „Fenster" auf EIN
 * Gesicht im selben Teamfoto (/brand/team.jpg), gesteuert über --fx (horizontale
 * Position). Fehlt die Datei, bleibt ein sauberer Navy-Kreis. Die Prozentwerte
 * sind auf das echte Foto (16 Personen nebeneinander) auszurichten — grob die
 * zwei Gründer mittig + zwei weitere Gesichter.
 * TODO: --fx nach Einsetzen des echten Fotos feinjustieren.
 */
const TEAM_FACES: number[] = [37, 43, 50, 56]; // background-position-x in % (helle Mitte)

/**
 * Globale Topbar: NP-Logo oben links, Aktionen oben rechts (Team-Avatare +
 * optionaler "Neue Analyse"-Button + CTA "Jetzt Gespräch vereinbaren"). Von App
 * und der Report-Vorschau genutzt, damit alles überall auf der Ergebnisseite
 * sitzt. Der Team-Cluster wird per CSS nur im Report-Kontext eingeblendet.
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
        <span className="topbar-team">
          <span className="topbar-team-avs" aria-hidden="true">
            {TEAM_FACES.map((fx, i) => (
              <span
                key={i}
                className="topbar-team-av"
                style={{ "--fx": `${fx}%` } as CSSProperties}
              />
            ))}
          </span>
          <span className="topbar-team-note">
            <small>Sprich mit</small>
            <strong>deinem Team</strong>
          </span>
        </span>
        {/* TODO: echte Buchungs-URL (Calendly o.ä.) statt Platzhalter eintragen. */}
        <a className="topbar-cta" href="#kontakt">
          Jetzt Gespräch vereinbaren
        </a>
      </div>
    </header>
  );
}

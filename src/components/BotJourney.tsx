"use client";

/*
 * BotJourney — gescriptete "KI-Bot durchläuft den Shop"-Animation für den
 * Warte-Screen (Stufe 1, stilisiert mit den Wireframes). Der Bot-Cursor wandert
 * Szene für Szene durch den Funnel: Startseite umschauen → klicken → Kategorie
 * filtern → PDP lesen/scrollen → Warenkorb → Checkout. Der Scan-Effekt erscheint
 * an passenden Stellen. Läuft in Schleife, bis die Analyse fertig ist.
 */

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { Wireframe } from "@/components/Wireframes";
import type { PageType } from "@/lib/types";

type Scene = {
  type: PageType;
  caption: string;
  cx: string; // Ziel-X des Cursors/Hotspots (in % der Bühne)
  cy: string;
  scan?: boolean; // Scan-Linie in dieser Szene
  scroll?: boolean; // "liest/scrollt" — Inhalt driftet
};

const SCENES: Scene[] = [
  { type: "home", caption: "schaut sich auf der Startseite um", cx: "34%", cy: "44%", scan: true },
  { type: "home", caption: "klickt sich zu den Produkten", cx: "74%", cy: "21%" },
  { type: "plp", caption: "filtert die passende Kategorie", cx: "16%", cy: "52%", scan: true },
  { type: "pdp", caption: "liest die Produktbeschreibung", cx: "58%", cy: "48%", scroll: true },
  { type: "pdp", caption: "prüft Preis und Call-to-Action", cx: "70%", cy: "64%" },
  { type: "cart", caption: "legt das Produkt in den Warenkorb", cx: "80%", cy: "72%", scan: true },
  { type: "checkout", caption: "durchläuft den Checkout", cx: "34%", cy: "48%", scan: true },
];
const SCENE_MS = 3600;

export function BotJourney() {
  const [i, setI] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setI((n) => (n + 1) % SCENES.length), SCENE_MS);
    return () => clearTimeout(t);
  }, [i]);

  const s = SCENES[i];
  const targetStyle = { "--cx": s.cx, "--cy": s.cy } as CSSProperties;

  return (
    <div className="bot">
      <div className="bot-window" key={i}>
        <div className={`bot-screen ${s.scroll ? "is-scrolling" : ""}`}>
          <Wireframe type={s.type} />
        </div>

        {s.scan ? <span className="bot-scan" aria-hidden="true" /> : null}

        <span
          className="bot-hotspot"
          style={{ left: s.cx, top: s.cy }}
          aria-hidden="true"
        />
        <span className="bot-cursor" style={targetStyle} aria-hidden="true">
          <svg viewBox="0 0 24 24" width="26" height="26">
            <path
              d="M5 3l14 9-6 1 3.5 6-2.6 1.5L10.5 14 5 18z"
              fill="#fff"
              stroke="rgba(0,0,0,0.5)"
              strokeWidth="1"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>

      <p className="bot-caption">
        <span className="bot-badge">KI-Bot</span>
        {s.caption}
      </p>
    </div>
  );
}

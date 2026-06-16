"use client";

/*
 * BotJourney — gescriptete "KI-Bot durchläuft den Shop"-Animation für den
 * Warte-Screen. Desktop- und Mobile-Wireframe stehen nebeneinander und wechseln
 * sich als aktives Gerät ab (das inaktive graut aus). Desktop = Maus-Cursor,
 * Mobile = Finger. Die Pointer wandern Punkt zu Punkt (sie starten nicht jedes
 * Mal neu), Bewegungen & Seitenwechsel sind langsam. Der Scan-Effekt erscheint
 * nur selten. Läuft in Schleife, bis die Analyse fertig ist.
 */

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { Pointer } from "lucide-react";
import { Wireframe } from "@/components/Wireframes";
import { WireframeMobile } from "@/components/WireframeMobile";
import type { PageType } from "@/lib/types";

type Device = "desktop" | "mobile";
type Scene = {
  d: Device;
  p: PageType;
  x: string; // Pointer-Ziel in % des Geräts
  y: string;
  cap: string;
  scan?: boolean;
};

const SCENES: Scene[] = [
  { d: "desktop", p: "home", x: "32%", y: "42%", cap: "schaut sich auf der Startseite um", scan: true },
  { d: "desktop", p: "home", x: "74%", y: "22%", cap: "klickt sich in die Navigation" },
  { d: "desktop", p: "plp", x: "16%", y: "52%", cap: "setzt Filter in der Kategorie" },
  { d: "desktop", p: "plp", x: "58%", y: "46%", cap: "vergleicht die Produkte" },
  { d: "mobile", p: "pdp", x: "50%", y: "32%", cap: "öffnet ein Produkt am Smartphone" },
  { d: "mobile", p: "pdp", x: "50%", y: "58%", cap: "wischt durch die Produktbilder", scan: true },
  { d: "mobile", p: "pdp", x: "52%", y: "80%", cap: "liest Beschreibung und Bewertungen" },
  { d: "desktop", p: "pdp", x: "68%", y: "64%", cap: "prüft Preis und Call-to-Action" },
  { d: "desktop", p: "cart", x: "80%", y: "72%", cap: "legt das Produkt in den Warenkorb" },
  { d: "mobile", p: "cart", x: "58%", y: "72%", cap: "prüft den Warenkorb mobil", scan: true },
  { d: "mobile", p: "checkout", x: "50%", y: "64%", cap: "startet den Checkout am Handy" },
  { d: "desktop", p: "checkout", x: "34%", y: "50%", cap: "füllt die Checkout-Felder aus" },
  { d: "desktop", p: "checkout", x: "66%", y: "80%", cap: "kommt bis zur Zahlung" },
];
const SCENE_MS = 5000;

function lastFor(d: Device, upto: number): Scene {
  for (let k = upto; k >= 0; k--) if (SCENES[k].d === d) return SCENES[k];
  return SCENES.find((s) => s.d === d) as Scene;
}

export function BotJourney() {
  const [i, setI] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setI((n) => (n + 1) % SCENES.length), SCENE_MS);
    return () => clearTimeout(t);
  }, [i]);

  const cur = SCENES[i];
  const active = cur.d;
  const desk = lastFor("desktop", i);
  const mob = lastFor("mobile", i);
  const scanDesk = active === "desktop" && cur.scan;
  const scanMob = active === "mobile" && cur.scan;

  return (
    <div className="bot">
      <div className="bot-stage">
        <div
          className={`bot-dev bot-dev--desktop ${active === "desktop" ? "is-active" : ""}`}
        >
          <div className="bot-dev-screen" key={`d-${desk.p}`}>
            <Wireframe type={desk.p} />
            {scanDesk ? <span className="bot-scan" aria-hidden="true" /> : null}
          </div>
          <span
            className="bot-hotspot"
            style={{ left: desk.x, top: desk.y }}
            aria-hidden="true"
          />
          <span
            className="bot-cursor"
            style={{ left: desk.x, top: desk.y } as CSSProperties}
            aria-hidden="true"
          >
            <svg viewBox="0 0 24 24" width="28" height="28">
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

        <div
          className={`bot-dev bot-dev--mobile ${active === "mobile" ? "is-active" : ""}`}
        >
          <div className="bot-dev-screen" key={`m-${mob.p}`}>
            <WireframeMobile type={mob.p} />
            {scanMob ? (
              <span className="bot-scan bot-scan--mobile" aria-hidden="true" />
            ) : null}
          </div>
          <span
            className="bot-hotspot"
            style={{ left: mob.x, top: mob.y }}
            aria-hidden="true"
          />
          <span
            className="bot-thumb"
            style={{ left: mob.x, top: mob.y } as CSSProperties}
            aria-hidden="true"
          >
            <Pointer size={26} />
          </span>
        </div>
      </div>

      <p className="bot-caption">
        <span className="bot-badge">
          {active === "mobile" ? "Mobil" : "Desktop"}
        </span>
        KI-Bot {cur.cap}
      </p>
    </div>
  );
}

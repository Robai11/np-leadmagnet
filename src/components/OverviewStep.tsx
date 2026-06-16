"use client";

/*
 * OverviewStep — "Dein Shop wird ausgelesen": minimales Scan-Interstitial nach
 * der Landing. Cyclende Wireframes mit Scan-Linie erzeugen den Eindruck, dass
 * der Shop Seite für Seite gelesen und nach Potenzialen durchsucht wird.
 * Springt nach ~4 s automatisch zum nächsten Schritt (Fortschrittsbalken).
 */

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Wireframe } from "@/components/Wireframes";
import type { PageType } from "@/lib/types";

const SCAN_PAGES: { type: PageType; label: string }[] = [
  { type: "home", label: "Startseite" },
  { type: "plp", label: "Product Listing Page" },
  { type: "pdp", label: "Produktdetailseite" },
  { type: "cart", label: "Warenkorb" },
  { type: "checkout", label: "Checkout" },
];
const N = SCAN_PAGES.length;
const AUTO_ADVANCE_MS = 6000;
const CYCLE_MS = 1500;

export function OverviewStep({ onNext }: { onNext: () => void }) {
  const [active, setActive] = useState(0);

  // Wireframes cyclen (Scan-Gefühl)
  useEffect(() => {
    const t = setTimeout(() => setActive((a) => (a + 1) % N), CYCLE_MS);
    return () => clearTimeout(t);
  }, [active]);

  // Auto-Weiter nach ~4 s — Timer nur einmal setzen, latest onNext via Ref.
  const onNextRef = useRef(onNext);
  useEffect(() => {
    onNextRef.current = onNext;
  });
  useEffect(() => {
    const t = setTimeout(() => onNextRef.current(), AUTO_ADVANCE_MS);
    return () => clearTimeout(t);
  }, []);

  const cur = SCAN_PAGES[active];
  const next1 = SCAN_PAGES[(active + 1) % N];
  const next2 = SCAN_PAGES[(active + 2) % N];

  return (
    <div className="ovw">
      <div className="scan-inner">
        <header className="scan-head">
          <span className="fstep-kicker">Analyse läuft</span>
          <h2 className="scan-title">
            Ich prüfe deine Shop-URLs
            <span className="scan-dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
          </h2>
        </header>

        <div className="ovw-stage scan-stage">
          <div className="ovw-deck ovw-deck--2" aria-hidden="true">
            <Wireframe type={next2.type} />
          </div>
          <div className="ovw-deck ovw-deck--1" aria-hidden="true">
            <Wireframe type={next1.type} />
          </div>
          <div className="ovw-front" key={active}>
            <span className="ovw-front-tag">{cur.label}</span>
            <div className="scan-screen">
              <Wireframe type={cur.type} />
              <span className="scan-beam" aria-hidden="true" />
            </div>
          </div>
        </div>

        <p className="scan-caption">
          <Loader2 size={15} className="spin" /> Analysiere: {cur.label}
        </p>

        <div className="scan-progress" aria-hidden="true">
          <i />
        </div>
      </div>
    </div>
  );
}

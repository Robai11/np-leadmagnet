/*
 * Wireframes — abstrakte NP-Linien-Skizzen je Seitentyp für den Funnel-Wizard.
 * Browser-Chrome + Layout-Blöcke; der grüne Akzent markiert jeweils das
 * Conversion-Kernelement (CTA / Preis / Checkout-Button). Rein dekorativ
 * (aria-hidden) — Theming über die .wf-* Klassen in app.css.
 */

import type { PageType } from "@/lib/types";

function Chrome() {
  return (
    <>
      <rect className="wf-frame" x="6" y="6" width="288" height="208" rx="12" />
      <circle className="wf-dot" cx="20" cy="18" r="3" />
      <circle className="wf-dot" cx="32" cy="18" r="3" />
      <circle className="wf-dot" cx="44" cy="18" r="3" />
      <rect className="wf-omni" x="68" y="13" width="208" height="10" rx="5" />
      <line className="wf-divider" x1="6" y1="30" x2="294" y2="30" />
    </>
  );
}

function Home() {
  return (
    <svg viewBox="0 0 300 220" className="wf" aria-hidden="true">
      <Chrome />
      {/* Navigation */}
      <rect className="wf-block" x="18" y="40" width="40" height="10" rx="2" />
      <rect className="wf-block" x="150" y="42" width="28" height="6" rx="2" />
      <rect className="wf-block" x="186" y="42" width="28" height="6" rx="2" />
      <rect className="wf-block" x="222" y="42" width="28" height="6" rx="2" />
      {/* Hero-Banner mit CTA (Conversion-Kern) */}
      <rect className="wf-panel" x="18" y="58" width="264" height="54" rx="4" />
      <rect className="wf-line" x="30" y="70" width="120" height="7" rx="2" />
      <rect className="wf-line" x="30" y="82" width="90" height="6" rx="2" />
      <rect className="wf-accent" x="30" y="94" width="64" height="12" rx="3" />
      {/* Kategorie-Kacheln */}
      <rect className="wf-block" x="18" y="120" width="78" height="74" rx="4" />
      <rect className="wf-block" x="111" y="120" width="78" height="74" rx="4" />
      <rect className="wf-block" x="204" y="120" width="78" height="74" rx="4" />
    </svg>
  );
}

function Plp() {
  return (
    <svg viewBox="0 0 300 220" className="wf" aria-hidden="true">
      <Chrome />
      <rect className="wf-block" x="18" y="40" width="40" height="10" rx="2" />
      {/* Filter-Spalte */}
      <rect className="wf-panel" x="18" y="58" width="54" height="136" rx="4" />
      <rect className="wf-line" x="26" y="68" width="38" height="6" rx="2" />
      <rect className="wf-line" x="26" y="80" width="30" height="5" rx="2" />
      <rect className="wf-line" x="26" y="90" width="34" height="5" rx="2" />
      <rect className="wf-line" x="26" y="100" width="26" height="5" rx="2" />
      {/* Produktraster — eine Kachel hervorgehoben */}
      <rect className="wf-accent" x="82" y="58" width="94" height="62" rx="4" />
      <rect className="wf-block" x="186" y="58" width="96" height="62" rx="4" />
      <rect className="wf-block" x="82" y="130" width="94" height="62" rx="4" />
      <rect className="wf-block" x="186" y="130" width="96" height="62" rx="4" />
    </svg>
  );
}

function Pdp() {
  return (
    <svg viewBox="0 0 300 220" className="wf" aria-hidden="true">
      <Chrome />
      <rect className="wf-block" x="18" y="40" width="40" height="10" rx="2" />
      {/* Produktbild */}
      <rect className="wf-panel" x="18" y="58" width="120" height="120" rx="4" />
      <rect className="wf-block" x="18" y="184" width="22" height="14" rx="3" />
      <rect className="wf-block" x="44" y="184" width="22" height="14" rx="3" />
      <rect className="wf-block" x="70" y="184" width="22" height="14" rx="3" />
      {/* Details + CTA (Conversion-Kern) */}
      <rect className="wf-line" x="150" y="62" width="120" height="8" rx="2" />
      <rect className="wf-line" x="150" y="76" width="90" height="6" rx="2" />
      <rect className="wf-line" x="150" y="98" width="56" height="14" rx="3" />
      <rect className="wf-accent" x="150" y="132" width="132" height="20" rx="4" />
      <rect className="wf-line" x="150" y="164" width="132" height="5" rx="2" />
      <rect className="wf-line" x="150" y="174" width="100" height="5" rx="2" />
    </svg>
  );
}

function Cart() {
  return (
    <svg viewBox="0 0 300 220" className="wf" aria-hidden="true">
      <Chrome />
      <rect className="wf-block" x="18" y="40" width="40" height="10" rx="2" />
      {/* Positionen */}
      {[58, 92, 126].map((y) => (
        <g key={y}>
          <rect className="wf-panel" x="18" y={y} width="170" height="28" rx="4" />
          <rect className="wf-block" x="24" y={y + 5} width="18" height="18" rx="3" />
          <rect className="wf-line" x="48" y={y + 8} width="80" height="6" rx="2" />
          <rect className="wf-line" x="48" y={y + 18} width="50" height="5" rx="2" />
        </g>
      ))}
      {/* Summen-Box + Checkout-Button (Conversion-Kern) */}
      <rect className="wf-panel" x="196" y="58" width="86" height="120" rx="4" />
      <rect className="wf-line" x="204" y="70" width="60" height="6" rx="2" />
      <rect className="wf-line" x="204" y="84" width="48" height="6" rx="2" />
      <rect className="wf-accent" x="204" y="150" width="70" height="18" rx="4" />
    </svg>
  );
}

function Checkout() {
  return (
    <svg viewBox="0 0 300 220" className="wf" aria-hidden="true">
      <Chrome />
      <rect className="wf-block" x="18" y="40" width="40" height="10" rx="2" />
      {/* Formularfelder */}
      {[58, 78, 98, 118].map((y) => (
        <rect
          key={y}
          className="wf-panel"
          x="18"
          y={y}
          width="170"
          height="14"
          rx="3"
        />
      ))}
      {/* Bestellen-Button (Conversion-Kern) */}
      <rect className="wf-accent" x="18" y="150" width="170" height="20" rx="4" />
      {/* Bestellübersicht */}
      <rect className="wf-panel" x="196" y="58" width="86" height="112" rx="4" />
      <rect className="wf-line" x="204" y="70" width="60" height="6" rx="2" />
      <rect className="wf-line" x="204" y="84" width="48" height="6" rx="2" />
      <rect className="wf-line" x="204" y="98" width="54" height="6" rx="2" />
    </svg>
  );
}

const MAP: Record<PageType, () => React.ReactElement> = {
  home: Home,
  plp: Plp,
  pdp: Pdp,
  cart: Cart,
  checkout: Checkout,
};

export function Wireframe({ type }: { type: PageType }) {
  const Cmp = MAP[type];
  return <Cmp />;
}

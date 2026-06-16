/*
 * WireframeMobile — Hochformat-/Phone-Variante der Wireframes für die
 * Bot-Journey (Desktop = Wireframe, Mobile = WireframeMobile). Gleiche
 * .wf-* Theming-Klassen; grüner Akzent = Conversion-Kernelement. Dekorativ.
 */

import type { PageType } from "@/lib/types";

function Phone({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 150 300" className="wf" aria-hidden="true">
      <rect
        className="wf-frame"
        x="3"
        y="3"
        width="144"
        height="294"
        rx="22"
      />
      <rect className="wf-block" x="58" y="12" width="34" height="5" rx="2.5" />
      {children}
    </svg>
  );
}

function Home() {
  return (
    <Phone>
      <rect className="wf-block" x="16" y="30" width="42" height="8" rx="2" />
      <rect className="wf-block" x="120" y="30" width="14" height="8" rx="2" />
      <rect className="wf-panel" x="16" y="46" width="118" height="66" rx="5" />
      <rect className="wf-line" x="24" y="58" width="74" height="6" rx="2" />
      <rect className="wf-line" x="24" y="69" width="54" height="5" rx="2" />
      <rect className="wf-accent" x="24" y="84" width="58" height="14" rx="3" />
      <rect className="wf-block" x="16" y="122" width="56" height="58" rx="5" />
      <rect className="wf-block" x="78" y="122" width="56" height="58" rx="5" />
      <rect className="wf-block" x="16" y="188" width="56" height="58" rx="5" />
      <rect className="wf-block" x="78" y="188" width="56" height="58" rx="5" />
    </Phone>
  );
}

function Plp() {
  return (
    <Phone>
      <rect className="wf-block" x="16" y="30" width="42" height="8" rx="2" />
      <rect className="wf-line" x="16" y="46" width="32" height="10" rx="5" />
      <rect className="wf-line" x="52" y="46" width="32" height="10" rx="5" />
      <rect className="wf-line" x="88" y="46" width="32" height="10" rx="5" />
      <rect className="wf-accent" x="16" y="66" width="56" height="76" rx="5" />
      <rect className="wf-block" x="78" y="66" width="56" height="76" rx="5" />
      <rect className="wf-block" x="16" y="150" width="56" height="76" rx="5" />
      <rect className="wf-block" x="78" y="150" width="56" height="76" rx="5" />
    </Phone>
  );
}

function Pdp() {
  return (
    <Phone>
      <rect className="wf-block" x="16" y="30" width="42" height="8" rx="2" />
      <rect className="wf-panel" x="16" y="46" width="118" height="98" rx="5" />
      <rect className="wf-line" x="16" y="154" width="100" height="8" rx="2" />
      <rect className="wf-line" x="16" y="166" width="72" height="6" rx="2" />
      <rect className="wf-line" x="16" y="182" width="46" height="12" rx="3" />
      <rect className="wf-accent" x="16" y="204" width="118" height="18" rx="4" />
      <rect className="wf-line" x="16" y="232" width="118" height="5" rx="2" />
      <rect className="wf-line" x="16" y="242" width="108" height="5" rx="2" />
      <rect className="wf-line" x="16" y="252" width="118" height="5" rx="2" />
    </Phone>
  );
}

function Cart() {
  return (
    <Phone>
      <rect className="wf-block" x="16" y="30" width="42" height="8" rx="2" />
      {[48, 88].map((y) => (
        <g key={y}>
          <rect
            className="wf-panel"
            x="16"
            y={y}
            width="118"
            height="34"
            rx="5"
          />
          <rect
            className="wf-block"
            x="22"
            y={y + 5}
            width="24"
            height="24"
            rx="4"
          />
          <rect
            className="wf-line"
            x="52"
            y={y + 8}
            width="70"
            height="6"
            rx="2"
          />
          <rect
            className="wf-line"
            x="52"
            y={y + 19}
            width="44"
            height="5"
            rx="2"
          />
        </g>
      ))}
      <rect className="wf-line" x="16" y="146" width="70" height="7" rx="2" />
      <rect className="wf-line" x="104" y="146" width="30" height="7" rx="2" />
      <rect className="wf-accent" x="16" y="208" width="118" height="20" rx="4" />
    </Phone>
  );
}

function Checkout() {
  return (
    <Phone>
      <rect className="wf-block" x="16" y="30" width="42" height="8" rx="2" />
      {[48, 70, 92, 114, 136].map((y) => (
        <rect
          key={y}
          className="wf-panel"
          x="16"
          y={y}
          width="118"
          height="15"
          rx="3"
        />
      ))}
      <rect className="wf-accent" x="16" y="246" width="118" height="20" rx="4" />
    </Phone>
  );
}

const MAP: Record<PageType, () => React.ReactElement> = {
  home: Home,
  plp: Plp,
  pdp: Pdp,
  cart: Cart,
  checkout: Checkout,
};

export function WireframeMobile({ type }: { type: PageType }) {
  const Cmp = MAP[type];
  return <Cmp />;
}

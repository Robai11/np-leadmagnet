"use client";

/*
 * OverviewStep — "So läuft deine Analyse": erster geführter Schritt nach der
 * Landing. Macht Lust auf die Analyse:
 *  1) Cinematic Auto-Stack: alle 5 Seitentypen kommen nacheinander aus der
 *     Tiefe nach vorne, mit beispielhaften Optimierungs-Callouts (illustrativ).
 *  2) Uplift-Rechner (eingebetteter Calculator) unter der Frage, wie viel
 *     Conversion-Steigerung gewünscht ist.
 *  3) Trust: Wissen aus 10 Jahren CRO mit etablierten E-Commerce-Shops.
 * Sitzt im .fstep-Rahmen (Zurück + Fortschritt kommen von InputStage).
 */

import { useEffect, useState } from "react";
import { ArrowRight, Search, SlidersHorizontal, MousePointer2 } from "lucide-react";
import { Wireframe } from "@/components/Wireframes";
import { Calculator } from "@/components/Calculator";
import type { PageType } from "@/lib/types";

type Callout = { text: string; pos: "tl" | "tr" | "bl" | "br" };
const SHOWCASE: { type: PageType; label: string; opt: Callout[] }[] = [
  {
    type: "home",
    label: "Startseite",
    opt: [
      { text: "Wertversprechen above the fold  +6 %", pos: "tl" },
      { text: "Sticky-CTA mobil  +9 %", pos: "br" },
    ],
  },
  {
    type: "plp",
    label: "Product Listing Page",
    opt: [
      { text: "Filter sichtbarer machen  +8 %", pos: "tl" },
      { text: "Trust-Signale pro Kachel  +4 %", pos: "br" },
    ],
  },
  {
    type: "pdp",
    label: "Produktdetailseite",
    opt: [
      { text: "CTA prominenter  +12 %", pos: "tr" },
      { text: "Trust-Siegel am Preis  +5 %", pos: "bl" },
    ],
  },
  {
    type: "cart",
    label: "Warenkorb",
    opt: [
      { text: "Versandkosten transparent  +7 %", pos: "tr" },
      { text: "Gutschein-Feld entschlacken  +3 %", pos: "bl" },
    ],
  },
  {
    type: "checkout",
    label: "Checkout",
    opt: [
      { text: "Gast-Checkout anbieten  +18 %", pos: "tl" },
      { text: "Weniger Formularfelder  +6 %", pos: "br" },
    ],
  },
];
const N = SHOWCASE.length;

const PROCESS = [
  {
    icon: Search,
    title: "Seiten prüfen",
    text: "Du prüfst kurz die automatisch erkannten URLs.",
  },
  {
    icon: SlidersHorizontal,
    title: "Kurz-Kontext",
    text: "Branche, Traffic & Kanäle schärfen die Empfehlungen.",
  },
  {
    icon: MousePointer2,
    title: "KI analysiert wie ein Mensch",
    text: "Klickt sich durch, legt in den Warenkorb, durchläuft den Checkout.",
  },
];

export function OverviewStep({ onNext }: { onNext: () => void }) {
  const [active, setActive] = useState(0);

  // Auto-Stack: alle ~3 s die nächste Seite nach vorne; bei Klick zurückgesetzt.
  useEffect(() => {
    const t = setTimeout(() => setActive((a) => (a + 1) % N), 3000);
    return () => clearTimeout(t);
  }, [active]);

  const cur = SHOWCASE[active];
  const next1 = SHOWCASE[(active + 1) % N];
  const next2 = SHOWCASE[(active + 2) % N];

  return (
    <div className="ovw">
      <div className="ovw-inner">
        <header className="ovw-intro">
          <span className="fstep-kicker">So läuft deine Analyse</span>
          <h2 className="fstep-title">Das findet die KI in deinem Shop</h2>
          <p className="ovw-lead">
            In Sekunden bekommst du 10+ priorisierte Optimierungen — hier ein
            Vorgeschmack, wie das je Seite aussieht.
          </p>
        </header>

        {/* Cinematic Auto-Stack der Wireframes mit Beispiel-Optimierungen */}
        <section className="ovw-showcase">
          <div className="ovw-stage">
            <div className="ovw-deck ovw-deck--2" aria-hidden="true">
              <Wireframe type={next2.type} />
            </div>
            <div className="ovw-deck ovw-deck--1" aria-hidden="true">
              <Wireframe type={next1.type} />
            </div>

            <div className="ovw-front" key={active}>
              <span className="ovw-front-tag">{cur.label}</span>
              <Wireframe type={cur.type} />
              {cur.opt.map((o, i) => (
                <span
                  key={o.pos}
                  className={`ovw-callout ovw-callout--${o.pos}`}
                  style={{ animationDelay: `${0.4 + i * 0.2}s` }}
                >
                  {o.text}
                </span>
              ))}
            </div>
          </div>

          <div className="ovw-dots" aria-label="Seitentypen">
            {SHOWCASE.map((s, i) => (
              <button
                key={s.type}
                type="button"
                className={i === active ? "on" : ""}
                onClick={() => setActive(i)}
                aria-label={s.label}
                aria-current={i === active}
              />
            ))}
          </div>
          <span className="ovw-showcase-note">
            Beispielhafte Optimierungen — deine echten Hebel ermittelt die Analyse
            individuell.
          </span>
        </section>

        {/* Uplift-Rechner */}
        <section className="ovw-calc">
          <h3 className="ovw-h3">
            Wie viel Conversion-Rate-Steigerung möchtest du erzielen?
          </h3>
          <Calculator />
        </section>

        {/* Ablauf in Kürze */}
        <section className="ovw-process">
          {PROCESS.map((p, i) => {
            const Icon = p.icon;
            return (
              <div className="ovw-proc" key={i}>
                <span className="ovw-proc-ico">
                  <Icon size={17} aria-hidden="true" />
                </span>
                <strong>{p.title}</strong>
                <p>{p.text}</p>
              </div>
            );
          })}
        </section>

        {/* Trust */}
        <section className="ovw-trust">
          <p>
            Das Wissen stammt aus{" "}
            <strong>10 Jahren Conversion-Optimierung</strong> mit etablierten
            E-Commerce-Shops.
          </p>
        </section>

        <div className="ovw-cta">
          <button className="cta" onClick={onNext}>
            Jetzt meinen Shop analysieren <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

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
import { Check, Search, SlidersHorizontal, MousePointer2 } from "lucide-react";
import { Wireframe } from "@/components/Wireframes";
import type { PageType } from "@/lib/types";

// Beispielhafter Hebel je Callout — gespiegelt an der echten Analyse
// (Schwachstelle · Empfehlung · Priorität + Uplift-Band). Rein illustrativ.
type Impact = "high" | "mid" | "low";
const IMPACT_LABEL: Record<Impact, string> = {
  high: "Hoch",
  mid: "Mittel",
  low: "Niedrig",
};
type Callout = {
  pos: "tl" | "tr" | "bl" | "br";
  impact: Impact;
  uplift: string;
  cat: string;
  problem: string;
  fix: string;
  why: string;
  source: string;
};
const SHOWCASE: { type: PageType; label: string; opt: Callout[] }[] = [
  {
    type: "home",
    label: "Startseite",
    opt: [
      {
        pos: "tl",
        impact: "high",
        uplift: "+9 %",
        cat: "Above the Fold",
        problem: "Wertversprechen erst nach dem Scrollen sichtbar.",
        fix: "Klare Value Proposition in den sichtbaren Bereich.",
        why: "Nutzer entscheiden in unter 5 Sek., ob sie bleiben.",
        source: "Nielsen Norman Group",
      },
      {
        pos: "br",
        impact: "mid",
        uplift: "+4 %",
        cat: "Vertrauen / Header",
        problem: "Keine Trust-Signale im sichtbaren Bereich.",
        fix: "Bewertungen, Siegel & USP in den Header holen.",
        why: "Frühe Vertrauenssignale senken die Absprungrate.",
        source: "Baymard Institute",
      },
    ],
  },
  {
    type: "plp",
    label: "Product Listing Page",
    opt: [
      {
        pos: "tl",
        impact: "mid",
        uplift: "+8 %",
        cat: "Filter & Navigation",
        problem: "Filter auf Mobile im Menü versteckt.",
        fix: "Filter-Leiste sichtbar und sticky machen.",
        why: "Sichtbare Filter führen schneller zum passenden Produkt.",
        source: "Baymard Institute",
      },
      {
        pos: "br",
        impact: "low",
        uplift: "+4 %",
        cat: "Produktkachel",
        problem: "Kacheln ohne Bewertungen oder Trust.",
        fix: "Sterne-Bewertungen pro Kachel einblenden.",
        why: "Social Proof erhöht die Klickrate auf Produkte.",
        source: "CXL Institute",
      },
    ],
  },
  {
    type: "pdp",
    label: "Produktdetailseite",
    opt: [
      {
        pos: "tr",
        impact: "high",
        uplift: "+12 %",
        cat: "Call-to-Action",
        problem: "Der „In den Warenkorb“-Button geht visuell unter.",
        fix: "Button absetzen, vergrößern und sticky fixieren.",
        why: "Ein dominanter CTA ist der stärkste Hebel der PDP.",
        source: "Nielsen Norman Group",
      },
      {
        pos: "bl",
        impact: "mid",
        uplift: "+5 %",
        cat: "Preis & Vertrauen",
        problem: "Keine Trust-Signale direkt am Preis.",
        fix: "Bewertungen, Garantie & Versand am Preis zeigen.",
        why: "Vertrauen am Preis reduziert das Kaufzögern.",
        source: "Baymard Institute",
      },
    ],
  },
  {
    type: "cart",
    label: "Warenkorb",
    opt: [
      {
        pos: "tr",
        impact: "high",
        uplift: "+7 %",
        cat: "Versand & Kosten",
        problem: "Versandkosten erst spät im Checkout sichtbar.",
        fix: "Kosten transparent direkt im Warenkorb zeigen.",
        why: "Versteckte Kosten sind der häufigste Abbruchgrund.",
        source: "Baymard Institute",
      },
      {
        pos: "bl",
        impact: "low",
        uplift: "+3 %",
        cat: "Ablenkung",
        problem: "Gutschein-Feld lenkt vom Kauf ab.",
        fix: "Gutschein-Feld dezent einklappen.",
        why: "Prominente Gutschein-Felder triggern Rabatt-Suche & Abbruch.",
        source: "GoodUI",
      },
    ],
  },
  {
    type: "checkout",
    label: "Checkout",
    opt: [
      {
        pos: "tl",
        impact: "high",
        uplift: "+18 %",
        cat: "Konto-Zwang",
        problem: "Konto-Erstellung vor dem Kauf erzwungen.",
        fix: "Gast-Checkout prominent anbieten.",
        why: "Zwangsregistrierung ist einer der Top-Abbruchgründe.",
        source: "Baymard Institute",
      },
      {
        pos: "br",
        impact: "mid",
        uplift: "+6 %",
        cat: "Formular",
        problem: "Zu viele Pflicht-Formularfelder.",
        fix: "Felder reduzieren & Autofill/Adress-Lookup.",
        why: "Jedes Feld weniger senkt die Abbruchrate messbar.",
        source: "Baymard Institute",
      },
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
                <div
                  key={o.pos}
                  className={`ovw-callout ovw-callout--${o.pos}`}
                  style={{ animationDelay: `${0.4 + i * 0.2}s` }}
                >
                  <div className="ovw-co-head">
                    <span className={`ovw-co-prio ovw-co-prio--${o.impact}`}>
                      Priorität {IMPACT_LABEL[o.impact]}
                    </span>
                    <span className="ovw-co-uplift">{o.uplift}</span>
                  </div>
                  <div className="ovw-co-cat">{o.cat}</div>
                  <p className="ovw-co-line">
                    <span>Schwachstelle</span>
                    {o.problem}
                  </p>
                  <p className="ovw-co-line">
                    <span>Empfehlung</span>
                    {o.fix}
                  </p>
                  <p className="ovw-co-line">
                    <span>Warum es wirkt</span>
                    {o.why}
                  </p>
                  <div className="ovw-co-src">Wissensbasis · {o.source}</div>
                </div>
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
            <Check size={18} /> Alles klar, verstanden
          </button>
        </div>
      </div>
    </div>
  );
}

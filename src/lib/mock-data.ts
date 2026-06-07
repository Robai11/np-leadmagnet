/*
 * Mock analysis data — ported verbatim from cro-analyzer-prototype.
 *
 * In M2 this is replaced by the real §4 analysis schema streamed from the
 * server. The shape here is intentionally close to that schema so the swap is
 * a data-source change, not a UI rewrite. Icons are NOT part of the data
 * contract — they are derived from `category` in the UI layer (see
 * taxonomy.ts), so this mock carries `category` keys, never components.
 */

import type { ImpactLevel } from "@/styles/tokens";
import type { LeverCategory } from "@/lib/taxonomy";

export type LeverType = "cr" | "aov";

export interface MockLever {
  id: string;
  n: number;
  pin: { x: number; y: number };
  impact: ImpactLevel;
  range: [number, number];
  type: LeverType;
  category: LeverCategory;
  /** Display label for the category (more specific than the taxonomy key). */
  categoryLabel: string;
  title: string;
  /** Beobachtung */
  observation: string;
  /** Mechanismus */
  mechanism: string;
  /** Test */
  test: string;
}

export interface MockPage {
  id: string;
  name: string;
  opportunity: ImpactLevel;
}

export const PAGES: MockPage[] = [
  { id: "home", name: "Startseite", opportunity: "mid" },
  { id: "plp", name: "Kategorie", opportunity: "low" },
  { id: "pdp", name: "Produktseite", opportunity: "high" },
  { id: "cart", name: "Warenkorb", opportunity: "high" },
  { id: "checkout", name: "Checkout", opportunity: "high" },
];

export const LEVERS: Record<string, MockLever[]> = {
  pdp: [
    {
      id: "pdp1",
      n: 1,
      pin: { x: 70, y: 73 },
      impact: "high",
      range: [0.8, 2.1],
      type: "cr",
      category: "cta",
      categoryLabel: "Primärer CTA",
      title: "„In den Warenkorb“ liegt auf Mobile unter dem Fold",
      observation:
        "Der Add-to-Cart-Button erscheint im 390px-Viewport erst nach ca. 1,4 Bildschirmhöhen.",
      mechanism:
        "Nutzer mit Kaufabsicht müssen die Hauptaktion erst suchen — bei überwiegend mobilem Traffic erzeugt das Drop-off, noch bevor die Absicht in einen Klick mündet.",
      test: "CTA above the fold ziehen + Sticky-Add-to-Cart-Leiste auf Mobile.",
    },
    {
      id: "pdp2",
      n: 2,
      pin: { x: 60, y: 42 },
      impact: "high",
      range: [1.2, 2.4],
      type: "cr",
      category: "price",
      categoryLabel: "Preis & Kosten",
      title: "Versandkosten erst im Checkout sichtbar",
      observation:
        "Auf der Produktseite kein Hinweis auf Versandkosten oder Free-Shipping-Schwelle — diese tauchen erst im Checkout auf.",
      mechanism:
        "Überraschende Zusatzkosten sind der meistgenannte Abbruchgrund. Früh kommunizierte Kosten setzen die Erwartung und verschieben den Schock weg vom kritischsten Funnel-Punkt.",
      test: "Versand-Badge + Free-Shipping-Fortschrittsanzeige direkt am Preis.",
    },
    {
      id: "pdp3",
      n: 3,
      pin: { x: 60, y: 31 },
      impact: "mid",
      range: [0.6, 1.5],
      type: "cr",
      category: "trust",
      categoryLabel: "Trust",
      title: "Keine Bewertungen oberhalb des Folds",
      observation: "Kein Sterne-/Review-Element nahe am Produkttitel.",
      mechanism:
        "Soziale Bewährtheit senkt das wahrgenommene Kaufrisiko genau dort, wo die Kaufentscheidung fällt.",
      test: "Sterne-Rating + Bewertungsanzahl direkt unter den Produkttitel.",
    },
    {
      id: "pdp4",
      n: 4,
      pin: { x: 58, y: 53 },
      impact: "mid",
      range: [0.4, 1.1],
      type: "cr",
      category: "price",
      categoryLabel: "Preis-Psychologie",
      title: "Schwacher Preis-Anker",
      observation: "Preis ohne Referenz-/Streichpreis, Ersparnis nicht beziffert.",
      mechanism:
        "Ohne Ankerpreis fehlt der Vergleichsmaßstab — der Preis wirkt absolut statt als Vorteil.",
      test: "UVP als Streichpreis + bezifferte Ersparnis („−18 €“) ergänzen.",
    },
  ],
  cart: [
    {
      id: "cart1",
      n: 1,
      pin: { x: 38, y: 64 },
      impact: "mid",
      range: [0.5, 1.3],
      type: "cr",
      category: "friction",
      categoryLabel: "Friction",
      title: "Gutscheinfeld zu prominent platziert",
      observation: "Großes, offenes Gutscheincode-Feld zentral im Warenkorb.",
      mechanism:
        "Ein auffälliges Code-Feld triggert „zahle ich zu viel?“ — Nutzer verlassen den Warenkorb zur Gutscheinsuche und kehren oft nicht zurück.",
      test: "Code-Eingabe als dezenten, einklappbaren Link gestalten.",
    },
    {
      id: "cart2",
      n: 2,
      pin: { x: 78, y: 38 },
      impact: "mid",
      range: [0.4, 1.0],
      type: "cr",
      category: "price",
      categoryLabel: "Preis & Kosten",
      title: "Kein Free-Shipping-Fortschritt",
      observation: "Keine Anzeige, wie viel bis zum kostenlosen Versand fehlt.",
      mechanism:
        "Ein sichtbarer Schwellenwert ist ein starker Anreiz, den Warenkorbwert zu erhöhen statt abzubrechen.",
      test: "Fortschrittsbalken „Noch 12 € bis Gratisversand“.",
    },
    {
      id: "cart3",
      n: 3,
      pin: { x: 38, y: 80 },
      impact: "low",
      range: [0.0, 0.0],
      type: "aov",
      category: "crosssell",
      categoryLabel: "Cross-Sell · AOV",
      title: "Kein Zubehör-/Bundle-Modul im Warenkorb",
      observation: "Keine ergänzenden Produktvorschläge auf der Warenkorbseite.",
      mechanism:
        "Der Warenkorb ist der natürlichste Cross-Sell-Punkt. Hinweis: wirkt auf den Bestellwert (AOV), nicht auf die Conversion-Rate — separat zu bewerten.",
      test: "„Passt dazu“-Modul mit 2–3 passenden Artikeln.",
    },
  ],
  checkout: [
    {
      id: "ck1",
      n: 1,
      pin: { x: 35, y: 30 },
      impact: "high",
      range: [1.5, 3.0],
      type: "cr",
      category: "friction",
      categoryLabel: "Friction",
      title: "Registrierung erzwungen — kein Gast-Checkout",
      observation:
        "Der erste Checkout-Schritt verlangt Kontoerstellung, eine Gast-Option ist nicht sichtbar.",
      mechanism:
        "Zwangsregistrierung zählt zu den größten Einzel-Abbruchgründen im Checkout — die Hürde steht zwischen Kaufabsicht und Abschluss.",
      test: "Gast-Checkout prominent als Standardoption anbieten.",
    },
    {
      id: "ck2",
      n: 2,
      pin: { x: 35, y: 58 },
      impact: "mid",
      range: [0.6, 1.6],
      type: "cr",
      category: "friction",
      categoryLabel: "Formular",
      title: "Zu viele Formularfelder",
      observation:
        "14 Felder im Lieferschritt, mehrere optionale Felder ohne Kennzeichnung.",
      mechanism:
        "Jedes zusätzliche Feld erhöht die kognitive Last und die Abbruchwahrscheinlichkeit.",
      test: "Felder zusammenfassen, optionale entfernen, Adress-Autofill aktivieren.",
    },
    {
      id: "ck3",
      n: 3,
      pin: { x: 78, y: 28 },
      impact: "mid",
      range: [0.5, 1.4],
      type: "cr",
      category: "friction",
      categoryLabel: "Zahlung",
      title: "Keine Express-Zahlungsoptionen",
      observation: "Kein PayPal / Apple Pay oben im Checkout sichtbar.",
      mechanism:
        "Express-Buttons überspringen die Formularstrecke komplett — besonders wirksam auf Mobile.",
      test: "Express-Checkout-Buttons über das Formular setzen.",
    },
  ],
  home: [
    {
      id: "hm1",
      n: 1,
      pin: { x: 33, y: 45 },
      impact: "mid",
      range: [0.5, 1.2],
      type: "cr",
      category: "atf",
      categoryLabel: "Value Proposition",
      title: "Unklares Nutzenversprechen above the fold",
      observation:
        "Der Hero zeigt ein Produktbild ohne formuliertes Nutzen-/Alleinstellungsversprechen.",
      mechanism:
        "Kalter Traffic entscheidet in Sekunden, ob er bleibt. Ohne klare Antwort auf „warum hier?“ steigt die Absprungrate.",
      test: "Prägnante Value Proposition + USP-Leiste (Versand, Rückgabe, Support) im Hero.",
    },
    {
      id: "hm2",
      n: 2,
      pin: { x: 80, y: 16 },
      impact: "low",
      range: [0.2, 0.6],
      type: "cr",
      category: "friction",
      categoryLabel: "Navigation",
      title: "Suche wenig prominent",
      observation: "Suchfeld klein und visuell zurückhaltend in der Kopfzeile.",
      mechanism:
        "Suchende Nutzer haben hohe Intention; eine versteckte Suche bremst genau die wertvollsten Besucher.",
      test: "Suchfeld vergrößern und mittig in der Kopfzeile platzieren.",
    },
  ],
  plp: [
    {
      id: "pl1",
      n: 1,
      pin: { x: 20, y: 34 },
      impact: "low",
      range: [0.3, 0.8],
      type: "cr",
      category: "friction",
      categoryLabel: "Navigation",
      title: "Filter auf Mobile versteckt",
      observation:
        "Filteroptionen sind hinter einem unscheinbaren Element verborgen und im mobilen Viewport nicht sichtbar.",
      mechanism:
        "Ohne sichtbare Filter scrollen Nutzer endlos oder springen ab, statt das passende Produkt einzugrenzen.",
      test: "Sichtbaren Filter-Button + meistgenutzte Filter als Chips.",
    },
    {
      id: "pl2",
      n: 2,
      pin: { x: 72, y: 52 },
      impact: "low",
      range: [0.2, 0.7],
      type: "cr",
      category: "trust",
      categoryLabel: "Trust",
      title: "Produktkarten ohne Bewertungen",
      observation: "Die Karten in der Liste zeigen keine Sterne oder Bewertungszahlen.",
      mechanism:
        "Schon in der Liste hilft soziale Bewährtheit, die Auswahl auf vertrauenswürdige Produkte zu lenken.",
      test: "Kompaktes Sterne-Rating auf jeder Produktkarte.",
    },
  ],
};

export const TOTAL_LEVERS = Object.values(LEVERS).reduce(
  (a, l) => a + l.length,
  0,
);

export const OVERALL = { low: 11, high: 24 };

// Die zehn wichtigsten E-Commerce-Branchen (+ Auffangoption für Nischen).
export const INDUSTRIES = [
  "Mode & Bekleidung",
  "Elektronik & Technik",
  "Haushalt & Haushaltsgeräte",
  "Beauty & Kosmetik",
  "Drogerie & Gesundheit",
  "Möbel & Wohnen",
  "Sport & Outdoor",
  "Lebensmittel & Getränke",
  "Spielzeug, Baby & Kind",
  "Heimwerken, Garten & Baumarkt",
  "Sonstiges",
];

export const CHANNELS = [
  "Paid Social",
  "Google Ads",
  "SEO / organisch",
  "E-Mail",
  "Direkt",
  "Affiliate",
];

/*
 * Fachliche Wissensbasis für die CRO-Analyse.
 *
 * Anerkannte E-Commerce-CRO/UX/Psychologie/Copy-Prinzipien — in EIGENEN Worten
 * destilliert (keine Übernahme geschützter Texte) und mit Quelle attribuiert.
 * Strukturiert nach den 8 Hebel-Kategorien der Taxonomie, damit das Vision-
 * Modell jede Seite gegen ein belegtes Prüfraster bewertet statt nur aus dem
 * Modellwissen heraus. Quellenliste siehe SOURCES.
 *
 * Erweiterbar: neue Prinzipien einfach in der jeweiligen Kategorie ergänzen.
 */

import type { LeverCategory } from "@/lib/taxonomy";

export interface Principle {
  /** Prüfbares Prinzip, eigene Formulierung. */
  text: string;
  /** Quelle/Autorität (Kurz-Tag). */
  source: string;
}

interface CategoryKnowledge {
  /** Kurzer Titel der Kategorie. */
  title: string;
  principles: Principle[];
}

/** Die maßgeblichen Quellen hinter der Wissensbasis (für Attribution/Transparenz). */
export const SOURCES =
  "Baymard Institute, Nielsen Norman Group (NN/g), CXL, GoodUI, Laws of UX, " +
  "The Decision Lab, Robert Cialdini, Dan Ariely, Copyhackers, Google Core Web Vitals";

export const KNOWLEDGE: Record<LeverCategory, CategoryKnowledge> = {
  cta: {
    title: "Primärer CTA",
    principles: [
      { text: "Genau EIN dominanter primärer CTA pro Viewport; gleichwertige konkurrierende Buttons erhöhen die Entscheidungslast und senken die Klickrate.", source: "Hick's Law / Laws of UX" },
      { text: "Primärer CTA im ersten Viewport sichtbar; auf langen (v.a. mobilen) Seiten sticky/wiederkehrend, damit er nie aus dem Blick gerät.", source: "Baymard" },
      { text: "Aktionsorientiertes, spezifisches Label ('In den Warenkorb' statt 'Weiter'); Wert-/Ich-Formulierungen testen.", source: "Copyhackers" },
      { text: "Hoher Farb-/Kontrast, klar als klickbar erkennbar (Affordance), ausreichend groß.", source: "NN/g" },
    ],
  },
  price: {
    title: "Preis & Preis-Psychologie",
    principles: [
      { text: "Preis prominent und nah am CTA platzieren; der Nutzer soll Preis und Aktion gemeinsam sehen.", source: "Baymard" },
      { text: "Ankerpreis/UVP zeigen und Ersparnis beziffern ('−30 %, du sparst 45 €') — der Anker rahmt die Wahrnehmung des Preises.", source: "Ariely (Anchoring) / Cialdini" },
      { text: "Versandkosten und Lieferzeit FRÜH ausweisen; unerwartete Zusatzkosten sind der häufigste Checkout-Abbruchgrund.", source: "Baymard" },
      { text: "Preis-Framing bewusst wählen (z.B. Charm-Pricing 9,99); je nach Marke testen.", source: "Konsumpsychologie / CXL" },
    ],
  },
  trust: {
    title: "Trust & Risikoreduktion",
    principles: [
      { text: "Bewertungen/Sterne inkl. Anzahl nah am CTA zeigen — Social Proof reduziert wahrgenommenes Risiko genau im Entscheidungsmoment.", source: "Cialdini (Social Proof) / Baymard" },
      { text: "Rückgaberecht, Garantie und Lieferzeit sichtbar machen; Risikoumkehr senkt die Kaufhürde.", source: "Cialdini / CXL" },
      { text: "Zahlungsarten und vertrauensbildende Signale am Checkout-Einstieg zeigen.", source: "Baymard" },
      { text: "Konkrete, glaubwürdige Signale statt generischer Siegel — Echtheit schlägt Dekoration.", source: "NN/g" },
    ],
  },
  product: {
    title: "Entscheidungssicherheit / Produktinfo",
    principles: [
      { text: "Mehrere echte Produktbilder + Galerie/Zoom; Bildqualität und -menge sind stark kaufentscheidend.", source: "Baymard" },
      { text: "Vollständige Spezifikationen/Maße/Material; jede offene Frage erhöht die Abbruchwahrscheinlichkeit.", source: "Baymard" },
      { text: "Scanbare Beschreibung (Bullets, klare Hierarchie) statt Textwand — Nutzer lesen nicht, sie scannen.", source: "NN/g" },
      { text: "Varianten (Größe/Farbe) klar wählbar, Verfügbarkeit/Lieferbarkeit sichtbar.", source: "Baymard" },
    ],
  },
  atf: {
    title: "Above-the-Fold-Komposition",
    principles: [
      { text: "Bild + Preis + primärer CTA gemeinsam im ersten Viewport — die Kern-Kaufelemente ohne Scrollen erreichbar.", source: "Baymard / NN/g" },
      { text: "Klares Wertversprechen / aussagekräftige H1 weit oben: was wird angeboten und warum hier kaufen.", source: "Copyhackers" },
      { text: "Keine großen Ablenker (Pop-ups, Mega-Banner, Slider) über dem Fold, die die Kaufelemente verdrängen.", source: "Friction / NN/g" },
    ],
  },
  crosssell: {
    title: "Cross-/Up-Sell (wirkt auf AOV, NICHT auf CR)",
    principles: [
      { text: "Passende Ergänzungen/Bundles NACH der Hauptentscheidung anbieten, nicht davor — sonst lenkt es vom Kauf ab.", source: "CXL / Baymard" },
      { text: "'Häufig zusammen gekauft' / relevantes Zubehör hebt den Warenkorbwert (AOV), darf aber nie in CR-Schätzungen einfließen.", source: "Konsumpsychologie" },
    ],
  },
  friction: {
    title: "Friction & Usability",
    principles: [
      { text: "Gast-Checkout anbieten; erzwungene Registrierung ist einer der größten Checkout-Abbruchgründe.", source: "Baymard" },
      { text: "Formularfelder auf das Nötigste reduzieren; jedes zusätzliche Feld kostet Abschlüsse.", source: "Baymard" },
      { text: "Aufdringliche Pop-ups/Cookie-Layer, die Inhalt verdecken, vermeiden oder entschärfen.", source: "NN/g" },
      { text: "Mobile: Tap-Targets groß genug (~44px), kein Zoom-Zwang, Daumen-erreichbare primäre Aktionen.", source: "NN/g / Apple HIG / Google" },
      { text: "Inline-, verständliche Fehlermeldungen; Nutzer nie raten lassen, was falsch ist.", source: "NN/g" },
    ],
  },
  tech: {
    title: "Technische Performance (nur wenn klar erkennbar)",
    principles: [
      { text: "Schnelles Laden des sichtbaren Bereichs (LCP); langsame Seiten erhöhen die Absprungrate deutlich.", source: "Google Core Web Vitals" },
      { text: "Layout-Stabilität (CLS) — springende Elemente verursachen Fehlklicks und Frust.", source: "Google Core Web Vitals" },
      { text: "Überschwere/unkomprimierte Bilder vermeiden (sichtbar an Ladeplatzhaltern/Unschärfe).", source: "Google" },
    ],
  },
};

/**
 * Render die Wissensbasis als Prompt-Block (für den gecachten System-Prompt).
 * Enthält die Kategorie-Keys (für das `category`-Feld) + das fachliche Prüfraster.
 */
export function knowledgePromptBlock(): string {
  const cats = (Object.keys(KNOWLEDGE) as LeverCategory[])
    .map((key) => {
      const k = KNOWLEDGE[key];
      const lines = k.principles
        .map((p) => `   • ${p.text} [${p.source}]`)
        .join("\n");
      return `- ${key} — ${k.title}:\n${lines}`;
    })
    .join("\n");

  return (
    `Hebel-Taxonomie & fachliches Prüfraster (gegründet auf anerkannten Quellen: ${SOURCES}).\n` +
    `Prüfe die Seite gegen diese Prinzipien — aber melde NUR, was im Screenshot/den Elementen tatsächlich belegt ist; die Prinzipien rahmen das Urteil, ersetzen aber nie die Beobachtung:\n\n` +
    cats
  );
}

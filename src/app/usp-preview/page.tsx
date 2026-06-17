"use client";

/*
 * /usp-preview — dev-only Auswahlseite: drei Varianten, wie "Die Knowledge
 * Engine dahinter" (4 Wissensquellen) DIREKT in die URL-Eingabe-Karte des Hero
 * eingewoben wird — jeweils ÜBER dem Eingabefeld. Nach der Entscheidung wandert
 * die gewählte Variante in den Hero. Dev-only (404 in Produktion).
 */

import { Briefcase, Trophy, Users, Brain, Cpu, Check } from "lucide-react";
import { notFound } from "next/navigation";

const USPS = [
  {
    icon: Briefcase,
    title: "10 Jahre Agenturkundenprojekte",
    sub: "in diversen Branchen",
  },
  {
    icon: Trophy,
    title: "Tricks & Kniffe der Top-500-Shops",
    sub: "aus echter Praxis",
  },
  {
    icon: Users,
    title: "Kuratierte Insights",
    sub: "von Senior-Conversion-Experten",
  },
  {
    icon: Brain,
    title: "Konsumpsychologie",
    sub: "von Nobelpreisträgern",
  },
];

const ENGINE_LABEL = "Die Knowledge Engine dahinter";

/* Die Eingabezeile (rein visuell, nicht funktional in der Vorschau). */
function EntryForm() {
  return (
    <form className="hero-form" onSubmit={(e) => e.preventDefault()}>
      <span className="hero-form-label">KI-Analyse</span>
      <input
        className="hero-input"
        type="url"
        placeholder="https://dein-shop.de"
        aria-label="Shop-URL"
      />
      <button className="hero-submit" type="button">
        Analysieren
      </button>
    </form>
  );
}

/* Variante 1 — genestetes Engine-Panel mit 2×2-Grid über dem Feld. */
function Variant1() {
  return (
    <div className="hero-entry">
      <div className="kev1-head">
        <span className="kev-kicker">
          <Cpu size={14} aria-hidden="true" /> {ENGINE_LABEL}
        </span>
        <div className="kev1-grid">
          {USPS.map((u) => (
            <div className="kev1-item" key={u.title}>
              <u.icon size={18} aria-hidden="true" />
              <div>
                <b>{u.title}</b>
                <span>{u.sub}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <EntryForm />
    </div>
  );
}

/* Variante 2 — Checkliste über dem Feld. */
function Variant2() {
  return (
    <div className="hero-entry">
      <div className="kev2-head">
        <span className="kev-kicker">
          <Cpu size={14} aria-hidden="true" /> {ENGINE_LABEL}
        </span>
        <ul className="kev2-list">
          {USPS.map((u) => (
            <li key={u.title}>
              <Check size={15} aria-hidden="true" />
              <b>{u.title}</b> <span>{u.sub}</span>
            </li>
          ))}
        </ul>
      </div>
      <EntryForm />
    </div>
  );
}

/* Variante 3 — Icon-Strip (4 Kacheln) über dem Feld. */
function Variant3() {
  return (
    <div className="hero-entry">
      <div className="kev3-head">
        <span className="kev-kicker">
          <Cpu size={14} aria-hidden="true" /> {ENGINE_LABEL}
        </span>
        <div className="kev3-strip">
          {USPS.map((u) => (
            <div className="kev3-tile" key={u.title}>
              <span className="kev3-ico">
                <u.icon size={18} aria-hidden="true" />
              </span>
              <b>{u.title}</b>
              <span>{u.sub}</span>
            </div>
          ))}
        </div>
      </div>
      <EntryForm />
    </div>
  );
}

export default function UspPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const variants = [
    {
      n: 1,
      name: "Engine-Panel — 2×2-Grid in einem genesteten Feld",
      el: <Variant1 />,
    },
    { n: 2, name: "Checkliste — vier Zeilen mit Haken", el: <Variant2 /> },
    { n: 3, name: "Icon-Strip — vier Kacheln nebeneinander", el: <Variant3 /> },
  ];

  return (
    <div className="usp-preview">
      <header className="usp-preview-head">
        <h1>„Die Knowledge Engine dahinter“ — 3 Varianten in der URL-Box</h1>
        <p>
          Die vier Wissensquellen sind jeweils ÜBER dem Eingabefeld in die Karte
          eingewoben. Sag mir, welche dir gefällt — dann baue ich sie in den Hero
          ein.
        </p>
      </header>

      {variants.map((v) => (
        <section className="usp-variant" key={v.n}>
          <div className="usp-variant-label">
            <span className="usp-variant-num">Variante {v.n}</span>
            {v.name}
          </div>
          <div className="usp-stage">{v.el}</div>
        </section>
      ))}
    </div>
  );
}

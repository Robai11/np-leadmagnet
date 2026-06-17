"use client";

/*
 * /usp-preview — dev-only Auswahlseite: drei Varianten, wie die USP-/Wissens-
 * quellen als "Backend" der Analyse auf der Landingpage dargestellt werden
 * können (Bereich unter dem Analyse-Feld). Nach der Entscheidung wandert die
 * gewählte Variante in den Hero. Dev-only (404 in Produktion).
 */

import {
  Briefcase,
  Trophy,
  Users,
  Brain,
  Sparkles,
  Cpu,
  Check,
  Layers,
} from "lucide-react";
import { notFound } from "next/navigation";

const USPS = [
  {
    icon: Briefcase,
    title: "10 Jahre Agenturkundenprojekte",
    sub: "in diversen Branchen",
  },
  {
    icon: Trophy,
    title: "Tricks & Kniffe der Top-500-Online-Shops",
    sub: "aus echter Praxis",
  },
  {
    icon: Users,
    title: "Kuratierte Insights",
    sub: "von Senior Conversion-Experten",
  },
  {
    icon: Brain,
    title: "Konsumpsychologie",
    sub: "von Nobelpreisträgern",
  },
];

/* Variante 1 — Module fließen in die KI-Engine. */
function Variant1() {
  return (
    <div className="uspv uspv1">
      <span className="uspv-kicker">
        <Cpu size={15} aria-hidden="true" /> Das steckt im Backend deiner Analyse
      </span>
      <div className="uspv1-flow">
        <div className="uspv1-mods">
          {USPS.map((u) => (
            <div className="uspv1-mod" key={u.title}>
              <span className="uspv1-ico">
                <u.icon size={18} aria-hidden="true" />
              </span>
              <div className="uspv1-txt">
                <b>{u.title}</b>
                <span>{u.sub}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="uspv1-feed" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <div className="uspv1-engine">
          <Sparkles size={22} aria-hidden="true" />
          <b>KI-Analyse</b>
          <span>destilliert daraus deine Hebel</span>
        </div>
      </div>
    </div>
  );
}

/* Variante 2 — Wissens-Schichten als Fundament der Empfehlungen. */
function Variant2() {
  return (
    <div className="uspv uspv2">
      <div className="uspv2-cap">
        <Sparkles size={16} aria-hidden="true" /> Deine personalisierten
        Optimierungen
      </div>
      <span className="uspv2-on">basieren auf vier Wissens-Schichten</span>
      <div className="uspv2-stack">
        {USPS.map((u, i) => (
          <div
            className="uspv2-layer"
            key={u.title}
            style={{ "--i": i } as React.CSSProperties}
          >
            <span className="uspv2-ico">
              <u.icon size={17} aria-hidden="true" />
            </span>
            <b>{u.title}</b>
            <span className="uspv2-sub">{u.sub}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* Variante 3 — Engine-Terminal lädt die Wissensbasis. */
function Variant3() {
  return (
    <div className="uspv uspv3">
      <div className="uspv3-term">
        <div className="uspv3-bar">
          <span className="uspv3-dot" />
          <span className="uspv3-dot" />
          <span className="uspv3-dot" />
          <em>
            <Layers size={12} aria-hidden="true" /> wissensbasis.engine
          </em>
        </div>
        <div className="uspv3-body">
          {USPS.map((u) => (
            <div className="uspv3-line" key={u.title}>
              <Check size={14} aria-hidden="true" className="uspv3-check" />
              <span className="uspv3-tag">geladen</span>
              <b>{u.title}</b>
              <span className="uspv3-sub">· {u.sub}</span>
            </div>
          ))}
          <div className="uspv3-ready">
            <Sparkles size={14} aria-hidden="true" /> Analyse-Engine bereit
            <span className="uspv3-caret" aria-hidden="true" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function UspPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const variants = [
    { n: 1, name: "Engine-Reihe — Module fließen in die KI", el: <Variant1 /> },
    {
      n: 2,
      name: "Fundament — Wissens-Schichten tragen die Empfehlungen",
      el: <Variant2 />,
    },
    { n: 3, name: "Terminal — Engine lädt die Wissensbasis", el: <Variant3 /> },
  ];

  return (
    <div className="usp-preview">
      <header className="usp-preview-head">
        <h1>USP-„Backend“ — 3 Varianten</h1>
        <p>
          Für den Bereich unter dem Analyse-Feld auf der Landingpage. Sag mir,
          welche dir gefällt — dann baue ich sie in den Hero ein.
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

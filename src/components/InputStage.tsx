"use client";

import { useState } from "react";
import { ArrowRight, Smartphone, Monitor, Eye, Lock } from "lucide-react";
import { impactVar } from "@/styles/tokens";
import { INDUSTRIES, CHANNELS } from "@/lib/mock-data";
import type { AnalysisContext, PageType } from "@/lib/types";

const PAGE_ORDER: PageType[] = ["home", "plp", "pdp", "cart", "checkout"];
const PAGE_DEFS: Record<
  PageType,
  { label: string; placeholder: string }
> = {
  home: { label: "Startseite", placeholder: "https://dein-shop.de" },
  plp: { label: "Kategorie-Seite", placeholder: "https://dein-shop.de/kategorie" },
  pdp: { label: "Produktseite", placeholder: "https://dein-shop.de/produkt/…" },
  cart: { label: "Warenkorb", placeholder: "optional · sonst über Produkt" },
  checkout: { label: "Checkout", placeholder: "optional · sonst über Produkt" },
};

interface TargetState {
  url: string;
  selected: boolean;
}

export function InputStage({
  onStart,
}: {
  onStart: (ctx: AnalysisContext) => void;
}) {
  const [industry, setIndustry] = useState("");
  const [device, setDevice] = useState(60);
  const [channels, setChannels] = useState<string[]>([]);
  const [targets, setTargets] = useState<Record<PageType, TargetState>>({
    home: { url: "", selected: true },
    plp: { url: "", selected: false },
    pdp: { url: "", selected: true },
    cart: { url: "", selected: true },
    checkout: { url: "", selected: true },
  });

  const setTargetUrl = (t: PageType, url: string) =>
    setTargets((p) => ({ ...p, [t]: { ...p[t], url } }));
  const toggleTarget = (t: PageType) =>
    setTargets((p) => ({ ...p, [t]: { ...p[t], selected: !p[t].selected } }));

  const hasUrl = (t: PageType) => targets[t].url.trim().length > 3;
  const pdpReady = targets.pdp.selected && hasUrl("pdp");
  // A selected row is valid if it has a URL — except cart/checkout, which may
  // instead be reached via a selected product page.
  const rowValid = (t: PageType) => {
    if (!targets[t].selected) return true;
    if (t === "cart" || t === "checkout") return pdpReady || hasUrl(t);
    return hasUrl(t);
  };
  const anySelected = PAGE_ORDER.some((t) => targets[t].selected);
  const allRowsValid = PAGE_ORDER.every(rowValid);
  const valid =
    !!industry && channels.length > 0 && anySelected && allRowsValid;

  const primaryUrl =
    (targets.home.selected && targets.home.url.trim()) ||
    PAGE_ORDER.map((t) => targets[t])
      .find((x) => x.selected && x.url.trim())
      ?.url.trim() ||
    "";

  const submit = () =>
    onStart({
      url: primaryUrl,
      industry,
      device,
      channels,
      targets: PAGE_ORDER.map((t) => ({
        type: t,
        url: targets[t].url.trim(),
        selected: targets[t].selected,
      })),
    });

  const toggle = (c: string) =>
    setChannels((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]));

  return (
    <div className="stage input-stage">
      <div className="input-left">
        <span className="kicker">CRO-Analyse · kostenlos</span>
        <h1>
          Wo dein Shop <span className="hl">Conversion verliert</span> — in 60
          Sekunden sichtbar.
        </h1>
        <p className="lede">
          Wir scannen deinen kompletten Funnel — Startseite, Kategorie,
          Produktseite, Warenkorb und Checkout — und markieren die größten
          Conversion-Hebel direkt auf deinen Seiten.
        </p>

        <div className="field">
          <label>
            Welche Seiten sollen analysiert werden?{" "}
            <em>· Häkchen setzen und URL eintragen</em>
          </label>
          <div className="targets">
            {PAGE_ORDER.map((t) => (
              <div
                key={t}
                className={`target-row ${targets[t].selected ? "on" : ""}`}
              >
                <label className="target-check">
                  <input
                    type="checkbox"
                    checked={targets[t].selected}
                    onChange={() => toggleTarget(t)}
                  />
                  <span>{PAGE_DEFS[t].label}</span>
                </label>
                <input
                  className="target-url"
                  placeholder={PAGE_DEFS[t].placeholder}
                  value={targets[t].url}
                  disabled={!targets[t].selected}
                  onChange={(e) => setTargetUrl(t, e.target.value)}
                />
              </div>
            ))}
          </div>
          <span className="target-note">
            Warenkorb &amp; Checkout werden automatisch über die Produktseite
            erreicht — eine eigene URL ist optional.
          </span>
        </div>

        <div className="field">
          <label>
            Branche <em>· präzisiert die Analyse</em>
          </label>
          <div className="chips">
            {INDUSTRIES.map((i) => (
              <button
                key={i}
                className={`chip ${industry === i ? "on" : ""}`}
                onClick={() => setIndustry(i)}
              >
                {i}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label>Traffic-Verteilung</label>
          <div className="device">
            <Smartphone size={16} />
            {/* Thumb position = Desktop share (Monitor is on the right), so
                dragging toward the monitor increases Desktop. `device` stays
                the Mobile %, which the rest of the app expects. */}
            <input
              type="range"
              min={0}
              max={100}
              value={100 - device}
              onChange={(e) => setDevice(100 - Number(e.target.value))}
            />
            <Monitor size={16} />
          </div>
          <div className="device-lbl">
            <span>{device}% Mobile</span>
            <span>{100 - device}% Desktop</span>
          </div>
        </div>

        <div className="field">
          <label>
            Wichtigste Traffic-Kanäle <em>· Mehrfachauswahl</em>
          </label>
          <div className="chips">
            {CHANNELS.map((c) => (
              <button
                key={c}
                className={`chip ${channels.includes(c) ? "on" : ""}`}
                onClick={() => toggle(c)}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <button className="cta" disabled={!valid} onClick={submit}>
          Funnel-Analyse starten <ArrowRight size={18} />
        </button>
        {!valid && (
          <span className="hint">
            Branche, mindestens ein Kanal und mindestens eine angehakte Seite mit
            URL werden benötigt.
          </span>
        )}
      </div>

      <div className="input-right">
        <div className="preview-label">
          <Eye size={14} /> So sieht deine Analyse aus
        </div>
        <div className="preview">
          <div className="prev-shot">
            <div
              className="prev-pin"
              style={{ left: "62%", top: "30%", background: impactVar("high") }}
            >
              1
            </div>
            <div
              className="prev-pin"
              style={{ left: "70%", top: "66%", background: impactVar("mid") }}
            >
              2
            </div>
            <div className="prev-bars">
              <span />
              <span />
              <span />
            </div>
          </div>
          <div className="prev-cards">
            <div />
            <div />
            <div className="prev-lock">
              <Lock size={12} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

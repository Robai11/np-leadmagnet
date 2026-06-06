"use client";

import { useState } from "react";
import { ArrowRight, Smartphone, Monitor, Eye, Lock } from "lucide-react";
import { impactVar } from "@/styles/tokens";
import { INDUSTRIES, CHANNELS } from "@/lib/mock-data";
import type { AnalysisContext } from "@/lib/types";

export function InputStage({
  onStart,
}: {
  onStart: (ctx: AnalysisContext) => void;
}) {
  const [url, setUrl] = useState("");
  const [industry, setIndustry] = useState("");
  const [device, setDevice] = useState(60);
  const [channels, setChannels] = useState<string[]>([]);

  const valid = url.trim().length > 3 && !!industry && channels.length > 0;
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
          <label>Shop-URL</label>
          <input
            className="url-input"
            placeholder="https://dein-shop.de"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
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
            <input
              type="range"
              min={0}
              max={100}
              value={device}
              onChange={(e) => setDevice(Number(e.target.value))}
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

        <button
          className="cta"
          disabled={!valid}
          onClick={() =>
            onStart({ url: url.trim(), industry, device, channels })
          }
        >
          Funnel-Analyse starten <ArrowRight size={18} />
        </button>
        {!valid && (
          <span className="hint">
            URL, Branche und mindestens ein Kanal werden benötigt.
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

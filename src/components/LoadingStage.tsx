"use client";

import { useEffect, useState } from "react";
import { Check, Volume2, VolumeX, Loader2 } from "lucide-react";
import type { AnalysisContext, PageType } from "@/lib/types";
import { HeroWall } from "@/components/HeroWall";
import { Wireframe } from "@/components/Wireframes";
import { Calculator } from "@/components/Calculator";

// Funnel order; only the steps the user actually selected are shown. `done` is
// driven by the real stream (which pages have arrived), not a fixed timer.
const PAGE_STEPS: { id: string; label: string }[] = [
  { id: "home", label: "Startseite gerendert · Elemente erkannt" },
  { id: "plp", label: "Produktlisting-Page analysiert" },
  { id: "pdp", label: "Produktseite · Mobile + Desktop gerendert" },
  { id: "cart", label: "Warenkorb · Artikel hinzugefügt" },
  { id: "checkout", label: "Checkout bis zur Zahlungswand gelesen" },
];

// Kurzlabel + passendes Wireframe je aktivem Schritt (für die Scan-Spalte).
const SHORT_LABEL: Record<string, string> = {
  shop: "Shop wird geladen",
  home: "Startseite",
  plp: "Product Listing Page",
  pdp: "Produktdetailseite",
  cart: "Warenkorb",
  checkout: "Checkout",
  score: "Hebel-Bewertung",
};
const WF_FOR: Record<string, PageType> = {
  shop: "home",
  home: "home",
  plp: "plp",
  pdp: "pdp",
  cart: "cart",
  checkout: "checkout",
  score: "checkout",
};

export function LoadingStage({
  ctx,
  analyzedIds,
  selectedIds,
  progressPct,
  done,
  muted,
  onToggleMuted,
}: {
  ctx: AnalysisContext;
  selectedIds: string[] | null;
  analyzedIds: string[];
  progressPct: number;
  done: boolean;
  muted?: boolean;
  onToggleMuted?: () => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const pageSteps = selectedIds
    ? PAGE_STEPS.filter((s) => selectedIds.includes(s.id))
    : PAGE_STEPS;

  const steps = [
    { key: "shop", label: "Shop wird aufgerufen …", done: progressPct >= 5 },
    ...pageSteps.map((s) => ({
      key: s.id,
      label: s.label,
      done: analyzedIds.includes(s.id),
    })),
    { key: "score", label: "Hebel werden bewertet und priorisiert …", done },
  ];
  const activeIndex = steps.findIndex((s) => !s.done);
  const active = steps[activeIndex] ?? steps[steps.length - 1];
  const pct = Math.min(100, progressPct);
  const wfType = WF_FOR[active.key] ?? "home";
  const activeLabel = SHORT_LABEL[active.key] ?? "Analyse";

  return (
    <div className="hero hero--deep">
      <HeroWall />
      <div className="hero-scrim hero-scrim--radial" aria-hidden="true" />
      <div className="hero-scrim hero-scrim--vert" aria-hidden="true" />
      <div className="hero-deep-veil" aria-hidden="true" />

      <div className="flow-screens">
        <div className="aload">
          <div className="aload-inner">
            <div className="aload-top">
              <div className="aload-main">
                <div className="aload-head">
                  <span className="fstep-kicker">Analyse läuft</span>
                  {onToggleMuted ? (
                    <button
                      type="button"
                      className="aload-mute"
                      onClick={onToggleMuted}
                      aria-pressed={muted}
                      title={
                        muted
                          ? "Abschluss-Ton ist aus — zum Aktivieren klicken"
                          : "Abschluss-Ton ist an — zum Stummschalten klicken"
                      }
                    >
                      {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                      <span>{muted ? "Ton aus" : "Ton an"}</span>
                    </button>
                  ) : null}
                </div>

                <h2 className="aload-url">{ctx.url}</h2>

                <div className={`aload-bar ${done ? "" : "is-busy"}`}>
                  <div
                    className="aload-bar-fill"
                    style={{ width: `${pct}%` }}
                  />
                </div>

                <ul className="aload-steps">
                  {steps.map((s, idx) => (
                    <li
                      key={s.key}
                      className={
                        s.done ? "done" : idx === activeIndex ? "active" : ""
                      }
                    >
                      <span className="aload-dot">
                        {s.done ? <Check size={12} /> : null}
                      </span>
                      {s.label}
                    </li>
                  ))}
                </ul>

                <p className="aload-hint">
                  Echte Analyse: Seiten werden gerendert und von Claude visuell
                  geprüft — rund 30–60&nbsp;Sekunden pro Seite.{" "}
                  <span className="aload-elapsed">läuft seit {elapsed}s</span>
                </p>
              </div>

              <div className="aload-aside">
                <div className="aload-scan">
                  <Wireframe type={wfType} />
                  {done ? null : (
                    <span className="aload-scanline" aria-hidden="true" />
                  )}
                </div>
                <p className="aload-scan-label">
                  {done ? (
                    <>
                      <Check size={15} /> Analyse abgeschlossen
                    </>
                  ) : (
                    <>
                      <Loader2 size={15} className="spin" /> Gerade in Analyse:{" "}
                      {activeLabel}
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="aload-calc">
              <header className="aload-calc-head">
                <span className="fstep-kicker">Während du wartest</span>
                <h3 className="ovw-calc-title">
                  Nutze die Wartezeit — errechne deinen Business Impact
                </h3>
                <p className="aload-calc-sub">
                  Was bringen dir 10 / 20 / 30 % mehr Conversion in Euro?
                </p>
              </header>
              <Calculator />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

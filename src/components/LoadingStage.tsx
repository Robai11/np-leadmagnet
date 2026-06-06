"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import type { AnalysisContext } from "@/lib/types";

// Funnel order; only the steps the user actually selected are shown. `done` is
// driven by the real stream (which pages have arrived), not a fixed timer.
const PAGE_STEPS: { id: string; label: string }[] = [
  { id: "home", label: "Startseite gerendert · Elemente erkannt" },
  { id: "plp", label: "Kategorieseite analysiert" },
  { id: "pdp", label: "Produktseite · Mobile + Desktop gerendert" },
  { id: "cart", label: "Warenkorb · Artikel hinzugefügt" },
  { id: "checkout", label: "Checkout bis zur Zahlungswand gelesen" },
];

export function LoadingStage({
  ctx,
  analyzedIds,
  selectedIds,
  progressPct,
  done,
}: {
  ctx: AnalysisContext;
  analyzedIds: string[];
  /** Page types the user selected; when null, show the full funnel. */
  selectedIds: string[] | null;
  progressPct: number;
  done: boolean;
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
  const pct = Math.min(100, progressPct);

  return (
    <div className="stage loading-stage">
      <div className="load-card">
        <span className="kicker">Analyse läuft</span>
        <h2>{ctx.url}</h2>
        <div className={`bar ${done ? "" : "bar-busy"}`}>
          <div className="bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <ul className="steps">
          {steps.map((s, idx) => (
            <li
              key={s.key}
              className={s.done ? "done" : idx === activeIndex ? "active" : ""}
            >
              <span className="step-dot">
                {s.done ? <Check size={12} /> : null}
              </span>
              {s.label}
            </li>
          ))}
        </ul>
        <p className="load-hint">
          Echte Analyse: Seiten werden gerendert und von Claude visuell geprüft —
          das dauert pro Seite rund 30–60&nbsp;Sekunden.{" "}
          <span className="load-elapsed">läuft seit {elapsed}s</span>
        </p>
      </div>
    </div>
  );
}

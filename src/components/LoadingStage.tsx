"use client";

import { Check } from "lucide-react";
import type { AnalysisContext } from "@/lib/types";

// Mirrors the pipeline's funnel order. `done` for a page step is driven by the
// real stream (which pages have arrived), so this checklist reflects actual
// progress rather than a fixed timer.
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
  progressPct,
  done,
}: {
  ctx: AnalysisContext;
  analyzedIds: string[];
  progressPct: number;
  done: boolean;
}) {
  const steps = [
    { key: "shop", label: "Shop wird aufgerufen …", done: progressPct >= 5 },
    ...PAGE_STEPS.map((s) => ({
      key: s.id,
      label: s.label,
      done: analyzedIds.includes(s.id),
    })),
    {
      key: "score",
      label: "Hebel werden bewertet und priorisiert …",
      done,
    },
  ];
  const activeIndex = steps.findIndex((s) => !s.done);
  const pct = Math.min(100, progressPct);

  return (
    <div className="stage loading-stage">
      <div className="load-card">
        <span className="kicker">Analyse läuft</span>
        <h2>{ctx.url}</h2>
        <div className="bar">
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
      </div>
    </div>
  );
}

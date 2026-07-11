"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import type { AnalysisContext } from "@/lib/types";
import { HeroWall } from "@/components/HeroWall";
import { BotJourney } from "@/components/BotJourney";

const PAGE_IDS = ["home", "plp", "pdp", "cart", "checkout"];

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

  const total = selectedIds ? selectedIds.length : PAGE_IDS.length;
  const doneCount = Math.min(
    total,
    analyzedIds.filter((id) => PAGE_IDS.includes(id)).length,
  );
  const pct = Math.min(100, progressPct);

  // Geschätzte Restzeit: sobald genug Fortschritt da ist, aus
  // elapsed/Fortschritt hochrechnen (passt sich selbst an), sonst grobe
  // Schätzung (~50 s/Seite + Overhead). Immer als "ca." gekennzeichnet.
  let estLabel: string;
  if (done || pct >= 99) {
    estLabel = "fast fertig …";
  } else {
    const fallback = total * 50 + 30;
    const estTotal = pct >= 8 && elapsed >= 4 ? elapsed / (pct / 100) : fallback;
    const remaining = Math.max(10, Math.round(estTotal - elapsed));
    estLabel =
      remaining > 90
        ? `noch ca. ${Math.ceil(remaining / 60)} Min`
        : `noch ca. ${Math.ceil(remaining / 15) * 15} Sek`;
  }

  return (
    <div className="hero hero--deep">
      <HeroWall />
      <div className="hero-scrim hero-scrim--radial" aria-hidden="true" />
      <div className="hero-scrim hero-scrim--vert" aria-hidden="true" />
      <div className="hero-deep-veil" aria-hidden="true" />

      <div className="flow-screens">
        <div className="aload">
          <div className="aload-inner">
            <div className="aload-intro">
              <h2 className="aload-headline2">
                Ich durchlaufe jetzt deinen Shop und finde die wichtigsten
                Optimierungen — priorisiert nach Umsatz-Effekt und
                Änderungsaufwand.
              </h2>
              <p className="aload-subhead">
                Warte ein paar Minuten hier — oder komm einfach später wieder.
              </p>

              {onToggleMuted ? (
                <button
                  type="button"
                  className={`aload-bell ${muted ? "" : "is-on"}`}
                  onClick={onToggleMuted}
                  role="switch"
                  aria-checked={!muted}
                >
                  <span className="aload-bell-switch" aria-hidden="true">
                    <span className="aload-bell-knob" />
                  </span>
                  {muted ? (
                    <BellOff size={15} aria-hidden="true" />
                  ) : (
                    <Bell size={15} aria-hidden="true" />
                  )}
                  <span className="aload-bell-text">
                    {muted
                      ? "Ton aktivieren — klingt im Browser, sobald deine Optimierungen bereit sind"
                      : "Ton an — klingt im Browser, sobald deine Optimierungen bereit sind"}
                  </span>
                </button>
              ) : null}
            </div>

            <div className="aload-progress">
              <p className="aload-url">{ctx.url}</p>
              <div className={`aload-bar ${done ? "" : "is-busy"}`}>
                <div className="aload-bar-fill" style={{ width: `${pct}%` }} />
              </div>
              <p className="aload-count">
                {done ? null : <Loader2 size={14} className="spin" />}
                {doneCount} von {total} Seiten gelesen · {estLabel}
              </p>
            </div>

            <BotJourney />
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Volume2, VolumeX, Loader2 } from "lucide-react";
import type { AnalysisContext } from "@/lib/types";
import { HeroWall } from "@/components/HeroWall";
import { Calculator } from "@/components/Calculator";
import { BotJourney } from "@/components/BotJourney";

const PAGE_IDS = ["home", "plp", "pdp", "cart", "checkout"];

// Dynamisch wechselnde Beispiele, was man sich in der Wartezeit holen kann.
const SNACKS = [
  "einen Kaffee",
  "einen Schokoriegel",
  "ein paar Gummibären",
  "einen Tee",
  "einen Snack",
];

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

  const [snackIdx, setSnackIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(
      () => setSnackIdx((n) => (n + 1) % SNACKS.length),
      2400,
    );
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
            {onToggleMuted ? (
              <button
                type="button"
                className="aload-mute aload-mute--corner"
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

            <div className="aload-intro">
              <h2 className="aload-headline2">
                Ich durchlaufe jetzt deinen Shop und finde die wichtigsten
                Optimierungen — priorisiert nach Umsatz-Effekt und
                Änderungsaufwand.
              </h2>
              <p className="aload-subhead">
                Warte ein paar Minuten hier — oder hol dir{" "}
                <span className="aload-snack" key={snackIdx}>
                  {SNACKS[snackIdx]}
                </span>
                .
              </p>
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

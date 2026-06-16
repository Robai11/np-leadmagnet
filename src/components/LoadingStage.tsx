"use client";

import { useEffect, useState } from "react";
import { Volume2, VolumeX, Loader2 } from "lucide-react";
import type { AnalysisContext } from "@/lib/types";
import { HeroWall } from "@/components/HeroWall";
import { Calculator } from "@/components/Calculator";
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

  return (
    <div className="hero hero--deep">
      <HeroWall />
      <div className="hero-scrim hero-scrim--radial" aria-hidden="true" />
      <div className="hero-scrim hero-scrim--vert" aria-hidden="true" />
      <div className="hero-deep-veil" aria-hidden="true" />

      <div className="flow-screens">
        <div className="aload">
          <div className="aload-inner">
            <div className="aload-headbar">
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
                <div className="aload-bar-fill" style={{ width: `${pct}%` }} />
              </div>

              <p className="aload-count">
                {done ? null : <Loader2 size={14} className="spin" />}
                {doneCount} von {total} Seiten gelesen · läuft seit {elapsed}s
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

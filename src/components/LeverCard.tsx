"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Lock, Zap, ChevronDown } from "lucide-react";
import { impactVar } from "@/styles/tokens";
import { CATEGORY_META } from "@/lib/taxonomy";
import { IMPACT_LABELS, EFFORT_LABELS } from "@/lib/labels";
import { isQuickWin } from "@/lib/scoring";
import { useIsMobile } from "@/lib/useIsMobile";
import type { Lever, LeverType } from "@/lib/types";

function Range({ range, type }: { range: [number, number]; type: LeverType }) {
  if (type === "aov") return <span className="range aov">AOV-Hebel</span>;
  return (
    <span className="range">
      +{range[0].toFixed(1)}–{range[1].toFixed(1)}%
    </span>
  );
}

export function LeverCard({
  lv,
  locked,
  hovered,
  setHovered,
  onUnlock,
}: {
  lv: Lever;
  locked: boolean;
  hovered: { id: string; from: "pin" | "card" } | null;
  setHovered: (h: { id: string; from: "pin" | "card" } | null) => void;
  onUnlock: () => void;
}) {
  const active = hovered?.id === lv.id;
  const Icon = CATEGORY_META[lv.category].icon;
  const cVar = { "--c": impactVar(lv.impact) } as CSSProperties;
  const quick = isQuickWin(lv);
  const ref = useRef<HTMLDivElement>(null);

  // Mobile: Karte eingeklappt zeigen (Titel + Badges + 1 Zeile Teaser), per Tap
  // aufklappen. Auf Desktop unverändert (collapsible = false → voller Inhalt).
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const collapsible = isMobile;
  const showFull = !collapsible || open;

  // Diese Karte NUR in den Blick scrollen, wenn der Hover vom PIN kommt (nicht
  // von der Karte selbst) — sonst rutscht die Karte unterm Cursor weg. `block:
  // nearest` ist ohnehin ein No-op, wenn die Karte schon sichtbar ist.
  const scrollIn = active && hovered?.from === "pin";
  useEffect(() => {
    if (scrollIn)
      ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [scrollIn]);

  if (locked) {
    return (
      <div
        ref={ref}
        className={`card locked ${active ? "active" : ""}`}
        onMouseEnter={() => setHovered({ id: lv.id, from: "card" })}
        onMouseLeave={() => setHovered(null)}
      >
        <div className="card-top">
          <span className="pin-num" style={cVar}>
            {lv.n}
          </span>
          <span className="badge" style={cVar}>
            {IMPACT_LABELS[lv.impact]}
          </span>
          <Range range={lv.range} type={lv.type} />
        </div>
        <div className="locked-row">
          <Lock size={15} />
          <span>{lv.categoryLabel} · Hypothese gesperrt</span>
          <button className="unlock-mini" onClick={onUnlock}>
            freischalten
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className={`card ${active ? "active" : ""} ${collapsible ? "card--mob" : ""} ${collapsible && open ? "is-open" : ""}`}
      onMouseEnter={() => setHovered({ id: lv.id, from: "card" })}
      onMouseLeave={() => setHovered(null)}
      onClick={collapsible ? () => setOpen((o) => !o) : undefined}
      role={collapsible ? "button" : undefined}
      tabIndex={collapsible ? 0 : undefined}
      aria-expanded={collapsible ? open : undefined}
      onKeyDown={
        collapsible
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setOpen((o) => !o);
              }
            }
          : undefined
      }
    >
      <div className="card-top">
        <span className="pin-num" style={cVar}>
          {lv.n}
        </span>
        <span className="cat">
          <Icon size={13} /> <span className="cat-txt">{lv.categoryLabel}</span>
        </span>
        {quick && (
          <span className="quickwin">
            <Zap size={11} aria-hidden="true" /> Quick Win
          </span>
        )}
        <span className="badge" style={cVar}>
          Effekt: {IMPACT_LABELS[lv.impact]}
        </span>
        {lv.effort && (
          <span className={`effort effort--${lv.effort}`}>
            Aufwand: {EFFORT_LABELS[lv.effort]}
          </span>
        )}
        <Range range={lv.range} type={lv.type} />
      </div>
      <h4 className="card-title">{lv.title}</h4>
      {collapsible && !open && (
        <p className="card-teaser">
          <b>Problem &amp; Potenzial:</b> {lv.observation}
        </p>
      )}
      {showFull && (
        <div className="card-body">
          <p>
            <b>Problem &amp; Potenzial:</b> {lv.observation}
          </p>
          <p className="test">
            <b>Optimierungsempfehlung:</b> {lv.test}
          </p>
          <p>
            <b>Psychologischer Hintergrund:</b> {lv.mechanism}
          </p>
        </div>
      )}
      {collapsible && (
        <span className="card-toggle">
          <ChevronDown size={15} aria-hidden="true" />
          {open ? "Weniger anzeigen" : "Mehr anzeigen"}
        </span>
      )}
    </div>
  );
}

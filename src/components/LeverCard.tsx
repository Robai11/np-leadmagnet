"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { Lock } from "lucide-react";
import { impactVar } from "@/styles/tokens";
import { CATEGORY_META } from "@/lib/taxonomy";
import { IMPACT_LABELS } from "@/lib/labels";
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
  hovered: string | null;
  setHovered: (id: string | null) => void;
  onUnlock: () => void;
}) {
  const active = hovered === lv.id;
  const Icon = CATEGORY_META[lv.category].icon;
  const cVar = { "--c": impactVar(lv.impact) } as CSSProperties;
  const ref = useRef<HTMLDivElement>(null);

  // When this lever becomes active (e.g. its pin in the screenshot is hovered),
  // scroll this card into view. `block: nearest` makes it a no-op when the card
  // is already visible (i.e. when the hover started on the card itself).
  useEffect(() => {
    if (active) ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [active]);

  if (locked) {
    return (
      <div
        ref={ref}
        className={`card locked ${active ? "active" : ""}`}
        onMouseEnter={() => setHovered(lv.id)}
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
      className={`card ${active ? "active" : ""}`}
      onMouseEnter={() => setHovered(lv.id)}
      onMouseLeave={() => setHovered(null)}
    >
      <div className="card-top">
        <span className="pin-num" style={cVar}>
          {lv.n}
        </span>
        <span className="cat">
          <Icon size={13} /> {lv.categoryLabel}
        </span>
        <span className="badge" style={cVar}>
          {IMPACT_LABELS[lv.impact]}
        </span>
        <Range range={lv.range} type={lv.type} />
      </div>
      <h4 className="card-title">{lv.title}</h4>
      <div className="card-body">
        <p>
          <b>Beobachtung.</b> {lv.observation}
        </p>
        <p>
          <b>Mechanismus.</b> {lv.mechanism}
        </p>
        <p className="test">
          <b>Test.</b> {lv.test}
        </p>
      </div>
    </div>
  );
}

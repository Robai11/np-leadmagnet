import { Fragment } from "react";
import { opportunityVar } from "@/styles/tokens";
import type { AnalyzedPage } from "@/lib/types";

export function FunnelStrip({
  pages,
  unlocked,
  selected,
  setSelected,
}: {
  pages: AnalyzedPage[];
  unlocked: boolean;
  selected: string;
  setSelected: (id: string) => void;
}) {
  return (
    <div className="funnel">
      <span className="funnel-label">Gescannter Funnel</span>
      <div className="funnel-pages">
        {pages.map((p, idx) => {
          const n = p.levers.length;
          const clickable = unlocked;
          return (
            <Fragment key={p.id}>
              <button
                className={`fpage ${selected === p.id ? "sel" : ""} ${
                  clickable ? "click" : ""
                }`}
                onClick={() => clickable && setSelected(p.id)}
              >
                <span
                  className="opp"
                  style={{ background: opportunityVar(p.opportunity) }}
                />
                <span className="fname">{p.name}</span>
                <span className="fmeta">{n} Hebel</span>
              </button>
              {idx < pages.length - 1 && <span className="farrow">›</span>}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

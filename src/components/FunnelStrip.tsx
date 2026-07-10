import { Fragment } from "react";
import { Lock, Sparkles } from "lucide-react";
import { opportunityVar } from "@/styles/tokens";
import { FAZIT_TAB } from "@/components/ReportStage";
import type { AnalyzedPage } from "@/lib/types";

export function FunnelStrip({
  pages,
  lockedIds = [],
  selected,
  setSelected,
  fazit = false,
}: {
  pages: AnalyzedPage[];
  /** Ids of tabs whose content is gated behind the lead form (lock badge). */
  lockedIds?: string[];
  selected: string;
  setSelected: (id: string) => void;
  /** Show the distinct, always-free Fazit tab as the first item. */
  fazit?: boolean;
}) {
  return (
    <div className="funnel">
      <span className="funnel-label">Gescannter Funnel</span>
      <div className="funnel-pages">
        {fazit && (
          <button
            className={`fpage fpage--fazit click ${
              selected === FAZIT_TAB ? "sel" : ""
            }`}
            onClick={() => setSelected(FAZIT_TAB)}
          >
            <Sparkles size={13} className="fpage-fazit-ico" aria-hidden="true" />
            <span className="fname">Fazit</span>
            <span className="fmeta">Zusammenfassung</span>
          </button>
        )}
        {pages.map((p, idx) => {
          const n = p.levers.length;
          const locked = lockedIds.includes(p.id);
          return (
            <Fragment key={p.id}>
              <button
                className={`fpage click ${selected === p.id ? "sel" : ""} ${
                  locked ? "locked" : ""
                }`}
                onClick={() => setSelected(p.id)}
              >
                <span
                  className="opp"
                  style={{ background: opportunityVar(p.opportunity) }}
                />
                <span className="fname">
                  {p.name}
                  {locked && (
                    <Lock size={11} className="fpage-lock" aria-hidden="true" />
                  )}
                </span>
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

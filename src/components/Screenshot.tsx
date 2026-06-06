import type { CSSProperties } from "react";
import { Chrome, MOCK_SCREENS } from "@/components/MockScreens";
import { impactVar } from "@/styles/tokens";
import type { AnalyzedPage } from "@/lib/types";

export function Screenshot({
  page,
  url,
  hovered,
  setHovered,
}: {
  page: AnalyzedPage;
  url?: string;
  hovered: string | null;
  setHovered: (id: string | null) => void;
}) {
  const Mock = MOCK_SCREENS[page.id];
  return (
    <div className="shot">
      <Chrome url={url}>
        {page.screenshotUrl ? (
          // Real full-page screenshot (Vercel Blob) from M3 onward.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={page.screenshotUrl}
            alt={`${page.name} – analysierte Seite`}
            style={{ width: "100%", display: "block" }}
          />
        ) : Mock ? (
          <Mock />
        ) : null}
      </Chrome>
      <div className="pin-layer">
        {page.levers.map((lv) => {
          const active = hovered === lv.id;
          return (
            <button
              key={lv.id}
              className={`pin ${active ? "active" : ""}`}
              style={
                {
                  left: `${lv.pin.x}%`,
                  top: `${lv.pin.y}%`,
                  "--c": impactVar(lv.impact),
                } as CSSProperties
              }
              onMouseEnter={() => setHovered(lv.id)}
              onMouseLeave={() => setHovered(null)}
              aria-label={lv.title}
            >
              {lv.n}
            </button>
          );
        })}
      </div>
    </div>
  );
}

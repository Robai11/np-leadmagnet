import type { CSSProperties } from "react";
import { Smartphone, Monitor } from "lucide-react";
import { Chrome, MOCK_SCREENS } from "@/components/MockScreens";
import { impactVar } from "@/styles/tokens";
import type { AnalyzedPage, Lever, Viewport } from "@/lib/types";

function PinLayer({
  levers,
  hovered,
  setHovered,
}: {
  levers: Lever[];
  hovered: string | null;
  setHovered: (id: string | null) => void;
}) {
  return (
    <div className="pin-layer">
      {levers.map((lv) => (
        <button
          key={lv.id}
          className={`pin ${hovered === lv.id ? "active" : ""}`}
          style={
            {
              left: `${lv.pin.x}%`,
              top: `${lv.pin.y}%`,
              "--c": impactVar(lv.impact),
            } as CSSProperties
          }
          onMouseEnter={() => setHovered(lv.id)}
          onMouseLeave={() => setHovered(null)}
          aria-label={lv.title || `Hebel ${lv.n}`}
        >
          {lv.n}
        </button>
      ))}
    </div>
  );
}

/** The scrollable image + pin overlay (pins are positioned over the full image). */
function Canvas({
  pageId,
  name,
  screenshotUrl,
  levers,
  hovered,
  setHovered,
}: {
  pageId: string;
  name: string;
  screenshotUrl?: string;
  levers: Lever[];
  hovered: string | null;
  setHovered: (id: string | null) => void;
}) {
  const Mock = MOCK_SCREENS[pageId];
  return (
    <div className="screen-canvas">
      {screenshotUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={screenshotUrl}
          alt={`${name} – analysierte Seite`}
          style={{ width: "100%", display: "block" }}
        />
      ) : Mock ? (
        <Mock />
      ) : null}
      <PinLayer levers={levers} hovered={hovered} setHovered={setHovered} />
    </div>
  );
}

/** One framed view: browser chrome for desktop, a phone mockup for mobile. */
function Screen({
  pageId,
  name,
  viewport,
  screenshotUrl,
  levers,
  url,
  showLabel,
  hovered,
  setHovered,
}: {
  pageId: string;
  name: string;
  viewport: Viewport;
  screenshotUrl?: string;
  levers: Lever[];
  url?: string;
  showLabel: boolean;
  hovered: string | null;
  setHovered: (id: string | null) => void;
}) {
  const canvas = (
    <Canvas
      pageId={pageId}
      name={name}
      screenshotUrl={screenshotUrl}
      levers={levers}
      hovered={hovered}
      setHovered={setHovered}
    />
  );

  const label = showLabel && (
    <div className="screen-label">
      {viewport === "mobile" ? <Smartphone size={13} /> : <Monitor size={13} />}
      {viewport === "mobile" ? "Mobile" : "Desktop"}
    </div>
  );

  if (viewport === "mobile") {
    return (
      <div className="screen-wrap">
        {label}
        <div className="shot shot-mobile">
          <div className="phone-frame">
            <div className="phone-screen">{canvas}</div>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="screen-wrap">
      {label}
      <div className={`shot shot-desktop ${screenshotUrl ? "shot-real" : ""}`}>
        <Chrome url={url}>{canvas}</Chrome>
      </div>
    </div>
  );
}

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
  const hasTwo = Boolean(page.secondary);
  return (
    <div className={`shots ${hasTwo ? "shots-stacked" : ""}`}>
      <Screen
        pageId={page.id}
        name={page.name}
        viewport={page.viewport}
        screenshotUrl={page.screenshotUrl}
        levers={page.levers}
        url={url}
        showLabel={hasTwo}
        hovered={hovered}
        setHovered={setHovered}
      />
      {page.secondary && (
        <Screen
          pageId={page.id}
          name={page.name}
          viewport={page.secondary.viewport}
          screenshotUrl={page.secondary.screenshotUrl}
          levers={page.secondary.levers}
          url={url}
          showLabel
          hovered={hovered}
          setHovered={setHovered}
        />
      )}
    </div>
  );
}

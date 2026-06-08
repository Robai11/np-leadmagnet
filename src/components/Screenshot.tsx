"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { Smartphone, Monitor } from "lucide-react";
import { MOCK_SCREENS } from "@/components/MockScreens";
import { impactVar } from "@/styles/tokens";
import type { AnalyzedPage, Lever, Viewport } from "@/lib/types";

function ChromeBar({ url }: { url?: string }) {
  return (
    <div className="chrome-bar">
      <span className="dot" style={{ background: "#E5685A" }} />
      <span className="dot" style={{ background: "#E8B73B" }} />
      <span className="dot" style={{ background: "#5BC07A" }} />
      <div className="chrome-url">{url || "example-shop.de"}</div>
    </div>
  );
}

/**
 * One framed, SCROLLABLE view (phone mockup for mobile, browser chrome for
 * desktop). The frame stays a realistic size; hovering a lever card scrolls the
 * frame so that lever's pin comes into view (and on mount it rests on the first
 * pin), so pins are always reachable without an endless page.
 */
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const Mock = MOCK_SCREENS[pageId];

  useEffect(() => {
    const c = scrollRef.current;
    if (!c) return;
    const lev = hovered ? levers.find((l) => l.id === hovered) : levers[0];
    if (!lev) return;
    const top = (lev.pin.y / 100) * c.scrollHeight - c.clientHeight / 2;
    c.scrollTo({ top: Math.max(0, top), behavior: hovered ? "smooth" : "auto" });
  }, [hovered, levers]);

  const body = (
    <div
      className={`screen-scroll ${viewport === "mobile" ? "phone-screen" : "desk-scroll"}`}
      ref={scrollRef}
    >
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
      </div>
    </div>
  );

  const label = showLabel ? (
    <div className="screen-label">
      {viewport === "mobile" ? <Smartphone size={13} /> : <Monitor size={13} />}
      {viewport === "mobile" ? "Mobile" : "Desktop"}
    </div>
  ) : null;

  if (viewport === "mobile") {
    return (
      <div className="screen-wrap">
        {label}
        <div className="shot shot-mobile">
          <div className="phone-frame">{body}</div>
        </div>
      </div>
    );
  }
  return (
    <div className="screen-wrap">
      {label}
      <div className="shot shot-desktop">
        <ChromeBar url={url} />
        {body}
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

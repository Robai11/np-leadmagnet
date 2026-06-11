"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { Smartphone, Monitor } from "lucide-react";
import { MOCK_SCREENS } from "@/components/MockScreens";
import { impactVar } from "@/styles/tokens";
import type { AnalyzedPage, Lever, Viewport } from "@/lib/types";

/** iOS status-bar icons (signal · wifi · battery) as crisp inline SVG. */
function PhoneStatusIcons() {
  return (
    <svg width="64" height="14" viewBox="0 0 64 14" fill="none" aria-hidden="true">
      <g fill="#000">
        <rect x="0" y="8.5" width="3" height="5.5" rx="1" />
        <rect x="5" y="6" width="3" height="8" rx="1" />
        <rect x="10" y="3.5" width="3" height="10.5" rx="1" />
        <rect x="15" y="1" width="3" height="13" rx="1" />
      </g>
      <path d="M23.5 5.6a8 8 0 0 1 11 0" stroke="#000" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M26 8.2a4.4 4.4 0 0 1 6 0" stroke="#000" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="29" cy="11.2" r="1.2" fill="#000" />
      <rect x="45" y="3" width="15" height="8" rx="2.4" stroke="#000" strokeWidth="1.2" />
      <rect x="46.5" y="4.5" width="10.5" height="5" rx="1.1" fill="#000" />
      <rect x="61" y="5.4" width="1.7" height="3.2" rx="0.8" fill="#000" />
    </svg>
  );
}

/**
 * One framed, SCROLLABLE view (iPhone mockup for mobile, MacBook mockup for
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
  showLabel,
  hovered,
  setHovered,
}: {
  pageId: string;
  name: string;
  viewport: Viewport;
  screenshotUrl?: string;
  levers: Lever[];
  showLabel: boolean;
  hovered: string | null;
  setHovered: (id: string | null) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const Mock = MOCK_SCREENS[pageId];

  // Center the pin for `id` in this frame, using the pin's REAL rendered
  // position (robust against image height / DOM nesting). No-op if the pin
  // isn't in this frame (e.g. a desktop card hovered while this is mobile).
  const scrollToPin = (id: string | undefined, smooth: boolean) => {
    const c = scrollRef.current;
    if (!c || !id) return;
    const pinEl = c.querySelector<HTMLElement>(`[data-pin="${CSS.escape(id)}"]`);
    if (!pinEl) return;
    const cRect = c.getBoundingClientRect();
    const pRect = pinEl.getBoundingClientRect();
    const top =
      c.scrollTop + (pRect.top - cRect.top) - c.clientHeight / 2 + pRect.height / 2;
    c.scrollTo({ top: Math.max(0, top), behavior: smooth ? "smooth" : "auto" });
  };

  // Hover a lever card (or pin) → scroll its pin into view.
  useEffect(() => {
    if (hovered) scrollToPin(hovered, true);
  }, [hovered]);

  // Initial scroll-to-first-pin runs on IMAGE LOAD (onLoad below), not on mount,
  // so the pin's position is final (data-URL images decode asynchronously).

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
            onLoad={() => scrollToPin(levers[0]?.id, false)}
          />
        ) : Mock ? (
          <Mock />
        ) : null}
        <div className="pin-layer">
          {levers.map((lv) => (
            <button
              key={lv.id}
              data-pin={lv.id}
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
          <div className="phone-frame">
            <span className="phone-btn phone-btn-mute" />
            <span className="phone-btn phone-btn-volup" />
            <span className="phone-btn phone-btn-voldn" />
            <span className="phone-btn phone-btn-power" />
            <div className="phone-bezel">
              <div className="phone-glass">
                <span className="phone-island" />
                <div className="phone-statusbar">
                  <span className="phone-time">08:00</span>
                  <span className="phone-status-icons">
                    <PhoneStatusIcons />
                  </span>
                </div>
                {body}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="screen-wrap">
      {label}
      <div className="shot shot-desktop">
        <div className="macbook">
          <div className="macbook-lid">
            <div className="macbook-bezel">
              <span className="macbook-notch" />
              {body}
            </div>
          </div>
          <div className="macbook-base">
            <span className="macbook-groove" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function Screenshot({
  page,
  hovered,
  setHovered,
}: {
  page: AnalyzedPage;
  /** Kept for API compatibility (ReportStage passes meta.url); unused now that
   *  the desktop frame is a MacBook mockup without a browser URL bar. */
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
          showLabel
          hovered={hovered}
          setHovered={setHovered}
        />
      )}
    </div>
  );
}

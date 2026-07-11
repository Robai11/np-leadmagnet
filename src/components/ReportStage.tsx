"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight,
  TrendingUp,
  Smartphone,
  Monitor,
  Sparkles,
  Check,
} from "lucide-react";
import { opportunityVar } from "@/styles/tokens";
import { rankPages, prioritize } from "@/lib/scoring";
import type { AnalysisResult } from "@/lib/types";
import { LEAD_GATE_ENABLED } from "@/lib/flags";
import { HeroWall } from "@/components/HeroWall";
import { FunnelStrip } from "@/components/FunnelStrip";
import { Screenshot } from "@/components/Screenshot";
import { LeverCard } from "@/components/LeverCard";
import { Calculator } from "@/components/Calculator";
import { LeadForm, type LeadData } from "@/components/LeadForm";

/** Sentinel-„Seite" für den Fazit-Tab (erster, farblich abgesetzter Tab). */
export const FAZIT_TAB = "__fazit__";

export function ReportStage({
  result,
  unlocked,
  onUnlock,
  initialSelected,
  onLead,
}: {
  result: AnalysisResult;
  unlocked: boolean;
  onUnlock: (email: string) => Promise<boolean>;
  /** Tab to land on first (preview/tests). Defaults to the free Startseite. */
  initialSelected?: string;
  /** Override the lead capture (preview/tests). Default POSTs to /api/lead. */
  onLead?: (data: LeadData) => Promise<{ ok: boolean; error?: string }>;
}) {
  const { meta, overall, notes, summary } = result;
  // Seitentypen IMMER in kanonischer Funnel-Reihenfolge zeigen — der Stream
  // liefert sie je nach Analyse-Dauer in beliebiger Reihenfolge.
  const pages = useMemo(() => {
    const rank: Record<string, number> = {
      home: 0,
      plp: 1,
      pdp: 2,
      cart: 3,
      checkout: 4,
    };
    return [...result.pages].sort(
      (a, b) => (rank[a.type] ?? 99) - (rank[b.type] ?? 99),
    );
  }, [result.pages]);
  // A page may carry two views (mobile + desktop at a 50/50 split); count both.
  const pageLevers = (p: (typeof pages)[number]) => [
    ...p.levers,
    ...(p.secondary?.levers ?? []),
  ];
  const totalLevers = pages.reduce((a, p) => a + pageLevers(p).length, 0);

  // Hero = highest-opportunity page; its first lever is the readable teaser.
  const heroPage = useMemo(() => rankPages(pages)[0] ?? pages[0], [pages]);
  const teaserPageId = heroPage?.id ?? "";
  const teaserLeverId = heroPage?.levers[0]?.id ?? "";

  // The single FREE tab: the Startseite (home), else the first page.
  const freeId = useMemo(
    () => (pages.find((p) => p.type === "home") ?? pages[0])?.id ?? "",
    [pages],
  );

  const [selected, setSelected] = useState(
    initialSelected ?? (summary ? FAZIT_TAB : freeId),
  );
  const isFazit = selected === FAZIT_TAB;
  // Hover-Verknüpfung Pin ↔ Karte inkl. Quelle: gehovert wird immer nur die
  // JEWEILS ANDERE Seite gescrollt (sonst bewegt sich das Element unterm Cursor
  // weg → Ruckeln).
  const [hovered, setHovered] = useState<{
    id: string;
    from: "pin" | "card";
  } | null>(null);
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [gateError, setGateError] = useState<string | null>(null);

  const lockedNow = !unlocked;
  const activePageId = unlocked ? selected : teaserPageId;
  const activePage = pages.find((p) => p.id === activePageId) ?? heroPage;

  // ── Client-side lead gate (LEAD_GATE_ENABLED) ───────────────────────────
  // The Startseite tab is free; every other tab blurs its content and shows the
  // lead form in place (within the tab content area). A captured lead reveals
  // the whole report. `revealing` plays the brief blur-clear transition.
  const gateOn = LEAD_GATE_ENABLED;
  const [revealed, setRevealed] = useState(false);
  const [revealing, setRevealing] = useState(false);

  const isLocked =
    gateOn && !revealed && !isFazit && activePage.type !== "home";
  const showGate = gateOn && (isLocked || revealing);
  const bodyBlurred = isLocked && !revealing;
  const lockedIds = useMemo(
    () =>
      gateOn && !revealed
        ? pages.filter((p) => p.type !== "home").map((p) => p.id)
        : [],
    [gateOn, revealed, pages],
  );

  // X = kritische Leaks (hoher Impact), Y = Umsatz-Upside (mittel/niedrig).
  const { critical, upside } = useMemo(() => {
    const all = pages.flatMap((p) => [
      ...p.levers,
      ...(p.secondary?.levers ?? []),
    ]);
    return {
      critical: all.filter((l) => l.impact === "high").length,
      upside: all.filter((l) => l.impact !== "high").length,
    };
  }, [pages]);

  const handleLead = async (
    d: LeadData,
  ): Promise<{ ok: boolean; error?: string }> => {
    let res: { ok: boolean; error?: string };
    if (onLead) {
      res = await onLead(d);
    } else {
      try {
        const r = await fetch("/api/lead", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ...d,
            url: meta.url,
            industry: meta.industry,
            device: meta.device,
            channels: meta.channels,
          }),
        });
        const j = (await r.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
        };
        res = r.ok && j.ok ? { ok: true } : { ok: false, error: j.error };
      } catch {
        res = { ok: false };
      }
    }
    if (res.ok) {
      setRevealing(true);
      window.setTimeout(() => {
        setRevealed(true);
        setRevealing(false);
      }, 900);
    }
    return res;
  };

  const submit = async () => {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || submitting) return;
    setSubmitting(true);
    setGateError(null);
    const ok = await onUnlock(email);
    setSubmitting(false);
    if (!ok) {
      setGateError(
        "Freischaltung fehlgeschlagen. Bitte E-Mail prüfen oder Analyse erneut starten.",
      );
    }
  };

  const scrollToGate = () =>
    document.getElementById("gate")?.scrollIntoView({ behavior: "smooth" });

  if (!activePage) return null;

  // Hebel nach Priorität (Umsatz-Effekt × Aufwand) sortieren + neu nummerieren —
  // "Quick Wins" zuerst. Cards UND Pins lesen dieselbe sortierte Liste.
  const displayPage = {
    ...activePage,
    levers: prioritize(activePage.levers),
    secondary: activePage.secondary
      ? { ...activePage.secondary, levers: prioritize(activePage.secondary.levers) }
      : undefined,
  };

  return (
    <>
      <div className="report-bg" aria-hidden="true">
        <HeroWall />
        <div className="hero-scrim hero-scrim--radial" />
        <div className="hero-scrim hero-scrim--vert" />
        <div className="hero-deep-veil" />
      </div>
      <div className="stage report-stage">
      <div className="fazit-slim-head">
        <span className="kicker">Funnel-Analyse · {meta.url}</span>
        <h2>
          {totalLevers} Conversion-Hebel über {pages.length} Seiten gefunden
        </h2>
        <div className="ctx-frame">
          Analysiert mit Blick auf: <b>{meta.device}% Mobile</b> ·{" "}
          <b>{meta.channels.join(", ")}</b> · <b>{meta.industry}</b>
        </div>
      </div>

      <FunnelStrip
        pages={pages}
        lockedIds={lockedIds}
        selected={selected}
        setSelected={setSelected}
        fazit={!!summary}
      />

      {notes.length > 0 && (
        <div className="report-notes">
          {notes.map((note, i) => (
            <span key={i}>{note}</span>
          ))}
        </div>
      )}

      {isFazit ? (
        <>
        <div className="fazit-hero fazit-hero--tab">
          <div className="fazit-hero-main">
            <span className="fazit-hero-kicker">
              <Sparkles size={15} aria-hidden="true" /> Fazit
            </span>
            {summary ? (
              <>
                <p className="fazit-hero-text">{summary.verdict}</p>
                {summary.points.length > 0 && (
                  <ul className="fazit-hero-points">
                    {summary.points.map((p, i) => (
                      <li key={i}>
                        <Check size={14} aria-hidden="true" />
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <p className="fazit-hero-text">
                {overall.note} Eure echten Funnel-Daten können das verschieben.
              </p>
            )}
          </div>
          <div className="fazit-hero-stat">
            <TrendingUp size={18} aria-hidden="true" />
            <span>Geschätztes Gesamtpotenzial</span>
            <strong>
              +{overall.low}–{overall.high}%
            </strong>
          </div>
        </div>
        <Calculator />
        </>
      ) : (
      <div className="report-tabzone">
        <div className={`report-body ${bodyBlurred ? "is-locked" : ""}`}>
          <div className="shot-col">
            <div className="shot-tag">
              <span
                className="opp"
                style={{ background: opportunityVar(displayPage.opportunity) }}
              />{" "}
              {displayPage.name} · {pageLevers(displayPage).length} Hebel
            </div>
            <Screenshot
              page={displayPage}
              url={meta.url}
              hovered={hovered}
              setHovered={setHovered}
            />
          </div>

          <div className="cards-col">
            {!unlocked && (
              <div className="teaser-note">
                <TrendingUp size={15} /> Stärkster Hebel sichtbar.{" "}
                {totalLevers - 1} weitere — inkl. Warenkorb & Checkout — nach
                Freischaltung.
              </div>
            )}
            {[
              { viewport: displayPage.viewport, levers: displayPage.levers },
              ...(displayPage.secondary
                ? [
                    {
                      viewport: displayPage.secondary.viewport,
                      levers: displayPage.secondary.levers,
                    },
                  ]
                : []),
            ]
              .filter((g) => g.levers.length > 0)
              .map((g) => (
                <div className="lever-group" key={g.viewport}>
                  <div className="lever-group-head">
                    {g.viewport === "mobile" ? (
                      <Smartphone size={14} />
                    ) : (
                      <Monitor size={14} />
                    )}
                    {g.viewport === "mobile" ? "Mobile" : "Desktop"} ·{" "}
                    {g.levers.length}{" "}
                    {g.levers.length === 1 ? "Hebel" : "Hebel"}
                  </div>
                  {g.levers.map((lv) => {
                    const isTeaserLever = lv.id === teaserLeverId;
                    const locked = lockedNow && !isTeaserLever;
                    return (
                      <LeverCard
                        key={lv.id}
                        lv={lv}
                        locked={locked}
                        hovered={hovered}
                        setHovered={setHovered}
                        onUnlock={scrollToGate}
                      />
                    );
                  })}
                </div>
              ))}

            {!unlocked && (
              <div className="gate" id="gate">
                <h3>Vollständige Analyse freischalten</h3>
                <p>
                  Alle {totalLevers} Hebel mit Hypothesen & Testvorschlägen über
                  den kompletten Funnel — inkl. Warenkorb und Checkout.
                </p>
                <div className="gate-row">
                  <input
                    placeholder="deine@email.de"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submit()}
                  />
                  <button onClick={submit} disabled={submitting}>
                    {submitting ? "Wird geladen …" : "Freischalten"}{" "}
                    <ArrowRight size={16} />
                  </button>
                </div>
                <span className="gate-hint">
                  {gateError ??
                    "Die gesperrten Hebel liegen serverseitig und werden erst nach Eingabe nachgeladen."}
                </span>
              </div>
            )}
          </div>
        </div>

        {showGate && (
          <div className={`tabgate ${revealing ? "is-revealing" : ""}`}>
            <LeadForm
              critical={critical}
              upside={upside}
              onSubmit={handleLead}
            />
          </div>
        )}
      </div>
      )}

      </div>
    </>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, TrendingUp, Smartphone, Monitor } from "lucide-react";
import { opportunityVar } from "@/styles/tokens";
import { rankPages } from "@/lib/scoring";
import type { AnalysisResult } from "@/lib/types";
import { LEAD_GATE_ENABLED } from "@/lib/flags";
import { FunnelStrip } from "@/components/FunnelStrip";
import { Screenshot } from "@/components/Screenshot";
import { LeverCard } from "@/components/LeverCard";
import { Calculator } from "@/components/Calculator";
import { LeadGate, type LeadData } from "@/components/LeadGate";

export function ReportStage({
  result,
  unlocked,
  onUnlock,
  peekMs = 5000,
  onLead,
}: {
  result: AnalysisResult;
  unlocked: boolean;
  onUnlock: (email: string) => Promise<boolean>;
  /** How long the full report is shown before the lead gate comes up. */
  peekMs?: number;
  /** Override the lead capture (preview/tests). Default POSTs to /api/lead. */
  onLead?: (
    data: LeadData,
  ) => Promise<{ ok: boolean; error?: string }>;
}) {
  const { meta, overall, pages, notes } = result;
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

  const [selected, setSelected] = useState(teaserPageId);
  const [hovered, setHovered] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [gateError, setGateError] = useState<string | null>(null);

  const lockedNow = !unlocked;
  const activePageId = unlocked ? selected : teaserPageId;
  const activePage = pages.find((p) => p.id === activePageId) ?? heroPage;

  // ── Client-side lead gate (LEAD_GATE_ENABLED) ───────────────────────────
  // Peek the full report for a few seconds, then blur + lead form, then reveal
  // with the landing-style curtain part.
  const gateOn = LEAD_GATE_ENABLED;
  const [phase, setPhase] = useState<"peek" | "gate" | "revealing" | "open">(
    gateOn ? "peek" : "open",
  );
  const blurred = phase === "gate";

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

  // Peek → gate after the configured peek window.
  useEffect(() => {
    if (!gateOn || phase !== "peek") return;
    const t = window.setTimeout(() => setPhase("gate"), peekMs);
    return () => window.clearTimeout(t);
  }, [gateOn, phase, peekMs]);

  // Lock background scroll while the gate is up (the peek stays framed behind).
  useEffect(() => {
    if (phase !== "gate") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [phase]);

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
      setPhase("revealing");
      window.setTimeout(() => setPhase("open"), 1100);
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

  return (
    <div className="report-shell">
      <div className={`stage report-stage ${blurred ? "is-gated" : ""}`}>
      <div className="report-head">
        <div>
          <span className="kicker">Funnel-Analyse · {meta.url}</span>
          <h2>
            {totalLevers} Conversion-Hebel über {pages.length} Seiten gefunden
          </h2>
          <div className="ctx-frame">
            Analysiert mit Blick auf: <b>{meta.device}% Mobile</b> ·{" "}
            <b>{meta.channels.join(", ")}</b> · <b>{meta.industry}</b>
          </div>
        </div>
        <div className="headline-uplift">
          <span>Geschätztes Gesamtpotenzial</span>
          <strong>
            +{overall.low}–{overall.high}%
          </strong>
          <em>{overall.note} Eure echten Funnel-Daten können das verschieben.</em>
        </div>
      </div>

      <FunnelStrip
        pages={pages}
        unlocked={unlocked}
        selected={selected}
        setSelected={setSelected}
      />

      {notes.length > 0 && (
        <div className="report-notes">
          {notes.map((note, i) => (
            <span key={i}>{note}</span>
          ))}
        </div>
      )}

      <div className="report-body">
        <div className="shot-col">
          <div className="shot-tag">
            <span
              className="opp"
              style={{ background: opportunityVar(activePage.opportunity) }}
            />{" "}
            {activePage.name} · {pageLevers(activePage).length} Hebel
          </div>
          <Screenshot
            page={activePage}
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
            { viewport: activePage.viewport, levers: activePage.levers },
            ...(activePage.secondary
              ? [
                  {
                    viewport: activePage.secondary.viewport,
                    levers: activePage.secondary.levers,
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
                  {g.viewport === "mobile" ? "Mobile" : "Desktop"} · {g.levers.length}{" "}
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

      <Calculator />
      </div>

      {gateOn && (phase === "gate" || phase === "revealing") && (
        <LeadGate
          phase={phase}
          critical={critical}
          upside={upside}
          onSubmit={handleLead}
        />
      )}
    </div>
  );
}

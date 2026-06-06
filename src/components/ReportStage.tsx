"use client";

import { useMemo, useState } from "react";
import { ArrowRight, TrendingUp } from "lucide-react";
import { opportunityVar } from "@/styles/tokens";
import { rankPages } from "@/lib/scoring";
import type { AnalysisResult } from "@/lib/types";
import { FunnelStrip } from "@/components/FunnelStrip";
import { Screenshot } from "@/components/Screenshot";
import { LeverCard } from "@/components/LeverCard";
import { Calculator } from "@/components/Calculator";

export function ReportStage({
  result,
  unlocked,
  onUnlock,
}: {
  result: AnalysisResult;
  unlocked: boolean;
  onUnlock: (email: string) => Promise<boolean>;
}) {
  const { meta, overall, pages, notes } = result;
  const totalLevers = pages.reduce((a, p) => a + p.levers.length, 0);

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
    <div className="stage report-stage">
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
            {activePage.name} · {activePage.levers.length} Hebel
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
          {activePage.levers.map((lv) => {
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
  );
}

"use client";

import { useEffect, useState } from "react";
import { Check, Clock, Loader2 } from "lucide-react";
import type { AnalysisContext } from "@/lib/types";
import { isValidEmail } from "@/lib/email";
import { HeroWall } from "@/components/HeroWall";
import { BotJourney } from "@/components/BotJourney";

const PAGE_IDS = ["home", "plp", "pdp", "cart", "checkout"];

const PAGE_LABELS: Record<string, string> = {
  home: "Startseite",
  plp: "Kategorieseite",
  pdp: "Produktseite",
  cart: "Warenkorb",
  checkout: "Checkout",
};

// Fake-Hebelzahlen pro Seitentyp — es werden bewusst keine echten Funde aus dem
// Stream gezählt (Wunsch: einfache Platzhalter). Die Seiten-Zustände (fertig /
// läuft / offen) hängen aber am echten Analyse-Fortschritt.
const FAKE_LEVERS: Record<string, number> = {
  home: 2,
  plp: 3,
  pdp: 4,
  cart: 2,
  checkout: 3,
};

// Timer-Start (Fake): „bis zu 15 Minuten".
const TIMER_START = 14 * 60 + 52;

export function LoadingStage({
  ctx,
  analyzedIds,
  selectedIds,
  progressPct,
  done,
}: {
  ctx: AnalysisContext;
  selectedIds: string[] | null;
  analyzedIds: string[];
  progressPct: number;
  done: boolean;
}) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Fake-Countdown in der Mail-Karte.
  const [secs, setSecs] = useState(TIMER_START);
  useEffect(() => {
    const t = setInterval(() => setSecs((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, []);
  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");

  // E-Mail-Erfassung.
  const [email, setEmail] = useState("");
  const [mailState, setMailState] = useState<
    "idle" | "sending" | "done" | "error"
  >("idle");
  const [mailErr, setMailErr] = useState("");
  const [sentTo, setSentTo] = useState("");

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim();
    if (!isValidEmail(value)) {
      setMailErr("Bitte gib eine gültige E-Mail-Adresse ein.");
      return;
    }
    setMailErr("");
    setMailState("sending");
    try {
      const res = await fetch("/api/lead-email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: value,
          url: ctx.url,
          industry: ctx.industry,
          device: ctx.device,
          channels: ctx.channels,
        }),
      });
      if (res.ok) {
        setSentTo(value);
        setMailState("done");
      } else {
        setMailState("error");
        setMailErr("Hat nicht geklappt. Bitte versuch es gleich noch einmal.");
      }
    } catch {
      setMailState("error");
      setMailErr("Hat nicht geklappt. Bitte versuch es gleich noch einmal.");
    }
  };

  const total = selectedIds ? selectedIds.length : PAGE_IDS.length;
  const doneSet = new Set(analyzedIds.filter((id) => PAGE_IDS.includes(id)));
  const doneCount = Math.min(total, doneSet.size);
  const pct = Math.min(100, progressPct);

  // Seitenliste in fester Funnel-Reihenfolge; nur die ausgewählten Seiten.
  const pageOrder = (
    selectedIds && selectedIds.length
      ? PAGE_IDS.filter((id) => selectedIds.includes(id))
      : PAGE_IDS
  ) as string[];
  // Erste noch nicht fertige Seite = „läuft", alle danach = offen.
  const runningIdx = pageOrder.findIndex((id) => !doneSet.has(id));
  const rows = pageOrder.map((id, i) => {
    const isDone = doneSet.has(id);
    return {
      id,
      label: PAGE_LABELS[id] ?? id,
      state: isDone ? "done" : i === runningIdx ? "running" : "pending",
      levers: FAKE_LEVERS[id] ?? 2,
    };
  });
  // Gesamtzahl = Summe der (Fake-)Hebel aller fertigen Seiten.
  const foundTotal = rows
    .filter((r) => r.state === "done")
    .reduce((s, r) => s + r.levers, 0);

  // Geschätzte Restzeit: sobald genug Fortschritt da ist, aus
  // elapsed/Fortschritt hochrechnen (passt sich selbst an), sonst grobe
  // Schätzung (~50 s/Seite + Overhead). Immer als "ca." gekennzeichnet.
  let estLabel: string;
  if (done || pct >= 99) {
    estLabel = "fast fertig …";
  } else {
    const fallback = total * 50 + 30;
    const estTotal = pct >= 8 && elapsed >= 4 ? elapsed / (pct / 100) : fallback;
    const remaining = Math.max(10, Math.round(estTotal - elapsed));
    estLabel =
      remaining > 90
        ? `noch ca. ${Math.ceil(remaining / 60)} Min`
        : `noch ca. ${Math.ceil(remaining / 15) * 15} Sek`;
  }

  return (
    <div className="hero hero--deep">
      <HeroWall />
      <div className="hero-scrim hero-scrim--radial" aria-hidden="true" />
      <div className="hero-scrim hero-scrim--vert" aria-hidden="true" />
      <div className="hero-deep-veil" aria-hidden="true" />

      <div className="flow-screens">
        <div className="aload">
          <div className="aload-inner">
            <div className="aload-intro">
              <h2 className="aload-headline2">
                Ich durchlaufe jetzt deinen Shop und finde die wichtigsten
                Optimierungen — priorisiert nach Umsatz-Effekt und
                Änderungsaufwand.
              </h2>
            </div>

            <div className="aload-progress">
              <p className="aload-url">{ctx.url}</p>
              <div className={`aload-bar ${done ? "" : "is-busy"}`}>
                <div className="aload-bar-fill" style={{ width: `${pct}%` }} />
              </div>
              <p className="aload-count">
                {done ? null : <Loader2 size={14} className="spin" />}
                {doneCount} von {total} Seiten gelesen · {estLabel}
              </p>
            </div>

            <div className="aload-lead">
              <div className="aload-finds-head">
                <span className="aload-finds-label">
                  Gefundene Optimierungen
                </span>
                <span className="aload-finds-total">{foundTotal}</span>
              </div>
              <div className="aload-finds-list">
                {rows.map((r) => (
                  <div
                    key={r.id}
                    className={`aload-find ${
                      r.state === "pending"
                        ? "is-pending"
                        : r.state === "running"
                          ? "is-running"
                          : ""
                    }`}
                  >
                    <span className="aload-find-l">
                      {r.state === "done" ? (
                        <Check size={15} aria-hidden="true" />
                      ) : r.state === "running" ? (
                        <Loader2 size={15} className="spin" aria-hidden="true" />
                      ) : (
                        <span className="aload-find-dot" aria-hidden="true" />
                      )}
                      {r.label}
                    </span>
                    <span className="aload-find-v">
                      {r.state === "done"
                        ? `${r.levers} Hebel`
                        : r.state === "running"
                          ? "läuft …"
                          : ""}
                    </span>
                  </div>
                ))}
              </div>

              <div className="aload-lead-divider" aria-hidden="true" />

              {mailState === "done" ? (
                <p className="aload-mail-ok">
                  <Check size={18} aria-hidden="true" />
                  <span>
                    Passt — sobald dein Report fertig ist, schicken wir ihn an{" "}
                    <strong>{sentTo}</strong>.
                  </span>
                </p>
              ) : (
                <>
                  <div className="aload-mailhead-row">
                    <span className="aload-timer">
                      <Clock size={16} aria-hidden="true" />
                      {mm}:{ss}
                    </span>
                    <p className="aload-mailhead">
                      Dauert bis zu 15&nbsp;Min — lass dir das Ergebnis schicken
                    </p>
                  </div>
                  <form className="aload-mailrow" onSubmit={submitEmail}>
                    <input
                      className="aload-input"
                      type="text"
                      inputMode="email"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      placeholder="deine@mail.de"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (mailErr) setMailErr("");
                      }}
                      aria-label="E-Mail-Adresse"
                    />
                    <button
                      className="aload-send"
                      type="submit"
                      disabled={mailState === "sending"}
                    >
                      {mailState === "sending" ? "Sende …" : "Zuschicken"}
                    </button>
                  </form>
                  {mailErr ? (
                    <p className="aload-mail-err">{mailErr}</p>
                  ) : (
                    <p className="aload-microcopy">
                      Du musst nicht warten — sobald dein persönlicher Report
                      fertig ist, landet er direkt in deinem Postfach.
                    </p>
                  )}
                </>
              )}
            </div>

            <BotJourney />
          </div>
        </div>
      </div>
    </div>
  );
}

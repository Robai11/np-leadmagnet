"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowLeft,
  Smartphone,
  Monitor,
  Eye,
  Lock,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { impactVar } from "@/styles/tokens";
import { INDUSTRIES, CHANNELS } from "@/lib/mock-data";
import type { AnalysisContext, PageType } from "@/lib/types";

const PAGE_ORDER: PageType[] = ["home", "plp", "pdp", "cart", "checkout"];
const PAGE_LABELS: Record<PageType, string> = {
  home: "Startseite",
  plp: "Produktlisting-Page",
  pdp: "Produktseite",
  cart: "Warenkorb",
  checkout: "Checkout",
};
const PAGE_PLACEHOLDERS: Record<PageType, string> = {
  home: "https://dein-shop.de",
  plp: "https://dein-shop.de/kategorie/…",
  pdp: "https://dein-shop.de/produkt/…",
  cart: "leer lassen — automatisch über Produktseite erreichbar",
  checkout: "leer lassen — automatisch über Produktseite erreichbar",
};

type DiscoverResult = {
  home?: string;
  plp?: string | null;
  pdp?: string | null;
  method?: string;
  error?: string;
};

function looksLikeUrl(s: string) {
  return s.trim().length > 4 && /[a-z0-9-]+\.[a-z]{2,}/i.test(s.trim());
}

export function InputStage({
  onStart,
}: {
  onStart: (ctx: AnalysisContext) => void;
}) {
  // ── Shared state ────────────────────────────────────────────────────
  const [step, setStep] = useState<1 | 2>(1);
  const [industry, setIndustry] = useState("");
  const [device, setDevice] = useState(60);
  const [channels, setChannels] = useState<string[]>([]);

  // ── Step 1 state ─────────────────────────────────────────────────────
  const [shopUrl, setShopUrl] = useState("");
  const [discovering, setDiscovering] = useState(false);
  const [discoverResult, setDiscoverResult] = useState<DiscoverResult | null>(
    null,
  );
  // When user clicks "Weiter" while discovery is still running, we queue it.
  const [pendingStep2, setPendingStep2] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // ── Step 2 state ─────────────────────────────────────────────────────
  const [pageUrls, setPageUrls] = useState<Record<PageType, string>>({
    home: "",
    plp: "",
    pdp: "",
    cart: "",
    checkout: "",
  });
  const [pageSelected, setPageSelected] = useState<Record<PageType, boolean>>({
    home: true,
    plp: true,
    pdp: true,
    cart: true,
    checkout: true,
  });

  // ── Auto-discovery ──────────────────────────────────────────────────
  const runDiscover = async (raw: string) => {
    if (!looksLikeUrl(raw)) return;
    setDiscovering(true);
    setDiscoverResult(null);
    try {
      const res = await fetch("/api/discover", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: raw }),
      });
      const data = (await res.json()) as DiscoverResult;
      setDiscoverResult(data);
    } catch {
      setDiscoverResult({ error: "Verbindungsfehler" });
    } finally {
      setDiscovering(false);
    }
  };

  const onUrlChange = (value: string) => {
    setShopUrl(value);
    setDiscoverResult(null);
    clearTimeout(debounceRef.current);
    if (looksLikeUrl(value)) {
      debounceRef.current = setTimeout(() => runDiscover(value), 700);
    }
  };

  // When discovery finishes and the user already clicked "Weiter", proceed.
  useEffect(() => {
    if (pendingStep2 && !discovering) {
      proceedToStep2();
      setPendingStep2(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discovering, pendingStep2]);

  const proceedToStep2 = () => {
    const r = discoverResult;
    const homeUrl = r?.home ?? (shopUrl.trim().startsWith("http") ? shopUrl.trim() : `https://${shopUrl.trim()}`);
    setPageUrls({
      home: homeUrl,
      plp: r?.plp ?? "",
      pdp: r?.pdp ?? "",
      cart: "",
      checkout: "",
    });
    setPageSelected({
      home: true,
      plp: Boolean(r?.plp),
      pdp: Boolean(r?.pdp),
      cart: Boolean(r?.pdp),
      checkout: Boolean(r?.pdp),
    });
    setStep(2);
  };

  const goToStep2 = () => {
    if (discovering) {
      // Discovery is already running — queue the transition.
      setPendingStep2(true);
    } else if (!discoverResult && looksLikeUrl(shopUrl)) {
      // URL is valid but the 700 ms debounce hasn't fired yet (user clicked
      // Weiter quickly). Cancel the debounce and start discovery immediately,
      // then queue the transition so it waits for the result.
      clearTimeout(debounceRef.current);
      void runDiscover(shopUrl); // sets discovering=true synchronously (before first await)
      setPendingStep2(true);     // batched with the above → useEffect won't fire early
    } else {
      proceedToStep2();
    }
  };

  // ── Validation ──────────────────────────────────────────────────────
  const step1Valid =
    looksLikeUrl(shopUrl) && !!industry && channels.length > 0;
  const step1Busy = pendingStep2; // waiting for discovery to finish

  // Step 2: each selected non-cart/checkout page needs a URL, or a PDP for cart/checkout.
  const pdpReady = pageSelected.pdp && pageUrls.pdp.trim().length > 3;
  const pageRowOk = (t: PageType): boolean => {
    if (!pageSelected[t]) return true;
    if (t === "cart" || t === "checkout") return pdpReady;
    return pageUrls[t].trim().length > 3;
  };
  const anySelected = PAGE_ORDER.some((t) => pageSelected[t]);
  const step2Valid = anySelected && PAGE_ORDER.every(pageRowOk);

  const submit = () => {
    onStart({
      url: pageUrls.home || shopUrl.trim(),
      industry,
      device,
      channels,
      targets: PAGE_ORDER.map((t) => ({
        type: t,
        url: pageUrls[t].trim(),
        selected: pageSelected[t],
      })),
    });
  };

  const toggleChannel = (c: string) =>
    setChannels((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]));

  // ── Discovery status indicator (shown in Step 1 URL field) ───────────
  const discoveryStatus = discovering ? "running" : discoverResult?.error ? "error" : discoverResult ? "done" : null;

  // ── Step 1 ───────────────────────────────────────────────────────────
  if (step === 1) {
    return (
      <div className="stage input-stage">
        <div className="input-left">
          <span className="kicker">CRO-Analyse · kostenlos</span>
          <h1>
            Wo dein Shop <span className="hl">Conversion verliert</span> — in 60
            Sekunden sichtbar.
          </h1>
          <p className="lede">
            Wir scannen deinen kompletten Funnel — Startseite, Kategorie,
            Produktseite, Warenkorb und Checkout — und markieren die größten
            Conversion-Hebel direkt auf deinen Seiten.
          </p>

          {/* URL + live discovery status */}
          <div className="field">
            <label>Shop-URL</label>
            <div className="url-wrap">
              <input
                className="url-input"
                type="url"
                placeholder="https://dein-shop.de"
                value={shopUrl}
                onChange={(e) => onUrlChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && step1Valid && !discovering)
                    goToStep2();
                }}
              />
              {discoveryStatus === "running" && (
                <span className="url-status discovering">
                  <Loader2 size={14} className="spin" /> Seiten werden erkannt …
                </span>
              )}
              {discoveryStatus === "done" && (
                <span className="url-status ok">
                  <CheckCircle2 size={13} />
                  {[
                    discoverResult?.home && "Startseite",
                    discoverResult?.plp && "Kategorie",
                    discoverResult?.pdp && "Produkt",
                  ]
                    .filter(Boolean)
                    .join(", ")}{" "}
                  erkannt
                </span>
              )}
              {discoveryStatus === "error" && (
                <span className="url-status err">
                  <AlertCircle size={13} /> Seiten nicht erkannt — im nächsten
                  Schritt manuell eintippen
                </span>
              )}
            </div>
          </div>

          {/* Industry */}
          <div className="field">
            <label>
              Branche <em>· präzisiert die Analyse</em>
            </label>
            <div className="chips">
              {INDUSTRIES.map((i) => (
                <button
                  key={i}
                  className={`chip ${industry === i ? "on" : ""}`}
                  onClick={() => setIndustry(i)}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>

          {/* Traffic split */}
          <div className="field">
            <label>Traffic-Verteilung</label>
            <div className="device">
              <Smartphone size={16} />
              <input
                type="range"
                min={0}
                max={100}
                value={100 - device}
                onChange={(e) => setDevice(100 - Number(e.target.value))}
              />
              <Monitor size={16} />
            </div>
            <div className="device-lbl">
              <span>{device}% Mobile</span>
              <span>{100 - device}% Desktop</span>
            </div>
          </div>

          {/* Channels */}
          <div className="field">
            <label>
              Wichtigste Traffic-Kanäle <em>· Mehrfachauswahl</em>
            </label>
            <div className="chips">
              {CHANNELS.map((c) => (
                <button
                  key={c}
                  className={`chip ${channels.includes(c) ? "on" : ""}`}
                  onClick={() => toggleChannel(c)}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <button
            className="cta"
            disabled={!step1Valid || step1Busy}
            onClick={goToStep2}
          >
            {step1Busy ? (
              <>
                <Loader2 size={16} className="spin" /> Seiten werden erkannt …
              </>
            ) : (
              <>
                Weiter <ArrowRight size={18} />
              </>
            )}
          </button>
          {!step1Valid && (
            <span className="hint">
              Shop-URL, Branche und mindestens ein Kanal werden benötigt.
            </span>
          )}
        </div>

        <div className="input-right">
          <div className="preview-label">
            <Eye size={14} /> So sieht deine Analyse aus
          </div>
          <div className="preview">
            <div className="prev-shot">
              <div
                className="prev-pin"
                style={{
                  left: "62%",
                  top: "30%",
                  background: impactVar("high"),
                }}
              >
                1
              </div>
              <div
                className="prev-pin"
                style={{
                  left: "70%",
                  top: "66%",
                  background: impactVar("mid"),
                }}
              >
                2
              </div>
              <div className="prev-bars">
                <span />
                <span />
                <span />
              </div>
            </div>
            <div className="prev-cards">
              <div />
              <div />
              <div className="prev-lock">
                <Lock size={12} />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Step 2 ───────────────────────────────────────────────────────────
  return (
    <div className="stage step2-stage">
      <div className="step2-head">
        <button className="step2-back" onClick={() => setStep(1)}>
          <ArrowLeft size={15} /> Zurück
        </button>
        <span className="step2-progress">Schritt 2 · Seiten bestätigen</span>
      </div>

      <h2 className="step2-title">Stimmen diese URLs?</h2>
      <p className="step2-sub">
        {discoverResult && !discoverResult.error
          ? "Wir haben die Seiten deines Shops automatisch erkannt. Überprüf die URLs und korrigiere sie bei Bedarf."
          : "Die Seiten konnten nicht automatisch erkannt werden. Trage die URLs deines Shops manuell ein."}
      </p>

      <div className="step2-rows">
        {PAGE_ORDER.map((t) => {
          const isStateful = t === "cart" || t === "checkout";
          return (
            <div
              key={t}
              className={`step2-row ${pageSelected[t] ? "on" : "off"}`}
            >
              <label className="step2-check">
                <input
                  type="checkbox"
                  checked={pageSelected[t]}
                  onChange={() =>
                    setPageSelected((p) => ({ ...p, [t]: !p[t] }))
                  }
                />
                <span className="step2-label">{PAGE_LABELS[t]}</span>
                {isStateful && pageSelected[t] && (
                  <span className="step2-badge">automatisch über Produkt</span>
                )}
              </label>
              {!isStateful && (
                <input
                  className={`step2-url ${!pageSelected[t] ? "disabled" : ""}`}
                  type="url"
                  placeholder={PAGE_PLACEHOLDERS[t]}
                  value={pageUrls[t]}
                  disabled={!pageSelected[t]}
                  onChange={(e) =>
                    setPageUrls((p) => ({ ...p, [t]: e.target.value }))
                  }
                />
              )}
              {isStateful && (
                <input
                  className={`step2-url ${!pageSelected[t] ? "disabled" : ""} muted`}
                  type="url"
                  placeholder={PAGE_PLACEHOLDERS[t]}
                  value={pageUrls[t]}
                  disabled={!pageSelected[t]}
                  onChange={(e) =>
                    setPageUrls((p) => ({ ...p, [t]: e.target.value }))
                  }
                />
              )}
            </div>
          );
        })}
      </div>

      {!step2Valid && anySelected && (
        <p className="hint" style={{ marginTop: 4 }}>
          {!pdpReady && (pageSelected.cart || pageSelected.checkout)
            ? "Warenkorb und Checkout benötigen eine Produktseiten-URL."
            : "Bitte trage für alle ausgewählten Seiten eine URL ein."}
        </p>
      )}

      <div className="step2-actions">
        <button className="cta" disabled={!step2Valid} onClick={submit}>
          Funnel-Analyse starten <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}

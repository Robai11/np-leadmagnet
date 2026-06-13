"use client";

import { useRef, useState } from "react";
import {
  ArrowRight,
  ArrowLeft,
  Smartphone,
  Monitor,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { INDUSTRIES, CHANNELS } from "@/lib/mock-data";
import { Hero } from "@/components/Hero";
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
  const [busy, setBusy] = useState(false); // submit pending (waiting on discovery)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Handle to an in-flight discovery so a submit can await it (no effect needed).
  const discoverPromiseRef = useRef<Promise<DiscoverResult | null> | null>(null);

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

  // ── Auto-discovery (returns the result so a submit can await it) ─────
  const runDiscover = async (raw: string): Promise<DiscoverResult | null> => {
    if (!looksLikeUrl(raw)) return null;
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
      return data;
    } catch {
      const err: DiscoverResult = { error: "Verbindungsfehler" };
      setDiscoverResult(err);
      return err;
    } finally {
      setDiscovering(false);
    }
  };

  const onUrlChange = (value: string) => {
    setShopUrl(value);
    setDiscoverResult(null);
    clearTimeout(debounceRef.current);
    if (looksLikeUrl(value)) {
      debounceRef.current = setTimeout(() => {
        discoverPromiseRef.current = runDiscover(value);
      }, 700);
    }
  };

  const proceedToStep2 = (r: DiscoverResult | null) => {
    const homeUrl =
      r?.home ??
      (shopUrl.trim().startsWith("http")
        ? shopUrl.trim()
        : `https://${shopUrl.trim()}`);
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

  // Submit from the hero: ensure discovery for the current URL has resolved
  // (awaiting an in-flight run or starting a fresh one), then advance.
  const goToStep2 = async () => {
    if (!looksLikeUrl(shopUrl) || busy) return;
    let r = discoverResult;
    if (!r) {
      setBusy(true);
      let p: Promise<DiscoverResult | null>;
      if (discovering && discoverPromiseRef.current) {
        p = discoverPromiseRef.current; // await the run already in flight
      } else {
        clearTimeout(debounceRef.current);
        p = runDiscover(shopUrl);
        discoverPromiseRef.current = p;
      }
      r = await p;
      setBusy(false);
    }
    proceedToStep2(r);
  };

  // ── Step 2 validation ───────────────────────────────────────────────
  const pdpReady = pageSelected.pdp && pageUrls.pdp.trim().length > 3;
  const pageRowOk = (t: PageType): boolean => {
    if (!pageSelected[t]) return true;
    if (t === "cart" || t === "checkout") return pdpReady;
    return pageUrls[t].trim().length > 3;
  };
  const anySelected = PAGE_ORDER.some((t) => pageSelected[t]);
  const step2Valid =
    anySelected &&
    PAGE_ORDER.every(pageRowOk) &&
    !!industry &&
    channels.length > 0;

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

  // ── Step 1 — cinematic Hero (nur URL + Analysieren) ──────────────────
  if (step === 1) {
    const heroStatus = discovering ? (
      <>
        <Loader2 size={14} className="spin" /> Seiten werden erkannt …
      </>
    ) : discoverResult?.error ? (
      <span className="err">
        <AlertCircle size={13} /> Seiten nicht automatisch erkannt — im nächsten
        Schritt eintragbar
      </span>
    ) : discoverResult ? (
      <span className="ok">
        <CheckCircle2 size={13} />{" "}
        {[
          discoverResult.home && "Startseite",
          discoverResult.plp && "Kategorie",
          discoverResult.pdp && "Produkt",
        ]
          .filter(Boolean)
          .join(", ")}{" "}
        erkannt
      </span>
    ) : null;

    return (
      <Hero
        value={shopUrl}
        onChange={onUrlChange}
        onSubmit={goToStep2}
        busy={busy}
        status={heroStatus}
      />
    );
  }

  // ── Step 2 — Kontext + Seiten bestätigen ─────────────────────────────
  return (
    <div className="stage step2-stage">
      <div className="step2-head">
        <button className="step2-back" onClick={() => setStep(1)}>
          <ArrowLeft size={15} /> Zurück
        </button>
        <span className="step2-progress">Schritt 2 · Kontext &amp; Seiten</span>
      </div>

      {/* Kontext */}
      <h2 className="step2-title">Kontext deiner Analyse</h2>
      <p className="step2-sub">
        Branche, Traffic-Verteilung und Kanäle präzisieren die Empfehlungen.
      </p>

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

      {/* Seiten bestätigen */}
      <h2 className="step2-title" style={{ marginTop: 32 }}>
        Stimmen diese URLs?
      </h2>
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
              <input
                className={`step2-url ${!pageSelected[t] ? "disabled" : ""} ${isStateful ? "muted" : ""}`}
                type="url"
                placeholder={PAGE_PLACEHOLDERS[t]}
                value={pageUrls[t]}
                disabled={!pageSelected[t]}
                onChange={(e) =>
                  setPageUrls((p) => ({ ...p, [t]: e.target.value }))
                }
              />
            </div>
          );
        })}
      </div>

      {!step2Valid && anySelected && (
        <p className="hint" style={{ marginTop: 4 }}>
          {!industry || channels.length === 0
            ? "Bitte Branche und mindestens einen Kanal wählen."
            : !pdpReady && (pageSelected.cart || pageSelected.checkout)
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

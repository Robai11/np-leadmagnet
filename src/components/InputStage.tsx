"use client";

import { useCallback, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowLeft,
  Smartphone,
  Monitor,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Lightbulb,
  Search,
  Check,
  Info,
} from "lucide-react";
import { INDUSTRIES, CHANNELS } from "@/lib/mock-data";
import { Hero } from "@/components/Hero";
import { HeroWall } from "@/components/HeroWall";
import { Wireframe } from "@/components/Wireframes";
import { OverviewStep } from "@/components/OverviewStep";
import type { AnalysisContext, PageType } from "@/lib/types";

const PAGE_ORDER: PageType[] = ["home", "plp", "pdp", "cart", "checkout"];

// Geführte Schritte NACH der Landingpage (Step 1): Ablauf-Übersicht zuerst,
// dann die Seiten-Prüfung und der Kontext.
type FunnelStep =
  | "overview"
  | "home"
  | "plp"
  | "pdp"
  | "cartcheckout"
  | "context";
const FUNNEL_STEPS: FunnelStep[] = [
  "overview",
  "home",
  "plp",
  "pdp",
  "cartcheckout",
  "context",
];
const TOTAL_STEPS = 1 + FUNNEL_STEPS.length; // Landing + 6

// URL-Schritte: Label, Funnel-Position, Platzhalter, Hinweis und (für PLP/PDP)
// ein Beispiel-Hinweis, damit klar ist, dass EINE repräsentative Seite genügt.
const PAGE_STEP: Record<
  "home" | "plp" | "pdp",
  {
    label: string;
    kicker: string;
    placeholder: string;
    hint: string;
    example?: string;
  }
> = {
  home: {
    label: "Startseite",
    kicker: "Seite 1 von 5",
    placeholder: "https://dein-shop.de",
    hint: "Erster Eindruck, Wertversprechen, Navigation und Vertrauen — hier entscheidet sich, ob Besucher überhaupt bleiben.",
  },
  plp: {
    label: "Product Listing Page",
    kicker: "Seite 2 von 5",
    placeholder: "https://dein-shop.de/kategorie/…",
    hint: "Sortierung, Filter und Produktkacheln — hier finden Nutzer das passende Produkt. Oder eben nicht.",
    example:
      "Nur ein Beispiel: Eine repräsentative Kategorieseite genügt — du musst nicht alle eintragen.",
  },
  pdp: {
    label: "Produktdetailseite",
    kicker: "Seite 3 von 5",
    placeholder: "https://dein-shop.de/produkt/…",
    hint: "Produktbilder, Preis, Call-to-Action und Trust-Elemente — die wichtigste Conversion-Seite im Funnel.",
    example:
      "Nur ein Beispiel: Eine repräsentative Produktseite genügt — du musst nicht alle eintragen.",
  },
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
  // ── Flow ────────────────────────────────────────────────────────────
  const [step, setStep] = useState(1); // 1 = Landing, 2..7 = geführte Schritte
  const [industry, setIndustry] = useState("");
  const [device, setDevice] = useState(60);
  const [channels, setChannels] = useState<string[]>([]);

  // ── Step 1 / Discovery ──────────────────────────────────────────────
  const [shopUrl, setShopUrl] = useState("");
  const [discovering, setDiscovering] = useState(false);
  const [discoverResult, setDiscoverResult] = useState<DiscoverResult | null>(
    null,
  );
  const [transitioning, setTransitioning] = useState(false); // Vorhang-Übergang Landing→Wizard
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const discoverPromiseRef = useRef<Promise<DiscoverResult | null> | null>(
    null,
  );
  const transTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  // ── URLs der Seitentypen ────────────────────────────────────────────
  const [pageUrls, setPageUrls] = useState<Record<PageType, string>>({
    home: "",
    plp: "",
    pdp: "",
    cart: "",
    checkout: "",
  });
  // Bestätigung "URL geprüft" je Seitentyp (gate für Weiter).
  const [checkedPages, setCheckedPages] = useState<Record<string, boolean>>({
    home: false,
    plp: false,
    pdp: false,
  });

  // ── Auto-Discovery ──────────────────────────────────────────────────
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

  // Erkannte URLs NACHFÜLLEN — nur leere Felder, damit bereits Getipptes nicht
  // überschrieben wird (Discovery läuft jetzt im Hintergrund).
  const applyDiscovery = (r: DiscoverResult | null) => {
    const homeUrl =
      r?.home ??
      (shopUrl.trim().startsWith("http")
        ? shopUrl.trim()
        : `https://${shopUrl.trim()}`);
    setPageUrls((prev) => ({
      ...prev,
      home: prev.home || homeUrl,
      plp: prev.plp || (r?.plp ?? ""),
      pdp: prev.pdp || (r?.pdp ?? ""),
    }));
  };

  // Landing → SOFORT in die Übersicht eintauchen. Die Seiten-Erkennung läuft im
  // Hintergrund weiter und füllt die URL-Felder nach, sobald sie da ist.
  const startFunnel = () => {
    if (!looksLikeUrl(shopUrl) || transitioning) return;
    if (discoverResult) {
      applyDiscovery(discoverResult);
    } else if (discovering && discoverPromiseRef.current) {
      void discoverPromiseRef.current.then((r) => applyDiscovery(r));
    } else {
      clearTimeout(debounceRef.current);
      const p = runDiscover(shopUrl);
      discoverPromiseRef.current = p;
      void p.then((r) => applyDiscovery(r));
    }
    // Vorhang-Übergang: Wand öffnen + Box abtauchen, dann Übersicht mounten.
    setTransitioning(true);
    clearTimeout(transTimerRef.current);
    transTimerRef.current = setTimeout(() => {
      setStep(2);
      setTransitioning(false);
    }, 760);
  };

  // Zurück: das Scan-Interstitial (Schritt 2) überspringen, sonst springt es
  // sofort wieder automatisch vorwärts.
  const goBack = () => setStep((s) => (s - 1 === 2 ? 1 : Math.max(1, s - 1)));
  const goNext = () => setStep((s) => Math.min(TOTAL_STEPS, s + 1));

  const submit = () => {
    onStart({
      url: pageUrls.home || shopUrl.trim(),
      industry,
      device,
      channels,
      targets: PAGE_ORDER.map((t) => ({
        type: t,
        url: pageUrls[t].trim(),
        selected: true,
      })),
    });
  };

  const toggleChannel = (c: string) =>
    setChannels((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]));

  // Fokussiert das URL-Feld beim Schritt-Wechsel OHNE den (durch die große Wand)
  // scrollbaren Hero-Container zu verschieben — sonst rutscht die Top-Bar raus.
  const focusNoScroll = useCallback((el: HTMLInputElement | null) => {
    if (el) el.focus({ preventScroll: true });
  }, []);

  // ── Step 1 — cinematic Hero ─────────────────────────────────────────
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

  // ── Inhalt der geführten Schritte (2..6) ────────────────────────────
  const funnel = FUNNEL_STEPS[step - 2]; // undefined bei step === 1

  const renderUrlStep = (type: "home" | "plp" | "pdp") => {
    const meta = PAGE_STEP[type];
    const urlValid = pageUrls[type].trim().length > 3;
    const confirmed = checkedPages[type];
    const detected = Boolean(
      type === "home" ? discoverResult?.home : discoverResult?.[type],
    );
    return (
      <>
        <h2 className="fstep-tophead">
          Hilf mir schnell, die richtigen URLs zu finden
        </h2>
        <div className="fstep-body">
          <div className="fstep-main">
            <span className="fstep-kicker">{meta.kicker}</span>
            <h3 className="fstep-title">{meta.label}</h3>
            <p className="fstep-hint">{meta.hint}</p>

          <div className="fstep-field">
            <p className="fstep-check-label">
              <Search size={17} aria-hidden="true" /> URL prüfen oder
              korrigieren
              {detected ? (
                <span className="fstep-detected">
                  <CheckCircle2 size={12} /> automatisch erkannt
                </span>
              ) : discovering ? (
                <span className="fstep-detecting">
                  <Loader2 size={12} className="spin" /> wird erkannt …
                </span>
              ) : null}
            </p>

            {meta.example && (
              <p className="fstep-example">
                <Info size={14} aria-hidden="true" /> {meta.example}
              </p>
            )}

            <input
              type="url"
              inputMode="url"
              placeholder={meta.placeholder}
              value={pageUrls[type]}
              onChange={(e) => {
                const v = e.target.value;
                setPageUrls((p) => ({ ...p, [type]: v }));
                setCheckedPages((p) => ({ ...p, [type]: false }));
              }}
              ref={focusNoScroll}
            />
            {!urlValid && (
              <p className="fstep-warn">
                <AlertCircle size={13} /> Bitte trage die URL dieser Seite ein.
              </p>
            )}

            <label className={`fstep-confirm ${confirmed ? "on" : ""}`}>
              <input
                type="checkbox"
                checked={confirmed}
                disabled={!urlValid}
                onChange={() =>
                  setCheckedPages((p) => ({ ...p, [type]: !p[type] }))
                }
              />
              <span className="fstep-confirm-box" aria-hidden="true">
                <Check size={13} />
              </span>
              Ich habe die URL geprüft
            </label>
          </div>

          <div className="fstep-actions">
            <button
              className="cta"
              disabled={!urlValid || !confirmed}
              onClick={goNext}
            >
              Weiter <ArrowRight size={18} />
            </button>
          </div>
        </div>

          <div className="fstep-aside">
            <Wireframe type={type} />
          </div>
        </div>
      </>
    );
  };

  const renderCartCheckout = () => (
    <div className="fstep-body">
      <div className="fstep-main">
        <span className="fstep-kicker">Seite 4 &amp; 5 von 5</span>
        <h2 className="fstep-title">Warenkorb &amp; Checkout</h2>
        <p className="fstep-hint">
          Warenkorb-Transparenz und Checkout-Reibung — hier passieren die
          meisten Abbrüche. Genau diese beiden Schritte schaut sich die Analyse
          besonders genau an.
        </p>
        <p className="fstep-auto">
          <CheckCircle2 size={15} /> Kein Link nötig: Die KI legt ein Produkt in
          den Warenkorb und durchläuft den Checkout automatisch über deine
          Produktseite.
        </p>
        <div className="fstep-actions">
          <button className="cta" onClick={goNext}>
            Weiter <ArrowRight size={18} />
          </button>
        </div>
      </div>

      <div className="fstep-aside fstep-aside--duo">
        <Wireframe type="cart" />
        <Wireframe type="checkout" />
      </div>
    </div>
  );

  const renderContext = () => {
    const valid = !!industry && channels.length > 0;
    return (
      <div className="fstep-body">
        <div className="fstep-main fstep-main--wide">
          <span className="fstep-kicker">Letzter Schritt</span>
          <h2 className="fstep-title">Kontext deiner Analyse</h2>
          <p className="fstep-hint">
            Branche, Traffic-Verteilung und Kanäle schärfen die Empfehlungen für
            deinen Shop.
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

          {!valid && (
            <p className="fstep-warn">
              <AlertCircle size={13} /> Bitte Branche und mindestens einen Kanal
              wählen.
            </p>
          )}

          <div className="fstep-actions">
            <button className="cta" disabled={!valid} onClick={submit}>
              Funnel-Analyse starten <ArrowRight size={18} />
            </button>
          </div>
        </div>

        <div className="fstep-aside">
          <div className="fstep-recap">
            <h3>
              <Lightbulb size={15} /> Das wird analysiert
            </h3>
            <ul>
              <li>
                <span className="recap-row">
                  <span className="hero-dot" /> Startseite
                </span>
                <em>{pageUrls.home || "—"}</em>
              </li>
              <li>
                <span className="recap-row">
                  <span className="hero-dot" /> Product Listing Page
                </span>
                <em>{pageUrls.plp || "—"}</em>
              </li>
              <li>
                <span className="recap-row">
                  <span className="hero-dot" /> Produktdetailseite
                </span>
                <em>{pageUrls.pdp || "—"}</em>
              </li>
              <li>
                <span className="recap-row">
                  <span className="hero-dot" /> Warenkorb
                </span>
                <em>automatisch</em>
              </li>
              <li>
                <span className="recap-row">
                  <span className="hero-dot" /> Checkout
                </span>
                <em>automatisch</em>
              </li>
            </ul>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`hero ${step > 1 || transitioning ? "hero--deep" : ""}`}>
      {/* Persistente Screenshot-Wand (ab Schritt 2 abgedunkelt + unscharf) */}
      <HeroWall />
      <div className="hero-scrim hero-scrim--radial" aria-hidden="true" />
      <div className="hero-scrim hero-scrim--vert" aria-hidden="true" />
      <div className="hero-deep-veil" aria-hidden="true" />

      <div className="flow-screens">
        {step === 1 ? (
          <Hero
            key="hero"
            value={shopUrl}
            onChange={onUrlChange}
            onSubmit={startFunnel}
            busy={transitioning}
            status={heroStatus}
            leaving={transitioning}
            loading={discovering}
          />
        ) : (
          <div className="fstep" key={step}>
            <div className="fstep-bar">
              <button className="fstep-back" onClick={goBack}>
                <ArrowLeft size={16} /> Zurück
              </button>
              <span className="fstep-progress">
                Schritt {step} von {TOTAL_STEPS}
              </span>
            </div>

            {funnel === "overview" ? (
              <OverviewStep onNext={goNext} />
            ) : funnel === "cartcheckout" ? (
              renderCartCheckout()
            ) : funnel === "context" ? (
              renderContext()
            ) : (
              renderUrlStep(funnel as "home" | "plp" | "pdp")
            )}
          </div>
        )}
      </div>
    </div>
  );
}

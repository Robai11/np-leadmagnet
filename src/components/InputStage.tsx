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
} from "lucide-react";
import { INDUSTRIES, CHANNELS } from "@/lib/mock-data";
import { Hero } from "@/components/Hero";
import { HeroWall } from "@/components/HeroWall";
import { Wireframe } from "@/components/Wireframes";
import type { AnalysisContext, PageType } from "@/lib/types";

const PAGE_ORDER: PageType[] = ["home", "plp", "pdp", "cart", "checkout"];

// Geführte Schritte NACH der Landingpage (Step 1). Insgesamt also 6 Schritte.
type FunnelStep = "home" | "plp" | "pdp" | "cartcheckout" | "context";
const FUNNEL_STEPS: FunnelStep[] = [
  "home",
  "plp",
  "pdp",
  "cartcheckout",
  "context",
];
const TOTAL_STEPS = 1 + FUNNEL_STEPS.length; // Landing + 5

// URL-Schritte: Label, Funnel-Position, Platzhalter und Hinweistext.
const PAGE_STEP: Record<
  "home" | "plp" | "pdp",
  { label: string; kicker: string; placeholder: string; hint: string }
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
  },
  pdp: {
    label: "Produktdetailseite",
    kicker: "Seite 3 von 5",
    placeholder: "https://dein-shop.de/produkt/…",
    hint: "Produktbilder, Preis, Call-to-Action und Trust-Elemente — die wichtigste Conversion-Seite im Funnel.",
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
  const [step, setStep] = useState(1); // 1 = Landing, 2..6 = geführte Schritte
  const [industry, setIndustry] = useState("");
  const [device, setDevice] = useState(60);
  const [channels, setChannels] = useState<string[]>([]);

  // ── Step 1 / Discovery ──────────────────────────────────────────────
  const [shopUrl, setShopUrl] = useState("");
  const [discovering, setDiscovering] = useState(false);
  const [discoverResult, setDiscoverResult] = useState<DiscoverResult | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const discoverPromiseRef = useRef<Promise<DiscoverResult | null> | null>(
    null,
  );

  // ── URLs der Seitentypen ────────────────────────────────────────────
  const [pageUrls, setPageUrls] = useState<Record<PageType, string>>({
    home: "",
    plp: "",
    pdp: "",
    cart: "",
    checkout: "",
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

  const applyDiscovery = (r: DiscoverResult | null) => {
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
  };

  // Landing → erster geführter Schritt (Discovery abwarten / anstoßen).
  const startFunnel = async () => {
    if (!looksLikeUrl(shopUrl) || busy) return;
    let r = discoverResult;
    if (!r) {
      setBusy(true);
      let p: Promise<DiscoverResult | null>;
      if (discovering && discoverPromiseRef.current) {
        p = discoverPromiseRef.current;
      } else {
        clearTimeout(debounceRef.current);
        p = runDiscover(shopUrl);
        discoverPromiseRef.current = p;
      }
      r = await p;
      setBusy(false);
    }
    applyDiscovery(r);
    setStep(2);
  };

  const goBack = () => setStep((s) => Math.max(1, s - 1));
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
    const valid = pageUrls[type].trim().length > 3;
    const detected = Boolean(
      type === "home" ? discoverResult?.home : discoverResult?.[type],
    );
    return (
      <div className="fstep-body">
        <div className="fstep-main">
          <span className="fstep-kicker">{meta.kicker}</span>
          <h2 className="fstep-title">{meta.label}</h2>
          <p className="fstep-hint">{meta.hint}</p>

          <div className="fstep-field">
            <label>
              URL prüfen oder korrigieren
              {detected && (
                <span className="fstep-detected">
                  <CheckCircle2 size={12} /> automatisch erkannt
                </span>
              )}
            </label>
            <input
              type="url"
              inputMode="url"
              placeholder={meta.placeholder}
              value={pageUrls[type]}
              onChange={(e) =>
                setPageUrls((p) => ({ ...p, [type]: e.target.value }))
              }
              ref={focusNoScroll}
            />
            {!valid && (
              <p className="fstep-warn">
                <AlertCircle size={13} /> Bitte trage die URL dieser Seite ein.
              </p>
            )}
          </div>

          <div className="fstep-actions">
            <button className="cta" disabled={!valid} onClick={goNext}>
              Weiter <ArrowRight size={18} />
            </button>
          </div>
        </div>

        <div className="fstep-aside">
          <Wireframe type={type} />
        </div>
      </div>
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
    <div className={`hero ${step > 1 ? "hero--deep" : ""}`}>
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
            busy={busy}
            status={heroStatus}
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

            {funnel === "cartcheckout"
              ? renderCartCheckout()
              : funnel === "context"
                ? renderContext()
                : renderUrlStep(funnel as "home" | "plp" | "pdp")}
          </div>
        )}
      </div>
    </div>
  );
}

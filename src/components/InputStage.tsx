"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowLeft,
  Smartphone,
  Monitor,
  Loader2,
  CheckCircle2,
  AlertCircle,
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

// Kernzielgruppe — Alters-Schwerpunkte (Mehrfachauswahl).
const AGE_GROUPS = ["18–24", "25–34", "35–44", "45–54", "55+"];

// Geschlechter-Gewichtung (Slider) → kurzes Label für die Analyse.
function genderLabel(female: number): string {
  if (female >= 45 && female <= 55) return "ausgeglichen (w/m)";
  return female > 55
    ? `überwiegend weiblich (${female}%)`
    : `überwiegend männlich (${100 - female}%)`;
}

// Überbrückungstexte, während die Seiten erkannt werden (Button ausgegraut).
// Genau zwei Stufen, einmaliger Wechsel — kein Loop.
const WAIT_MSGS = ["Warte kurz …", "Gleich bereit …"];

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
      "Bitte trage eine einzige repräsentative Product Listing Page ein — du musst nicht alle eintragen.",
  },
  pdp: {
    label: "Produktdetailseite",
    kicker: "Seite 3 von 5",
    placeholder: "https://dein-shop.de/produkt/…",
    hint: "Produktbilder, Preis, Call-to-Action und Trust-Elemente — die wichtigste Conversion-Seite im Funnel.",
    example:
      "Bitte trage eine einzige repräsentative Produktdetailseite ein — du musst nicht alle eintragen.",
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
  // Kernzielgruppe + Herausforderungen (Step 7)
  const [ageGroups, setAgeGroups] = useState<string[]>([]);
  const [genderFemale, setGenderFemale] = useState(50);
  const [audienceTraits, setAudienceTraits] = useState("");
  const [challenges, setChallenges] = useState("");

  // ── Step 1 / Discovery ──────────────────────────────────────────────
  const [shopUrl, setShopUrl] = useState("");
  const [discovering, setDiscovering] = useState(false);
  const [discoverResult, setDiscoverResult] = useState<DiscoverResult | null>(
    null,
  );
  const [transitioning, setTransitioning] = useState(false); // Vorhang-Übergang Landing→Wizard
  const [waitIdx, setWaitIdx] = useState(0); // rotierender Button-Text während der Erkennung
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const discoverPromiseRef = useRef<Promise<DiscoverResult | null> | null>(
    null,
  );
  const transTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  // Button-Text einmal wechseln (Warte kurz → Gleich bereit), kein Loop.
  // Der Start-Index wird in runDiscover zurückgesetzt (vermeidet setState im Effect).
  useEffect(() => {
    if (!discovering) return;
    const t = setTimeout(() => setWaitIdx(1), 2200);
    return () => clearTimeout(t);
  }, [discovering]);

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
    setWaitIdx(0); // Button-Text bei jedem Lauf wieder bei "Warte kurz …" starten
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
      audienceAge: ageGroups.join(", ") || undefined,
      audienceGender: genderLabel(genderFemale),
      audienceTraits: audienceTraits.trim() || undefined,
      challenges: challenges.trim() || undefined,
    });
  };

  const toggleChannel = (c: string) =>
    setChannels((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]));
  const toggleAge = (g: string) =>
    setAgeGroups((p) => (p.includes(g) ? p.filter((x) => x !== g) : [...p, g]));

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
          Check bitte kurz, ob diese URL zum Seitentyp passt
        </h2>
        <div className="fstep-body">
          <div className="fstep-main">
            <span className="fstep-kicker">{meta.kicker}</span>
            <h3 className="fstep-title">{meta.label}</h3>
            <p className="fstep-hint">{meta.hint}</p>

          <div className="fstep-field">
            <p className="fstep-check-label">
              <Search size={17} aria-hidden="true" /> Ist diese URL richtig?
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
              Die URL ist richtig oder ich habe sie gleich korrigiert
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
      <div className="fstep-context">
        <h2 className="fstep-tophead fstep-tophead--ctx">
          Damit du hochspezifische Optimierungen erhältst, gib noch folgende
          Informationen an
        </h2>

        <div className="ctx-grid">
          {/* Spalte 1 — Shop-Kontext */}
          <div className="ctx-col">
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
          </div>

          {/* Spalte 2 — Kernzielgruppe + Herausforderungen */}
          <div className="ctx-col">
            <div className="field">
              <label>
                Kernzielgruppe — Alters-Schwerpunkt <em>· Mehrfachauswahl</em>
              </label>
              <div className="chips">
                {AGE_GROUPS.map((g) => (
                  <button
                    key={g}
                    className={`chip ${ageGroups.includes(g) ? "on" : ""}`}
                    onClick={() => toggleAge(g)}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <label>Geschlechter-Gewichtung</label>
              <div className="device">
                <span className="device-end">weiblich</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={100 - genderFemale}
                  onChange={(e) =>
                    setGenderFemale(100 - Number(e.target.value))
                  }
                />
                <span className="device-end">männlich</span>
              </div>
              <div className="device-lbl">
                <span>{genderFemale}% weiblich</span>
                <span>{100 - genderFemale}% männlich</span>
              </div>
            </div>

            <div className="field">
              <label>
                Merkmale der Zielgruppe <em>· optional</em>
              </label>
              <textarea
                className="ctx-textarea"
                rows={2}
                placeholder="z. B. preisbewusste Einkäufer, technikaffin, kauft Geschenke …"
                value={audienceTraits}
                onChange={(e) => setAudienceTraits(e.target.value)}
              />
            </div>

            <div className="field">
              <label>
                Aktuelle Shop-Herausforderungen <em>· optional</em>
              </label>
              <textarea
                className="ctx-textarea"
                rows={2}
                placeholder="z. B. viele Warenkorbabbrüche, schwache Mobile-Conversion, hohe Retouren …"
                value={challenges}
                onChange={(e) => setChallenges(e.target.value)}
              />
            </div>
          </div>
        </div>

        {!valid && (
          <p className="fstep-warn fstep-warn--center">
            <AlertCircle size={13} /> Bitte Branche und mindestens einen Kanal
            wählen.
          </p>
        )}

        <div className="fstep-actions fstep-actions--center">
          <button className="cta" disabled={!valid} onClick={submit}>
            Jetzt Optimierungen erhalten <ArrowRight size={18} />
          </button>
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
            loadingLabel={WAIT_MSGS[waitIdx]}
            ready={!discovering && !!discoverResult}
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

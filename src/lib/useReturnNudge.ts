"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* ════════════════════════════════════════════════════════════════════════
 * Rückhol-Bündel — holt den Nutzer zurück, wenn die mehrminütige Analyse
 * fertig ist. Zwei Signale, beide an die `done`-Transition des echten Streams
 * gekoppelt:
 *
 *   1) ein kurzer, dezenter Chime (Web Audio, im Code erzeugt — keine Datei),
 *   2) ein Hintergrund-Tab-Titel + Favicon-Punkt (nur wenn der Tab verdeckt
 *      ist; beim Zurückkehren wird der Original-Zustand wiederhergestellt).
 *
 * ── KONFIGURATION ──────────────────────────────────────────────────────
 * Dies ist die EINZIGE Stelle, an der Texte/Töne dieses Features leben.
 * Hier ändern, sonst nichts.
 * ════════════════════════════════════════════════════════════════════════ */

/** Original-Tab-Titel; wird beim Zurückkehren auf den Tab wiederhergestellt. */
export const BASE_TITLE = "ConversionScan";

/**
 * Hintergrund-Tab-Titel, sobald die Analyse fertig ist. Bei mehr als einem
 * Eintrag pendelt der Titel langsam zwischen den Texten (Aufmerksamkeit ohne
 * Hektik). Erster Eintrag wird zuerst gezeigt.
 */
export const DONE_TITLES = [
  "✅ Analyse fertig!",
  "Halt, komm zurück: Deine Analyse ist fertig",
] as const;

/** Pendel-Intervall zwischen den DONE_TITLES (ms). */
const TITLE_SWAP_MS = 1500;

/**
 * Der Chime: zwei kurze Sinus-Töne (aufsteigend) — bewusst leise und kurz.
 * `freq` in Hz, `at`/`dur` in Sekunden relativ zum Auslöse-Zeitpunkt.
 */
const CHIME_NOTES: { freq: number; at: number; dur: number }[] = [
  { freq: 880, at: 0, dur: 0.16 }, // A5
  { freq: 1318.5, at: 0.11, dur: 0.3 }, // E6
];
/** Spitzen-Lautstärke des Chimes (0..1) — dezent. */
const CHIME_GAIN = 0.12;

/** localStorage-Key für den Stummschalt-Zustand (überlebt Reloads). */
const MUTE_KEY = "cs:return-nudge:muted";

/* ──────────────────────────────────────────────────────────────────────── */

/** Liest einen Brand-Token-Wert zur Laufzeit (Token-Vertrag, kein Hex im Code). */
function readToken(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  try {
    const v = getComputedStyle(document.documentElement)
      .getPropertyValue(name)
      .trim();
    return v || fallback;
  } catch {
    return fallback;
  }
}

/** Baut ein Favicon (grüner Punkt auf dunklem Grund) aus den Brand-Tokens. */
function buildNudgeFavicon(): string {
  // Fallbacks spiegeln nur die Default-Werte aus tokens.css — Quelle bleibt der Token.
  const ink = readToken("--color-ink", "#13161d");
  const accent = readToken("--color-accent", "#c2e63a");
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">` +
    `<rect width="32" height="32" rx="7" fill="${ink}"/>` +
    `<circle cx="16" cy="16" r="6.5" fill="${accent}"/>` +
    `</svg>`;
  return "data:image/svg+xml," + encodeURIComponent(svg);
}

// Singleton-Zustand für das eine <link rel="icon"> im <head>.
const favicon: { original: string | null; nudge: string | null } = {
  original: null,
  nudge: null,
};

function setNudgeFavicon(on: boolean): void {
  if (typeof document === "undefined") return;
  let link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  if (favicon.original === null) {
    favicon.original = link.getAttribute("href") ?? "/favicon.ico";
  }
  if (on) {
    if (!favicon.nudge) favicon.nudge = buildNudgeFavicon();
    link.setAttribute("href", favicon.nudge);
  } else {
    link.setAttribute("href", favicon.original);
  }
}

export interface ReturnNudge {
  /**
   * Im Click-Handler von „Analyse starten" aufrufen: entsperrt Audio innerhalb
   * der Nutzergeste (Autoplay-Policy), damit der Chime später ohne Geste klingt.
   */
  arm: () => void;
  /** Stummschalt-Zustand des Chimes (für den Schalter in der Warte-UI). */
  muted: boolean;
  /** Schaltet den Chime stumm/laut und merkt sich das in localStorage. */
  toggleMuted: () => void;
}

/**
 * Beobachtet die `done`-Transition (false → true) und holt den Nutzer zurück.
 * Wird auf App-Ebene verwendet (bleibt über den Stufenwechsel hinweg gemountet,
 * während die LoadingStage beim Abschluss gegen die ReportStage getauscht wird).
 */
export function useReturnNudge(done: boolean): ReturnNudge {
  const ctxRef = useRef<AudioContext | null>(null);
  const firedRef = useRef(false);

  // Persistierten Stumm-Zustand direkt initial lesen. SSR-sicher (typeof
  // window) und ohne Hydration-Risiko: die Mute-abhängige UI erscheint erst
  // nach dem Start, nie im initial gerenderten idle-Zustand.
  const [muted, setMuted] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(MUTE_KEY) === "1";
    } catch {
      return false; // localStorage kann blockiert sein — Default (laut) ist ok.
    }
  });
  const mutedRef = useRef(muted);
  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  const toggleMuted = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      try {
        localStorage.setItem(MUTE_KEY, next ? "1" : "0");
      } catch {
        /* ignorieren */
      }
      return next;
    });
  }, []);

  const arm = useCallback(() => {
    try {
      if (!ctxRef.current) {
        const AC: typeof AudioContext | undefined =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (AC) ctxRef.current = new AC();
      }
      // resume() innerhalb der Geste „schärft" den Context für später.
      void ctxRef.current?.resume();
    } catch {
      /* Audio ist optional — niemals den Start blockieren. */
    }
  }, []);

  const playChime = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    try {
      void ctx.resume();
      const now = ctx.currentTime;
      for (const n of CHIME_NOTES) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = n.freq;
        const t0 = now + n.at;
        // weicher Ein-/Ausklang, damit es nicht klickt
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(CHIME_GAIN, t0 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + n.dur);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t0);
        osc.stop(t0 + n.dur + 0.02);
      }
    } catch {
      /* ignorieren */
    }
  }, []);

  // ── Chime: genau einmal pro Abschluss ────────────────────────────────
  useEffect(() => {
    if (!done) {
      firedRef.current = false; // für die nächste Analyse zurücksetzen
      return;
    }
    if (firedRef.current) return;
    firedRef.current = true;
    if (!mutedRef.current) playChime();
  }, [done, playChime]);

  // ── Tab-Titel + Favicon: nur solange der Tab im Hintergrund liegt ─────
  useEffect(() => {
    if (!done || typeof document === "undefined") return;

    let swap: ReturnType<typeof setInterval> | null = null;
    let idx = 0;

    const showNudge = () => {
      document.title = DONE_TITLES[0];
      setNudgeFavicon(true);
      if (swap || DONE_TITLES.length < 2) return;
      idx = 0;
      swap = setInterval(() => {
        idx = (idx + 1) % DONE_TITLES.length;
        document.title = DONE_TITLES[idx];
      }, TITLE_SWAP_MS);
    };

    const restore = () => {
      if (swap) {
        clearInterval(swap);
        swap = null;
      }
      document.title = BASE_TITLE;
      setNudgeFavicon(false);
    };

    const onVisibility = () => (document.hidden ? showNudge() : restore());

    // Beim Abschluss nur anstupsen, wenn der Tab gerade verdeckt ist —
    // der visibilitychange-Listener fängt späteres Weg-/Zurückwechseln ab.
    if (document.hidden) showNudge();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      restore();
    };
  }, [done]);

  return { arm, muted, toggleMuted };
}

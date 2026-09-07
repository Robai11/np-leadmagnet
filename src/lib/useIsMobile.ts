"use client";

import { useEffect, useState } from "react";

/**
 * True, sobald der Viewport die Handy-Breite (Default ≤600px) erreicht.
 *
 * Startwert ist bewusst `false` → Server-/Desktop-Render bleiben identisch zum
 * bisherigen Verhalten (kein Layout-Shift auf Desktop). Der Report wird ohnehin
 * erst clientseitig nach der Analyse gerendert, daher greift der echte Wert
 * praktisch sofort nach dem Mount. Genutzt, um Mobile-only-Verhalten
 * (einklappbare Texte, Geräte-Umschalter) gezielt zu aktivieren.
 */
export function useIsMobile(query = "(max-width: 600px)"): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(query);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [query]);

  return isMobile;
}

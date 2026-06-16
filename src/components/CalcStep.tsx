/*
 * CalcStep — eigener Schritt: Business-Impact-Rechner. Headline-Frage + der
 * eingebettete Uplift-Calculator (mit manuellen Eingabefeldern). Sitzt im
 * .fstep-Rahmen (Zurück + Fortschritt kommen von InputStage).
 */

import { ArrowRight } from "lucide-react";
import { Calculator } from "@/components/Calculator";

export function CalcStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="ovw">
      <div className="ovw-inner ovw-inner--calc">
        <header className="ovw-intro">
          <span className="fstep-kicker">Business Impact</span>
          <h2 className="ovw-calc-title">
            Errechne dir deinen Business Impact durch eine höhere Conversion
            Rate
          </h2>
        </header>

        <Calculator />

        <div className="ovw-cta">
          <button className="cta" onClick={onNext}>
            Weiter <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

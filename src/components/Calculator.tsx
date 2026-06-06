"use client";

import { useState } from "react";

const fmt = (n: number) => Math.round(n).toLocaleString("de-DE");

function Field({
  label,
  value,
  set,
  min,
  max,
  step,
  suffix = "",
}: {
  label: string;
  value: number;
  set: (n: number) => void;
  min: number;
  max: number;
  step: number;
  suffix?: string;
}) {
  return (
    <div className="calc-field">
      <div className="calc-label">
        <span>{label}</span>
        <span className="calc-val">
          {fmt(value)}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => set(Number(e.target.value))}
      />
    </div>
  );
}

export function Calculator() {
  const [traffic, setTraffic] = useState(40000);
  const [orders, setOrders] = useState(800);
  const [aov, setAov] = useState(65);

  const cr = traffic > 0 ? (orders / traffic) * 100 : 0;
  const rev = orders * aov;
  const scen = [10, 20, 30].map((up) => {
    const newOrders = orders * (1 + up / 100);
    const extraOrders = newOrders - orders;
    const extraMonth = extraOrders * aov;
    return {
      up,
      newCr: cr * (1 + up / 100),
      extraOrders,
      extraMonth,
      extraYear: extraMonth * 12,
    };
  });

  return (
    <div className="calc">
      <div className="calc-head">
        <span className="kicker">Unabhängiges Tool</span>
        <h3>Uplift-Kalkulator</h3>
        <p>
          Spiel mit deinen eigenen Zahlen — unabhängig von der Seitenanalyse.
          Was bedeuten 10 / 20 / 30 % mehr Conversion in Euro?
        </p>
      </div>
      <div className="calc-grid">
        <div className="calc-inputs">
          <Field
            label="Besucher / Monat"
            value={traffic}
            set={setTraffic}
            min={1000}
            max={500000}
            step={1000}
          />
          <Field
            label="Bestellungen / Monat"
            value={orders}
            set={setOrders}
            min={10}
            max={20000}
            step={10}
          />
          <Field
            label="Ø Bestellwert (AOV)"
            value={aov}
            set={setAov}
            min={10}
            max={500}
            step={5}
            suffix=" €"
          />
          <div className="calc-now">
            <div>
              <span>Conversion-Rate</span>
              <b>{cr.toFixed(2)} %</b>
            </div>
            <div>
              <span>Umsatz / Monat</span>
              <b>{fmt(rev)} €</b>
            </div>
          </div>
        </div>
        <div className="calc-scen">
          {scen.map((s) => (
            <div key={s.up} className="scen">
              <div className="scen-up">
                +{s.up}%<span> Conversion</span>
              </div>
              <div className="scen-cr">{s.newCr.toFixed(2)} % CR</div>
              <div className="scen-main">
                +{fmt(s.extraMonth)} €<span> / Monat</span>
              </div>
              <div className="scen-sub">
                +{fmt(s.extraYear)} € / Jahr · +{fmt(s.extraOrders)} Bestellungen
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

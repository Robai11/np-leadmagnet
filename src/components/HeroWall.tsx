/*
 * HeroWall — die driftende Wand aus echten Shop-Screenshots (public/hero/*.jpg).
 * Persistenter Hintergrund über ALLE Flow-Schritte: in Schritt 1 cinematic
 * scharf, ab Schritt 2 (über .hero--deep) abgedunkelt + unscharf in der Tiefe.
 *
 * 6 Spalten über die volle Breite; je Spalte 3 distinkte Bilder (kein Repeat
 * innerhalb einer Spalte), unterschiedliche Dauern desynchronisieren den Drift.
 */

/* eslint-disable @next/next/no-img-element -- statische lokale Screenshot-Kacheln; next/image bringt hier keinen Vorteil */

const DESKTOP_SHOTS = [
  "/hero/xd-1.jpg",
  "/hero/xd-2.jpg",
  "/hero/xd-3.jpg",
  "/hero/xd-4.jpg",
  "/hero/xd-5.jpg",
  "/hero/xd-6.jpg",
];
const MOBILE_SHOTS = ["/hero/xm-1.jpg", "/hero/xm-2.jpg", "/hero/xm-3.jpg"];

// Dekoratives Uplift-Label je Screenshot (illustrativ, keine echten Messwerte).
const UPLIFT_VALUES = [
  "+3 %", "+0,8 %", "+5 %", "+12 %", "+2 %", "+18 %", "+1,5 %", "+7 %",
  "+9 %", "+4 %", "+24 %", "+0,5 %", "+6 %", "+15 %", "+2,5 %", "+11 %",
  "+8 %", "+1 %", "+33 %", "+4,5 %",
];
const ALL_SHOTS = [...DESKTOP_SHOTS, ...MOBILE_SHOTS];
const UPLIFT: Record<string, string> = Object.fromEntries(
  ALL_SHOTS.map((s, i) => [s, UPLIFT_VALUES[i % UPLIFT_VALUES.length]]),
);

const D = DESKTOP_SHOTS;
const M = MOBILE_SHOTS;
type Col = { kind: "d" | "m"; dur: number; imgs: string[] };
const COLUMNS: Col[] = [
  { kind: "d", dur: 176, imgs: [D[0], D[1], D[2]] },
  { kind: "m", dur: 150, imgs: [M[0], M[1], M[2]] },
  { kind: "d", dur: 200, imgs: [D[3], D[4], D[5]] },
  { kind: "m", dur: 162, imgs: [M[1], M[2], M[0]] },
  { kind: "d", dur: 188, imgs: [D[1], D[5], D[0]] },
  { kind: "m", dur: 156, imgs: [M[2], M[0], M[1]] },
];

function Column({ index, col }: { index: number; col: Col }) {
  const seq = [...col.imgs, ...col.imgs]; // doppelt NUR für die nahtlose Schleife
  const up = index % 2 === 0;
  return (
    <div className={`hero-col hero-col--${col.kind}`}>
      <div
        className="hero-col-stack"
        style={{
          animationName: up ? "hero-drift-up" : "hero-drift-down",
          animationDuration: `${col.dur}s`,
        }}
      >
        {seq.map((src, i) => (
          <div className={`hero-tile hero-tile--${col.kind}`} key={i}>
            <img src={src} alt="" loading="lazy" draggable={false} />
            <span className="hero-uplift">{UPLIFT[src]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function HeroWall() {
  return (
    <div className="hero-wall" aria-hidden="true">
      {COLUMNS.map((col, i) => (
        <Column key={i} index={i} col={col} />
      ))}
    </div>
  );
}

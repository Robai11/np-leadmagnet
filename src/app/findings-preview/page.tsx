/*
 * /findings-preview — dev-only. Drei Entwürfe, wie die Fund-Aussage (X kritische
 * Stellen / Y Umsatz-Hebel) unter „Schwachstellen ansehen" gestaltet sein kann.
 * Jeder Entwurf steht im echten Kontext (Formular-Kopf links). Styling lokal
 * (fp-*), damit die Seite später leicht wieder entfernt werden kann.
 */

import { notFound } from "next/navigation";
import { Lock, TrendingUp, AlertTriangle } from "lucide-react";

const CRIT = 3;
const UP = 11;

const CSS = `
.fp-page { min-height: 100vh; background: #07171f; }
.fp-wrap { max-width: 720px; margin: 0 auto; padding: 40px 28px 96px; }
.fp-devbar { font-family: var(--font-mono); font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: var(--color-text-ink-mute); border-bottom: 1px solid var(--color-line-ink); padding-bottom: 16px; }
.fp-note { margin: 14px 0 0; font-size: 13px; color: var(--color-text-ink-mute); }
.fp-variant { margin-top: 46px; }
.fp-vh { display: flex; align-items: baseline; gap: 12px; }
.fp-vnum { font-family: var(--font-mono); font-size: 13px; font-weight: 700; color: var(--color-accent); }
.fp-vtitle { margin: 0; font-family: var(--font-display); font-weight: 800; font-size: 21px; color: var(--color-text-ink); }
.fp-vdesc { margin: 8px 0 18px; font-size: 14px; line-height: 1.55; color: var(--color-text-ink-mute); }

/* Formular-Kopf-Kontext (wie in der echten linken Spalte). */
.fp-mock { width: 540px; max-width: 100%; padding: 30px 34px; background: var(--color-ink-2); border-radius: var(--radius-lg); border: 1px solid var(--color-line-ink); }
.fp-badge { display: inline-flex; align-items: center; gap: 7px; padding: 6px 13px; border-radius: var(--radius-pill); background: rgba(61,192,145,.18); color: var(--color-accent); font-family: var(--font-mono); font-size: 12.5px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }
.fp-title { margin: 12px 0 16px; font-family: var(--font-display); font-weight: 800; font-size: 28px; color: #fff; }
.fp-fields { margin-top: 22px; display: flex; flex-direction: column; gap: 12px; }
.fp-input { height: 46px; border-radius: var(--radius); border: 1px solid rgba(255,255,255,.14); background: var(--color-ink); }
.fp-btn { height: 52px; border-radius: var(--radius); background: var(--color-accent); display: flex; align-items: center; justify-content: center; font-family: var(--font-display); font-weight: 800; font-size: 16px; color: #fff; }

/* ── Variante 1 — Kennzahl-Zeilen ─────────────────────────── */
.fp-v1 { display: flex; flex-direction: column; gap: 14px; }
.fp-metric { display: flex; align-items: center; gap: 16px; }
.fp-num { font-family: var(--font-display); font-weight: 900; font-size: 46px; line-height: .85; letter-spacing: -.03em; min-width: 62px; text-align: right; }
.fp-num--crit { color: var(--color-impact-high); }
.fp-num--up { color: var(--color-accent); }
.fp-metric-txt { display: flex; flex-direction: column; gap: 2px; }
.fp-metric-txt strong { font-family: var(--font-display); font-weight: 700; font-size: 16px; color: #fff; }
.fp-metric-txt em { font-style: normal; font-size: 13.5px; color: var(--color-text-ink-mute); }

/* ── Variante 2 — Ruhiger Satz ────────────────────────────── */
.fp-v2 { margin: 0; font-size: 17px; line-height: 1.55; color: var(--color-text-ink-mute); }
.fp-v2 b { font-family: var(--font-display); font-weight: 800; font-size: 1.25em; }
.fp-v2 .c { color: var(--color-impact-high); }
.fp-v2 .u { color: var(--color-accent); }
.fp-v2 strong { color: #fff; font-weight: 700; }

/* ── Variante 3 — Zwei Kacheln ────────────────────────────── */
.fp-v3 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.fp-tile { position: relative; padding: 16px 16px 15px; border-radius: var(--radius); border: 1px solid var(--color-line-ink); background: rgba(255,255,255,.03); overflow: hidden; }
.fp-tile::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; }
.fp-tile--crit::before { background: var(--color-impact-high); }
.fp-tile--up::before { background: var(--color-accent); }
.fp-tile-top { display: flex; align-items: center; gap: 8px; }
.fp-tile-ico { display: inline-flex; }
.fp-tile--crit .fp-tile-ico { color: var(--color-impact-high); }
.fp-tile--up .fp-tile-ico { color: var(--color-accent); }
.fp-tile-num { font-family: var(--font-display); font-weight: 900; font-size: 40px; line-height: 1; letter-spacing: -.02em; }
.fp-tile--crit .fp-tile-num { color: var(--color-impact-high); }
.fp-tile--up .fp-tile-num { color: var(--color-accent); }
.fp-tile-label { display: block; margin-top: 8px; font-family: var(--font-display); font-weight: 700; font-size: 15px; color: #fff; }
.fp-tile-sub { display: block; margin-top: 2px; font-size: 12.5px; color: var(--color-text-ink-mute); }
`;

function MockHead({ children }: { children: React.ReactNode }) {
  return (
    <div className="fp-mock">
      <span className="fp-badge">
        <Lock size={13} aria-hidden="true" /> Auswertung freischalten
      </span>
      <h3 className="fp-title">Schwachstellen ansehen</h3>
      {children}
      <div className="fp-fields">
        <div className="fp-input" />
        <div className="fp-input" />
        <div className="fp-btn">Schwachstellen ansehen</div>
      </div>
    </div>
  );
}

export default function FindingsPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <div className="cs-root cs-root--report fp-page">
      <style>{CSS}</style>
      <div className="fp-wrap">
        <div className="fp-devbar">
          Fund-Aussage · 3 Gestaltungs-Entwürfe (Dev-Vorschau)
        </div>
        <p className="fp-note">
          Es geht nur um die Darstellung der Fund-Aussage ({CRIT} kritische /{" "}
          {UP} Umsatz) unter der Headline. Zahlen kommen später aus der echten
          Analyse.
        </p>

        {/* Variante 1 */}
        <section className="fp-variant">
          <div className="fp-vh">
            <span className="fp-vnum">Variante 1</span>
            <h2 className="fp-vtitle">Kennzahl-Zeilen</h2>
          </div>
          <p className="fp-vdesc">
            Die zwei Zahlen als große, ruhige Kennzahlen mit kurzer Beschriftung —
            scanbar und sachlich mit Analyse-Ergebnis-Charakter. Keine bunte
            Satz-Mischung mehr.
          </p>
          <MockHead>
            <div className="fp-v1">
              <div className="fp-metric">
                <span className="fp-num fp-num--crit">{CRIT}</span>
                <span className="fp-metric-txt">
                  <strong>kritische Schwachstellen</strong>
                  <em>an denen aktuell Umsatz verloren geht</em>
                </span>
              </div>
              <div className="fp-metric">
                <span className="fp-num fp-num--up">{UP}</span>
                <span className="fp-metric-txt">
                  <strong>ungenutzte Umsatz-Hebel</strong>
                  <em>mit klarem Wachstums-Potenzial</em>
                </span>
              </div>
            </div>
          </MockHead>
        </section>

        {/* Variante 2 */}
        <section className="fp-variant">
          <div className="fp-vh">
            <span className="fp-vnum">Variante 2</span>
            <h2 className="fp-vtitle">Ruhiger Satz, nur Zahlen betont</h2>
          </div>
          <p className="fp-vdesc">
            Ein einziger, ruhiger Satz in normaler Schrift — nur die beiden Zahlen
            sind hervorgehoben. Zurückhaltend und hochwertig, keine farbigen
            Wortgruppen.
          </p>
          <MockHead>
            <p className="fp-v2">
              Unsere KI-Analyse hat in deinem Funnel <b className="c">{CRIT}</b>{" "}
              <strong>kritische Schwachstellen</strong> und <b className="u">{UP}</b>{" "}
              <strong>ungenutzte Umsatz-Hebel</strong> gefunden.
            </p>
          </MockHead>
        </section>

        {/* Variante 3 */}
        <section className="fp-variant">
          <div className="fp-vh">
            <span className="fp-vnum">Variante 3</span>
            <h2 className="fp-vtitle">Zwei Kacheln</h2>
          </div>
          <p className="fp-vdesc">
            Zwei kompakte Kacheln nebeneinander — je eine für Verlust und
            Potenzial, mit Icon, Zahl und Beschriftung. Klar getrennt und modern.
          </p>
          <MockHead>
            <div className="fp-v3">
              <div className="fp-tile fp-tile--crit">
                <div className="fp-tile-top">
                  <span className="fp-tile-ico">
                    <AlertTriangle size={18} aria-hidden="true" />
                  </span>
                  <span className="fp-tile-num">{CRIT}</span>
                </div>
                <span className="fp-tile-label">kritische Schwachstellen</span>
                <span className="fp-tile-sub">hier geht Umsatz verloren</span>
              </div>
              <div className="fp-tile fp-tile--up">
                <div className="fp-tile-top">
                  <span className="fp-tile-ico">
                    <TrendingUp size={18} aria-hidden="true" />
                  </span>
                  <span className="fp-tile-num">{UP}</span>
                </div>
                <span className="fp-tile-label">Umsatz-Hebel</span>
                <span className="fp-tile-sub">ungenutztes Potenzial</span>
              </div>
            </div>
          </MockHead>
        </section>
      </div>
    </div>
  );
}

/*
 * /team-cta-preview — dev-only. Three placement drafts for the team photo near
 * the "Jetzt Gespräch vereinbaren" CTA. The photo itself is a stylised
 * placeholder (silhouette line-up); the real asset gets dropped in once a
 * variant is chosen. All styling is local to this file (tcp-*) so it can be
 * removed together with the page.
 */

import { notFound } from "next/navigation";
import { ArrowRight, CalendarCheck } from "lucide-react";

/* eslint-disable @next/next/no-img-element -- statisches Markenlogo (SVG) */

const CSS = `
.tcp-page { min-height: 100vh; background: #07171f; }
.tcp-wrap { max-width: 1180px; margin: 0 auto; padding: 40px 32px 96px; }
.tcp-devbar {
  font-family: var(--font-mono); font-size: 12px; letter-spacing: .08em;
  text-transform: uppercase; color: var(--color-text-ink-mute);
  border-bottom: 1px solid var(--color-line-ink); padding-bottom: 16px;
}
.tcp-note {
  margin: 14px 0 8px; font-size: 13px; color: var(--color-text-ink-mute);
}
.tcp-variant { margin-top: 46px; }
.tcp-vh { display: flex; align-items: baseline; gap: 12px; }
.tcp-vnum { font-family: var(--font-mono); font-size: 13px; font-weight: 700; color: var(--color-accent); }
.tcp-vtitle { margin: 0; font-family: var(--font-display); font-weight: 800; font-size: 22px; color: var(--color-text-ink); }
.tcp-vdesc { margin: 8px 0 18px; font-size: 14.5px; line-height: 1.55; color: var(--color-text-ink-mute); max-width: 760px; }

/* Frame mimicking the report page chrome. */
.tcp-frame {
  position: relative; border: 1px solid var(--color-line-ink);
  border-radius: 16px; background: #07171f; overflow: hidden;
}
.tcp-topbar { display: flex; align-items: center; justify-content: space-between; padding: 18px 26px; gap: 20px; }
.tcp-brand { display: flex; align-items: center; gap: 11px; }
.tcp-brand img { height: 22px; width: auto; }
.tcp-brand-sep { width: 1px; height: 18px; background: var(--color-line-ink); }
.tcp-brand-name { font-family: var(--font-display); font-weight: 800; font-size: 15px; color: #fff; }
.tcp-actions { display: flex; align-items: center; gap: 18px; }
.tcp-cta {
  display: inline-flex; align-items: center; gap: 8px; white-space: nowrap;
  padding: 12px 20px; border-radius: 11px; border: none;
  background: var(--color-accent); color: var(--color-ink);
  font-family: var(--font-display); font-weight: 800; font-size: 14.5px;
}
.tcp-body { padding: 4px 26px 30px; }
.tcp-line { height: 12px; border-radius: 6px; background: rgba(255,255,255,.05); margin: 12px 0; }

/* Silhouette team-photo placeholder. */
.tcp-photo { position: relative; overflow: hidden; background: radial-gradient(130% 150% at 50% 8%, #12324c 0%, #0a1f30 62%, #081826 100%); }
.tcp-photo-figs { position: absolute; inset: 0; display: flex; align-items: flex-end; justify-content: center; gap: 1.1%; padding: 0 3% 0; }
.tcp-fig { display: flex; flex-direction: column; align-items: center; gap: 12%; flex: 1 1 0; max-width: 6.2%; }
.tcp-fig .h { width: 62%; aspect-ratio: 1; border-radius: 50%; background: rgba(255,255,255,.14); }
.tcp-fig .b { width: 100%; height: 46%; border-radius: 40% 40% 0 0; background: rgba(255,255,255,.11); }
.tcp-fig--front .h { background: rgba(255,255,255,.34); }
.tcp-fig--front .b { background: rgba(255,255,255,.26); }
.tcp-photo-tag {
  position: absolute; top: 10px; left: 12px; z-index: 2;
  font-family: var(--font-mono); font-size: 10px; letter-spacing: .1em;
  text-transform: uppercase; color: rgba(255,255,255,.42);
}

/* ── Variante 1 — Avatar-Cluster ─────────────────────────────── */
.tcp-avcluster { display: flex; align-items: center; gap: 12px; }
.tcp-avatars { display: flex; }
.tcp-av {
  width: 40px; height: 40px; border-radius: 50%; margin-left: -12px;
  border: 2px solid #07171f; overflow: hidden; flex: none;
  background: radial-gradient(120% 120% at 50% 15%, #16405f, #0b2438);
  position: relative;
}
.tcp-av:first-child { margin-left: 0; }
.tcp-av::before { content: ""; position: absolute; left: 50%; top: 26%; transform: translateX(-50%); width: 40%; aspect-ratio: 1; border-radius: 50%; background: rgba(255,255,255,.30); }
.tcp-av::after { content: ""; position: absolute; left: 50%; bottom: 0; transform: translateX(-50%); width: 66%; height: 42%; border-radius: 40% 40% 0 0; background: rgba(255,255,255,.24); }
.tcp-avnote { display: flex; flex-direction: column; line-height: 1.25; }
.tcp-avnote small { font-size: 11px; color: var(--color-text-ink-mute); }
.tcp-avnote strong { font-family: var(--font-display); font-size: 13.5px; color: #fff; font-weight: 700; }

/* ── Variante 2 — Popover-Karte ──────────────────────────────── */
.tcp-relwrap { position: relative; min-height: 440px; }
.tcp-card {
  position: absolute; top: 76px; right: 26px; z-index: 6; width: 336px;
  background: var(--color-ink-2); border: 1px solid var(--color-line-ink);
  border-radius: 16px; overflow: hidden; box-shadow: 0 26px 60px rgba(4,18,26,.6);
}
.tcp-card .tcp-photo { height: 132px; }
.tcp-card-caret {
  position: absolute; top: 64px; right: 118px; z-index: 7; width: 16px; height: 16px;
  background: var(--color-ink-2); border-left: 1px solid var(--color-line-ink);
  border-top: 1px solid var(--color-line-ink); transform: rotate(45deg);
}
.tcp-card-body { padding: 16px 18px 18px; }
.tcp-card-kick { font-family: var(--font-mono); font-size: 10.5px; letter-spacing: .09em; text-transform: uppercase; color: var(--color-accent); }
.tcp-card-h { margin: 6px 0 5px; font-family: var(--font-display); font-weight: 800; font-size: 17px; color: #fff; line-height: 1.25; }
.tcp-card-sub { margin: 0 0 14px; font-size: 13px; line-height: 1.45; color: var(--color-text-ink-mute); }
.tcp-card .tcp-cta { width: 100%; justify-content: center; }

/* ── Variante 3 — Abschluss-Band ─────────────────────────────── */
.tcp-band { position: relative; }
.tcp-band .tcp-photo { height: 210px; }
.tcp-band-overlay {
  position: absolute; inset: 0; z-index: 2; display: flex; flex-direction: column;
  align-items: center; justify-content: center; text-align: center; gap: 14px; padding: 24px;
  background: linear-gradient(90deg, rgba(7,23,31,.86) 0%, rgba(7,23,31,.34) 45%, rgba(7,23,31,.86) 100%);
}
.tcp-band-kick { font-family: var(--font-mono); font-size: 11px; letter-spacing: .1em; text-transform: uppercase; color: var(--color-accent); }
.tcp-band-h { margin: 0; font-family: var(--font-display); font-weight: 800; font-size: 26px; color: #fff; }
.tcp-band-h span { color: var(--color-accent); }
`;

const FIG_COUNT = 15;
const FRONT = new Set([6, 7]);

function TeamPhoto() {
  return (
    <div className="tcp-photo">
      <span className="tcp-photo-tag">Teamfoto (Platzhalter)</span>
      <div className="tcp-photo-figs">
        {Array.from({ length: FIG_COUNT }, (_, i) => (
          <div
            key={i}
            className={`tcp-fig ${FRONT.has(i) ? "tcp-fig--front" : ""}`}
          >
            <span className="h" />
            <span className="b" />
          </div>
        ))}
      </div>
    </div>
  );
}

function Brand() {
  return (
    <div className="tcp-brand">
      <img src="/brand/netzproduzenten-logo-weiss.svg" alt="Netzproduzenten" />
      <span className="tcp-brand-sep" />
      <span className="tcp-brand-name">ConversionScan</span>
    </div>
  );
}

function CtaButton() {
  return (
    <button className="tcp-cta" type="button">
      Jetzt Gespräch vereinbaren
    </button>
  );
}

export default function TeamCtaPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <div className="cs-root cs-root--report tcp-page">
      <style>{CSS}</style>
      <div className="tcp-wrap">
        <div className="tcp-devbar">
          Team-Foto · Platzierungs-Entwürfe (Dev-Vorschau)
        </div>
        <p className="tcp-note">
          Das Foto ist ein Platzhalter (Silhouetten) — es geht nur um die
          Platzierung. Das echte Teamfoto setze ich ein, sobald du eine Variante
          gewählt hast.
        </p>

        {/* Variante 1 */}
        <section className="tcp-variant">
          <div className="tcp-vh">
            <span className="tcp-vnum">Variante 1</span>
            <h2 className="tcp-vtitle">Avatar-Cluster direkt neben dem Button</h2>
          </div>
          <p className="tcp-vdesc">
            Eine kleine Reihe überlappender Team-Gesichter sitzt links vom
            Button — dezent, immer sichtbar, gibt der Aktion ein Gesicht.
            Platzsparend und zurückhaltend.
          </p>
          <div className="tcp-frame">
            <div className="tcp-topbar">
              <Brand />
              <div className="tcp-actions">
                <div className="tcp-avcluster">
                  <div className="tcp-avatars">
                    {Array.from({ length: 4 }, (_, i) => (
                      <span key={i} className="tcp-av" />
                    ))}
                  </div>
                  <span className="tcp-avnote">
                    <small>Sprich mit</small>
                    <strong>deinem Team</strong>
                  </span>
                </div>
                <CtaButton />
              </div>
            </div>
            <div className="tcp-body">
              <div className="tcp-line" style={{ width: "38%" }} />
              <div className="tcp-line" style={{ width: "62%" }} />
              <div className="tcp-line" style={{ width: "48%" }} />
            </div>
          </div>
        </section>

        {/* Variante 2 */}
        <section className="tcp-variant">
          <div className="tcp-vh">
            <span className="tcp-vnum">Variante 2</span>
            <h2 className="tcp-vtitle">Aufklapp-Karte unter dem Button</h2>
          </div>
          <p className="tcp-vdesc">
            Die Topbar bleibt schlank. Beim Hovern/Klick auf den Button klappt
            eine Karte mit dem vollen Teamfoto, einem kurzen Satz und dem
            Buchungs-Button auf. Foto prominent, ohne die Kopfzeile zu belasten.
          </p>
          <div className="tcp-frame tcp-relwrap">
            <div className="tcp-topbar">
              <Brand />
              <div className="tcp-actions">
                <CtaButton />
              </div>
            </div>
            <span className="tcp-card-caret" />
            <div className="tcp-card">
              <TeamPhoto />
              <div className="tcp-card-body">
                <span className="tcp-card-kick">
                  <CalendarCheck size={12} style={{ verticalAlign: "-2px", marginRight: 4 }} />
                  Kostenloses Erstgespräch
                </span>
                <h3 className="tcp-card-h">Lass uns über deine Hebel sprechen</h3>
                <p className="tcp-card-sub">
                  20 Minuten mit unseren CRO-Expert:innen — konkret zu deinem
                  Funnel.
                </p>
                <button className="tcp-cta" type="button">
                  Termin wählen <ArrowRight size={16} />
                </button>
              </div>
            </div>
            <div className="tcp-body" style={{ paddingTop: 40 }}>
              <div className="tcp-line" style={{ width: "38%" }} />
              <div className="tcp-line" style={{ width: "62%" }} />
              <div className="tcp-line" style={{ width: "48%" }} />
            </div>
          </div>
        </section>

        {/* Variante 3 */}
        <section className="tcp-variant">
          <div className="tcp-vh">
            <span className="tcp-vnum">Variante 3</span>
            <h2 className="tcp-vtitle">Abschluss-Band am Report-Ende</h2>
          </div>
          <p className="tcp-vdesc">
            Der Button oben bleibt. Zusätzlich schließt der Report mit einem
            breiten Team-Banner + zweitem Buchungs-Button ab — genau am
            Entscheidungspunkt, wenn alle Hebel gelesen sind. Stärkster
            Vertrauens-Moment.
          </p>
          <div className="tcp-frame">
            <div className="tcp-topbar">
              <Brand />
              <div className="tcp-actions">
                <CtaButton />
              </div>
            </div>
            <div className="tcp-body">
              <div className="tcp-line" style={{ width: "38%" }} />
              <div className="tcp-line" style={{ width: "62%" }} />
            </div>
            <div className="tcp-band">
              <TeamPhoto />
              <div className="tcp-band-overlay">
                <span className="tcp-band-kick">Netzproduzenten · CRO-Team</span>
                <h3 className="tcp-band-h">
                  Bereit, diese Hebel <span>umzusetzen?</span>
                </h3>
                <button className="tcp-cta" type="button">
                  Jetzt Gespräch vereinbaren <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

"use client";

/* eslint-disable @next/next/no-img-element -- lokale statische Marken-/Team-Assets; next/image bringt hier keinen Vorteil */

/*
 * LeadForm — the lead-capture panel shown over the blurred, locked report tabs
 * (see LEAD_GATE_ENABLED). The Startseite tab is free; every other tab blurs its
 * content and renders this panel on top, scoped to the tab content area (not
 * full-screen). A captured lead unlocks the whole report. Alongside the form it
 * carries social proof: the team photo (right column) and a client-logo strip
 * (footer).
 */

import { useState } from "react";
import { ArrowRight, Check, Loader2, Lock } from "lucide-react";
import { isBusinessEmail, isValidEmail } from "@/lib/email";

/** Kundenlogos für die Vertrauens-Leiste (weiße SVGs auf Navy). */
const CLIENT_LOGOS: { src: string; alt: string }[] = [
  { src: "/brand/clients/urlaubsguru.svg", alt: "Urlaubsguru" },
  { src: "/brand/clients/electropapa.svg", alt: "ElectroPapa" },
  { src: "/brand/clients/pfh.svg", alt: "PFH" },
  { src: "/brand/clients/speidel.svg", alt: "Speidel" },
  { src: "/brand/clients/brandible.svg", alt: "brandible" },
  { src: "/brand/clients/little-john-bikes.svg", alt: "Little John Bikes" },
  { src: "/brand/clients/fust.svg", alt: "Fust" },
  { src: "/brand/clients/chamaeleon.svg", alt: "Chamäleon" },
  { src: "/brand/clients/steinbach.svg", alt: "Steinbach" },
  { src: "/brand/clients/sgs.svg", alt: "SGS" },
];

export interface LeadData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

type Errors = Partial<Record<keyof LeadData, string>>;

const PHONE_RE = /^[+()/\d][\d\s/().-]{5,}$/;

const SERVER_ERRORS: Record<string, string> = {
  name_required: "Bitte Vor- und Nachnamen angeben.",
  business_email_required:
    "Bitte eine geschäftliche E-Mail verwenden (keine gmail/gmx/web.de …).",
  phone_required: "Bitte eine gültige Telefonnummer angeben.",
};

function Field({
  label,
  name,
  value,
  onChange,
  type = "text",
  placeholder,
  autoComplete,
  error,
}: {
  label: string;
  name: keyof LeadData;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  error?: string;
}) {
  return (
    <label className={`lg-field ${error ? "has-error" : ""}`}>
      <span className="lg-label">{label}</span>
      <input
        className="lg-input"
        name={name}
        type={type}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
      />
      {error ? <span className="lg-error">{error}</span> : null}
    </label>
  );
}

/**
 * Right-hand column: what the scan found — one stat block for the critical
 * spots (Geld verbrennen) and one for the upside (mehr Umsatz). Plural-aware,
 * graceful at zero.
 */
/** Teamfoto — vollständig dargestellt (kein Crop), menschlicher Vertrauensanker. */
function TeamStrip() {
  return (
    <figure className="lf-team">
      <img src="/brand/team.jpg" alt="Das Team von Netzproduzenten" />
      <figcaption>
        Netzproduzenten – Performance Marketing für Online-Shops
      </figcaption>
    </figure>
  );
}

/** Headline über dem rechten Bereich — plural-aware, graceful bei 0. */
function AnalysisHeadline({
  critical,
  upside,
}: {
  critical: number;
  upside: number;
}) {
  const critPart = (
    <>
      <b className="lf-head-crit">{critical}</b>{" "}
      {critical === 1 ? "kritische Stelle" : "kritische Stellen"} gefunden,{" "}
      {critical === 1 ? "an der" : "an denen"} du{" "}
      <b className="lf-head-crit">Geld verbrennst</b>
    </>
  );
  const upPart = (
    <>
      <b className="lf-head-up">{upside}</b>{" "}
      {upside === 1 ? "Stelle" : "Stellen"}, {upside === 1 ? "an der" : "wo"} du{" "}
      <b className="lf-head-up">mehr Umsatz</b> herausholen kannst
    </>
  );

  let body: React.ReactNode;
  if (critical > 0 && upside > 0) {
    body = (
      <>
        Unsere KI-Analyse hat {critPart} – und {upPart}.
      </>
    );
  } else if (critical > 0) {
    body = <>Unsere KI-Analyse hat {critPart}.</>;
  } else if (upside > 0) {
    body = <>Unsere KI-Analyse hat {upPart}.</>;
  } else {
    body = (
      <>Unsere KI-Analyse hat deinen Funnel durchleuchtet — sieh dir an, wo.</>
    );
  }

  return <p className="lf-found-line">{body}</p>;
}

function FoundAside() {
  return (
    <aside className="leadform-side">
      <TeamStrip />
      <ul className="lf-checks">
        <li>
          <Check size={18} aria-hidden="true" />
          Sofort-Auswertung über den kompletten Funnel
        </li>
        <li>
          <Check size={18} aria-hidden="true" />
          Priorisiert nach Umsatz-Effekt &amp; Aufwand
        </li>
        <li>
          <Check size={18} aria-hidden="true" />
          Kostenlos &amp; unverbindlich
        </li>
      </ul>
      <TrustLogos />
    </aside>
  );
}

/** Kundenlogo-Leiste — Social Proof im Panel-Fuß. */
function TrustLogos() {
  return (
    <div className="lf-trust">
      <span className="lf-trust-label">Diese Marken vertrauen auf uns</span>
      <div className="lf-logos">
        {CLIENT_LOGOS.map((l) => (
          <img key={l.src} className="lf-logo" src={l.src} alt={l.alt} />
        ))}
      </div>
    </div>
  );
}

export function LeadForm({
  critical,
  upside,
  onSubmit,
}: {
  critical: number;
  upside: number;
  onSubmit: (data: LeadData) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [data, setData] = useState<LeadData>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  });
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const set = (k: keyof LeadData) => (v: string) => {
    setData((d) => ({ ...d, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const validate = (): Errors => {
    const e: Errors = {};
    if (!data.firstName.trim()) e.firstName = "Bitte Vornamen angeben.";
    if (!data.lastName.trim()) e.lastName = "Bitte Nachnamen angeben.";
    if (!data.email.trim()) e.email = "Bitte E-Mail angeben.";
    else if (!isValidEmail(data.email)) e.email = "Bitte gültige E-Mail angeben.";
    else if (!isBusinessEmail(data.email))
      e.email = "Bitte geschäftliche E-Mail (keine gmail/gmx/web.de …).";
    if (!data.phone.trim()) e.phone = "Bitte Telefonnummer angeben.";
    else if (!PHONE_RE.test(data.phone.trim()))
      e.phone = "Bitte gültige Telefonnummer angeben.";
    return e;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (submitting) return;
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    setSubmitting(true);
    setServerError(null);
    const res = await onSubmit({
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      email: data.email.trim(),
      phone: data.phone.trim(),
    });
    if (!res.ok) {
      setSubmitting(false);
      setServerError(
        (res.error && SERVER_ERRORS[res.error]) ??
          "Konnte nicht abgesendet werden. Bitte erneut versuchen.",
      );
    }
    // On success the parent reveals (unmounts this form); keep the spinner.
  };

  return (
    <div
      className="leadgate-panel leadform-panel"
      role="dialog"
      aria-modal="true"
      aria-label="Schwachstellen ansehen"
    >
      <div className="leadform-cols">
        <div className="leadform-main">
          <div className="leadgate-form-head">
            <span className="leadgate-form-badge">
              <Lock size={13} aria-hidden="true" /> Auswertung freischalten
            </span>
            <h3 className="leadgate-form-title">Schwachstellen ansehen</h3>
            <AnalysisHeadline critical={critical} upside={upside} />
          </div>

          <form className="leadgate-form" onSubmit={handleSubmit} noValidate>
            <div className="lg-grid">
              <Field
                label="Vorname"
                name="firstName"
                value={data.firstName}
                onChange={set("firstName")}
                autoComplete="given-name"
                placeholder="Max"
                error={errors.firstName}
              />
              <Field
                label="Nachname"
                name="lastName"
                value={data.lastName}
                onChange={set("lastName")}
                autoComplete="family-name"
                placeholder="Mustermann"
                error={errors.lastName}
              />
              <div className="lg-field-full">
                <Field
                  label="Geschäftliche E-Mail"
                  name="email"
                  type="email"
                  value={data.email}
                  onChange={set("email")}
                  autoComplete="email"
                  placeholder="max@dein-unternehmen.de"
                  error={errors.email}
                />
              </div>
              <div className="lg-field-full">
                <Field
                  label="Telefonnummer"
                  name="phone"
                  type="tel"
                  value={data.phone}
                  onChange={set("phone")}
                  autoComplete="tel"
                  placeholder="+49 …"
                  error={errors.phone}
                />
              </div>
            </div>

            {serverError ? (
              <p className="lg-server-error">{serverError}</p>
            ) : null}

            <button className="lg-submit" type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 size={17} className="spin" /> Wird geöffnet …
                </>
              ) : (
                <>
                  Schwachstellen ansehen <ArrowRight size={17} />
                </>
              )}
            </button>

            <p className="lg-fineprint">
              Wir nutzen deine Daten ausschließlich für deine Auswertung und die
              Kontaktaufnahme dazu.
            </p>
          </form>
        </div>

        <FoundAside />
      </div>
    </div>
  );
}

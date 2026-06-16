"use client";

/*
 * LeadGate — the client-side lead gate that sits over the report (see
 * LEAD_GATE_ENABLED). The report is shown for a few seconds (peek), then the
 * parent blurs it and mounts this overlay: a "found X/Y" headline plus the
 * "Jetzt Schwachstellen ansehen" lead form. On a captured lead the parent flips
 * to the `revealing` phase and the two curtains part — the landing-style
 * open-up — while the report behind sharpens back into focus.
 */

import { useState } from "react";
import { ArrowRight, Loader2, Lock } from "lucide-react";
import { isBusinessEmail, isValidEmail } from "@/lib/email";

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

/** The "Ich habe X … und Y …" headline, plural-aware and graceful at zero. */
function FoundHeadline({
  critical,
  upside,
}: {
  critical: number;
  upside: number;
}) {
  const critPart = (
    <>
      <b className="lg-num lg-num--crit">{critical}</b>{" "}
      {critical === 1 ? "kritische Stelle" : "kritische Stellen"} gefunden,{" "}
      {critical === 1 ? "an der" : "an denen"} du{" "}
      <span className="lg-hot">Geld verbrennst</span>
    </>
  );
  const upPart = (
    <>
      <b className="lg-num lg-num--up">{upside}</b>{" "}
      {upside === 1 ? "Stelle" : "Stellen"},{" "}
      {upside === 1 ? "an der" : "wo"} du{" "}
      <span className="lg-up">mehr Umsatz</span> herausholen kannst
    </>
  );

  let body: React.ReactNode;
  if (critical > 0 && upside > 0) {
    body = (
      <>
        Ich habe {critPart} – und {upPart}.
      </>
    );
  } else if (critical > 0) {
    body = <>Ich habe {critPart}.</>;
  } else if (upside > 0) {
    body = <>Ich habe {upPart}.</>;
  } else {
    body = <>Ich habe deinen Funnel analysiert — sieh dir die Ergebnisse an.</>;
  }

  return <p className="leadgate-found">{body}</p>;
}

export function LeadGate({
  phase,
  critical,
  upside,
  onSubmit,
}: {
  phase: "gate" | "revealing";
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
    if (submitting || phase === "revealing") return;
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
    // On success the parent flips to `revealing`; we keep the spinner until then.
  };

  return (
    <div className={`leadgate phase-${phase}`}>
      <div className="leadgate-curtain leadgate-curtain--left" aria-hidden="true" />
      <div
        className="leadgate-curtain leadgate-curtain--right"
        aria-hidden="true"
      />

      <div
        className="leadgate-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Schwachstellen ansehen"
      >
        <FoundHeadline critical={critical} upside={upside} />

        <form className="leadgate-form" onSubmit={handleSubmit} noValidate>
          <div className="leadgate-form-head">
            <span className="leadgate-form-badge">
              <Lock size={13} aria-hidden="true" /> Auswertung freischalten
            </span>
            <h3 className="leadgate-form-title">Jetzt Schwachstellen ansehen</h3>
            <p className="leadgate-form-sub">
              Trag deine Kontaktdaten ein — danach siehst du sofort alle
              Optimierungen über den kompletten Funnel.
            </p>
          </div>

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

          {serverError ? <p className="lg-server-error">{serverError}</p> : null}

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
    </div>
  );
}

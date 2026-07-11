"use client";

/*
 * LeadForm — the lead-capture panel shown over the blurred, locked report tabs
 * (see LEAD_GATE_ENABLED). The Startseite tab is free; every other tab blurs its
 * content and renders this panel on top, scoped to the tab content area (not
 * full-screen). A captured lead unlocks the whole report.
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

/**
 * Right-hand column: what the scan found — one stat block for the critical
 * spots (Geld verbrennen) and one for the upside (mehr Umsatz). Plural-aware,
 * graceful at zero.
 */
function FoundAside({ critical, upside }: { critical: number; upside: number }) {
  if (critical <= 0 && upside <= 0) {
    return (
      <aside className="leadform-side">
        <p className="lf-side-empty">
          Ich habe deinen Funnel analysiert — sieh dir die Ergebnisse an.
        </p>
      </aside>
    );
  }

  return (
    <aside className="leadform-side">
      <span className="lf-side-kicker">Das habe ich gefunden</span>
      <div className="lf-finds">
        {critical > 0 && (
          <div className="lf-find lf-find--crit">
            <span className="lf-find-num">{critical}</span>
            <span className="lf-find-txt">
              {critical === 1 ? "kritische Stelle" : "kritische Stellen"},{" "}
              {critical === 1 ? "an der" : "an denen"} du{" "}
              <b>Geld verbrennst</b>
            </span>
          </div>
        )}
        {upside > 0 && (
          <div className="lf-find lf-find--up">
            <span className="lf-find-num">{upside}</span>
            <span className="lf-find-txt">
              {upside === 1 ? "Stelle" : "Stellen"},{" "}
              {upside === 1 ? "an der" : "wo"} du <b>mehr Umsatz</b> herausholen
              kannst
            </span>
          </div>
        )}
      </div>
    </aside>
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

        <FoundAside critical={critical} upside={upside} />
      </div>
    </div>
  );
}

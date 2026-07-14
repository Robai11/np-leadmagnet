"use client";

/* eslint-disable @next/next/no-img-element -- statisches SVG-Markenlogo */

import { useState } from "react";
import { Lock, ArrowRight, Loader2 } from "lucide-react";

export default function AdminLoginPage() {
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ user, password }),
      });
      if (res.ok) {
        const next =
          new URLSearchParams(window.location.search).get("next") || "/admin";
        window.location.href = next;
        return;
      }
      setBusy(false);
      setError(
        res.status === 503
          ? "Admin-Zugang ist nicht konfiguriert."
          : "Benutzername oder Passwort falsch.",
      );
    } catch {
      setBusy(false);
      setError("Netzwerkfehler — bitte erneut versuchen.");
    }
  };

  return (
    <div className="adm-login">
      <form className="adm-card leadgate-form" onSubmit={submit} noValidate>
        <div className="adm-brand">
          <img
            src="/brand/netzproduzenten-logo-weiss.svg"
            alt="Netzproduzenten"
          />
          <span className="brand-sep" aria-hidden="true" />
          <span className="adm-brand-name">ConversionScan</span>
        </div>

        <span className="leadgate-form-badge">
          <Lock size={13} aria-hidden="true" /> Admin-Bereich
        </span>
        <h1 className="adm-title">Anmelden</h1>
        <p className="adm-sub">Lead-Übersicht — nur für dein Team.</p>

        <label className="lg-field">
          <span className="lg-label">Benutzername</span>
          <input
            className="lg-input"
            name="username"
            autoComplete="username"
            value={user}
            onChange={(e) => setUser(e.target.value)}
          />
        </label>
        <label className="lg-field">
          <span className="lg-label">Passwort</span>
          <input
            className="lg-input"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {error ? <p className="adm-err">{error}</p> : null}

        <button className="lg-submit" type="submit" disabled={busy}>
          {busy ? (
            <>
              <Loader2 size={17} className="spin" /> Anmelden …
            </>
          ) : (
            <>
              Anmelden <ArrowRight size={17} />
            </>
          )}
        </button>
      </form>
    </div>
  );
}

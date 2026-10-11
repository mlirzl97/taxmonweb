"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function ForgotPasswordForm({ isConfigured }: { isConfigured: boolean }) {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    const client = createSupabaseBrowserClient();

    if (!client) {
      setError("Authentication is not configured for this environment.");
      setIsSubmitting(false);
      return;
    }

    const redirectTo = `${window.location.origin}/auth/callback?next=/reset-password`;
    await client.auth.resetPasswordForEmail(email.trim(), { redirectTo });
    // Deliberately show the same response whether the address exists or not.
    setSubmitted(true);
    setIsSubmitting(false);
  }

  return submitted ? (
    <div className="auth-success" role="status">
      <strong>Check your approved work email</strong>
      <p>If the account is eligible, TaxMonWeb sent a password-reset link. The link expires and does not change access rights.</p>
      <Link className="button button--quiet button--full" href="/login">Return to sign in</Link>
    </div>
  ) : (
    <form className="sign-in-form" onSubmit={submit}>
      {error && <div className="callout callout--error" role="alert">{error}</div>}
      <div className="field">
        <label htmlFor="reset-email">Approved work email</label>
        <input autoComplete="email" disabled={!isConfigured || isSubmitting} id="reset-email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
      </div>
      <button className="button button--primary button--full" disabled={!isConfigured || isSubmitting} type="submit">{isSubmitting ? "Sending…" : "Send reset link"}</button>
      <Link className="auth-back-link" href="/login">Back to sign in</Link>
    </form>
  );
}

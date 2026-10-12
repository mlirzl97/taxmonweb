"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type SignInFormProps = {
  isConfigured: boolean;
};

export function SignInForm({ isConfigured }: SignInFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const client = createSupabaseBrowserClient();

    if (!client) {
      setError("Sign-in is temporarily unavailable.");
      setIsSubmitting(false);
      return;
    }

    try {
      const { error: signInError } = await client.auth.signInWithPassword({ email, password });

      if (signInError) {
        setError("We couldn't sign you in. Check that you're using the work email connected to TaxMonWeb and that the password is correct. If you're unsure which email was set up, ask your administrator.");
        return;
      }

      // A full same-origin navigation lets the server proxy consume the freshly
      // persisted Supabase session before rendering the protected layout.
      window.location.assign(new URL("/app/control-tower", window.location.origin).toString());
    } catch {
      setError("Unable to sign in right now. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="sign-in-form" onSubmit={handleSubmit}>
      {!isConfigured && (
        <div className="callout callout--warning" role="status">
          <strong>Sign-in unavailable</strong>
          <p>This environment is not connected to TaxMonWeb Auth.</p>
        </div>
      )}
      {error && <div className="callout callout--error" id="sign-in-error" role="alert">{error}</div>}
      <div className="field">
        <label htmlFor="email">Work email</label>
        <input aria-describedby={error ? "sign-in-error" : undefined} aria-invalid={Boolean(error)} autoComplete="email" disabled={!isConfigured || isSubmitting} id="email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input aria-describedby={error ? "sign-in-error" : undefined} aria-invalid={Boolean(error)} autoComplete="current-password" disabled={!isConfigured || isSubmitting} id="password" onChange={(event) => setPassword(event.target.value)} required type="password" value={password} />
      </div>
      <button className="button button--primary button--full" disabled={!isConfigured || isSubmitting} type="submit">
        {isSubmitting ? "Signing in…" : "Sign in"}
      </button>
      <Link className="auth-back-link" href="/forgot-password">Forgot password?</Link>
    </form>
  );
}

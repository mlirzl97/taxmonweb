"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function ActivateAccountForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Use a password with at least 8 characters.");
      return;
    }
    if (password !== confirmation) {
      setError("The passwords do not match.");
      return;
    }

    const client = createSupabaseBrowserClient();
    if (!client) {
      setError("Authentication is not configured for this environment.");
      return;
    }

    setIsSubmitting(true);
    const { error: passwordError } = await client.auth.updateUser({ password });
    if (passwordError) {
      setError("The password could not be created. Request a new activation link and try again.");
      setIsSubmitting(false);
      return;
    }

    const response = await fetch("/api/auth/activate", { method: "POST", headers: { "content-type": "application/json" } });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({})) as { error?: string };
      setError(payload.error ?? "Staff setup is not complete. Ask an authorized administrator to finish it.");
      setIsSubmitting(false);
      return;
    }

    router.replace("/app/control-tower");
    router.refresh();
  }

  return <form className="sign-in-form" onSubmit={submit}>
    {error && <div className="callout callout--error" role="alert">{error}</div>}
    <div className="field"><label htmlFor="activation-password">Create password</label><input autoComplete="new-password" disabled={isSubmitting} id="activation-password" minLength={8} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} /></div>
    <div className="field"><label htmlFor="activation-password-confirmation">Confirm password</label><input autoComplete="new-password" disabled={isSubmitting} id="activation-password-confirmation" minLength={8} onChange={(event) => setConfirmation(event.target.value)} required type="password" value={confirmation} /></div>
    <button className="button button--primary button--full" disabled={isSubmitting} type="submit">{isSubmitting ? "Activating…" : "Activate account"}</button>
    <p className="form-footnote">Activation enables only the access and scope already assigned by TaxMonWeb administration.</p>
  </form>;
}

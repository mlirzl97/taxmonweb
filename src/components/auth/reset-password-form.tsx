"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password.length < 8) return setError("Use a password with at least 8 characters.");
    if (password !== confirmation) return setError("The passwords do not match.");

    const client = createSupabaseBrowserClient();
    if (!client) return setError("Authentication is not configured for this environment.");

    setIsSubmitting(true);
    const { error: passwordError } = await client.auth.updateUser({ password });
    if (passwordError) {
      setError("The reset link is invalid or expired. Request a new link and try again.");
      setIsSubmitting(false);
      return;
    }

    const response = await fetch("/api/auth/password-reset", { method: "POST", headers: { "content-type": "application/json" } });
    if (!response.ok) {
      setError("The password changed, but the reset could not be recorded. Contact an administrator before continuing.");
      setIsSubmitting(false);
      return;
    }

    router.replace("/app/control-tower");
    router.refresh();
  }

  return <form className="sign-in-form" onSubmit={submit}>
    {error && <div className="callout callout--error" role="alert">{error}</div>}
    <div className="field"><label htmlFor="new-password">New password</label><input autoComplete="new-password" disabled={isSubmitting} id="new-password" minLength={8} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} /></div>
    <div className="field"><label htmlFor="new-password-confirmation">Confirm new password</label><input autoComplete="new-password" disabled={isSubmitting} id="new-password-confirmation" minLength={8} onChange={(event) => setConfirmation(event.target.value)} required type="password" value={confirmation} /></div>
    <button className="button button--primary button--full" disabled={isSubmitting} type="submit">{isSubmitting ? "Updating…" : "Update password"}</button>
  </form>;
}

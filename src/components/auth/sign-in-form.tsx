"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type SignInFormProps = {
  isConfigured: boolean;
};

export function SignInForm({ isConfigured }: SignInFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const client = createSupabaseBrowserClient();

    if (!client) {
      setError("Supabase Auth is not configured for this environment.");
      setIsSubmitting(false);
      return;
    }

    const { error: signInError } = await client.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError(signInError.message);
      setIsSubmitting(false);
      return;
    }

    router.replace("/app/control-tower");
    router.refresh();
  }

  return (
    <form className="sign-in-form" onSubmit={handleSubmit}>
      {!isConfigured && (
        <div className="callout callout--warning" role="status">
          <strong>Environment setup required</strong>
          <p>Copy <code>.env.example</code> to <code>.env.local</code> and add the approved Supabase project URL and anon key before signing in.</p>
        </div>
      )}
      {error && <div className="callout callout--error" role="alert">{error}</div>}
      <div className="field">
        <label htmlFor="email">Work email</label>
        <input autoComplete="email" disabled={!isConfigured || isSubmitting} id="email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input autoComplete="current-password" disabled={!isConfigured || isSubmitting} id="password" onChange={(event) => setPassword(event.target.value)} required type="password" value={password} />
      </div>
      <button className="button button--primary button--full" disabled={!isConfigured || isSubmitting} type="submit">
        {isSubmitting ? "Signing in…" : "Sign in"}
      </button>
      <p className="form-footnote">Access is provided through the configured TaxMonWeb Supabase Auth project.</p>
    </form>
  );
}

import { BrandLockup } from "@/components/brand/brand-lockup";
import { SignInForm } from "@/components/auth/sign-in-form";
import { getSupabaseConfig } from "@/lib/supabase/config";

export default function LoginPage() {
  const { isConfigured } = getSupabaseConfig();

  return (
    <main className="login-page">
      <section aria-label="TaxMonWeb product introduction" className="login-brand-panel">
        <BrandLockup inverted />
        <div className="login-brand-panel__message">
          <p className="eyebrow" style={{ color: "rgba(255,255,255,0.55)" }}>Tax compliance control</p>
          <h1>See what needs attention. Know what happens next.</h1>
          <p>A calm control tower for recurring compliance work, evidence, and operational exceptions.</p>
        </div>
        <p className="login-brand-panel__footer">Slice 01 · sanitized product preview</p>
      </section>
      <section aria-labelledby="sign-in-title" className="login-form-panel">
        <div className="login-card">
          <BrandLockup compact />
          <h2 id="sign-in-title">Sign in to TaxMonWeb</h2>
          <p className="login-card__intro">Use your configured TaxMonWeb account to enter the workspace.</p>
          <SignInForm isConfigured={isConfigured} />
        </div>
      </section>
    </main>
  );
}

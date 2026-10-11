import { redirect } from "next/navigation";

import { BrandLockup } from "@/components/brand/brand-lockup";
import { SignInForm } from "@/components/auth/sign-in-form";
import { getSupabaseConfig, isPrototypeDemoMode } from "@/lib/supabase/config";

export default function LoginPage() {
  if (isPrototypeDemoMode()) {
    redirect("/app/control-tower");
  }

  const { isConfigured } = getSupabaseConfig();

  return (
    <main className="login-page">
      <section aria-label="TaxMonWeb product introduction" className="login-brand-panel">
        <BrandLockup inverted />
        <div className="login-brand-panel__message">
          <p className="eyebrow" style={{ color: "rgba(255,255,255,0.55)" }}>Tax compliance control</p>
          <h1>See what needs attention. Know what happens next.</h1>
        </div>
      </section>
      <section aria-labelledby="sign-in-title" className="login-form-panel">
        <div className="login-card">
          <BrandLockup compact />
          <h2 id="sign-in-title">Sign in to TaxMonWeb</h2>
          <p className="login-card__intro">Continue to your TaxMonWeb workspace.</p>
          <SignInForm isConfigured={isConfigured} />
        </div>
      </section>
    </main>
  );
}

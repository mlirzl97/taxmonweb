import { BrandLockup } from "@/components/brand/brand-lockup";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { getSupabaseConfig } from "@/lib/supabase/config";

export default function ForgotPasswordPage() {
  return <main className="login-page login-page--single">
    <section aria-labelledby="forgot-password-title" className="login-form-panel">
      <div className="login-card">
        <BrandLockup compact />
        <h1 id="forgot-password-title">Reset your password</h1>
        <p className="login-card__intro">Use the approved work email connected to your TaxMonWeb account.</p>
        <ForgotPasswordForm isConfigured={getSupabaseConfig().isConfigured} />
      </div>
    </section>
  </main>;
}

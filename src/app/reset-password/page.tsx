import { BrandLockup } from "@/components/brand/brand-lockup";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export default function ResetPasswordPage() {
  return <main className="login-page login-page--single">
    <section aria-labelledby="reset-password-title" className="login-form-panel">
      <div className="login-card">
        <BrandLockup compact />
        <h1 id="reset-password-title">Choose a new password</h1>
        <p className="login-card__intro">Your reset link is single-use. Changing your password does not change your access rights.</p>
        <ResetPasswordForm />
      </div>
    </section>
  </main>;
}

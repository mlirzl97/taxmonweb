import { BrandLockup } from "@/components/brand/brand-lockup";
import { ActivateAccountForm } from "@/components/auth/activate-account-form";

export default function ActivatePage() {
  return <main className="login-page login-page--single">
    <section aria-labelledby="activate-account-title" className="login-form-panel">
      <div className="login-card">
        <BrandLockup compact />
        <h1 id="activate-account-title">Activate your TaxMonWeb account</h1>
        <p className="login-card__intro">Create your password to activate the staff account prepared by your administrator.</p>
        <ActivateAccountForm />
      </div>
    </section>
  </main>;
}

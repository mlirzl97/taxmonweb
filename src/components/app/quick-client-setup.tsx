"use client";

import { useEffect, useState } from "react";

import { MonthYearPicker } from "@/components/app/month-year-picker";
import { ReturnTaxSelector } from "@/components/app/return-tax-selector";
import { DetailDrawer } from "@/components/app/workspace-components";
import { fixtureClock } from "@/lib/fixtures";
import { isOrganizationUnitInEffect } from "@/lib/domain/organization-catalog";
import {
  buildQuickClientSetupDraft,
  buildQuickClientSetupRequest,
  emptyQuickClientSetup,
  quickClientSetupErrors,
  quickSetupDayCount,
  quickSetupMonths,
  type QuickClientSetupErrors,
  type QuickClientSetupInput,
} from "@/lib/domain/quick-client-setup";
import { prototypeClientSetupUpdatedEvent } from "@/lib/domain/submitted-client-projection";

const draftStorageKey = "taxmon.client.setup.drafts";

type ScopeOption = { id: string; name: string; unit_kind: string };

/**
 * Four questions: which client, which returns, what year-end, and when filing
 * starts. Everything else is finished later in the full setup. Saving here
 * never approves Expected Compliance and never generates work.
 */
export function QuickClientSetupDrawer({ prototypeMode, onClose, onSaved, onOpenFullSetup }: {
  prototypeMode: boolean;
  onClose: () => void;
  onSaved: (referenceCode: string) => void;
  onOpenFullSetup: () => void;
}) {
  const [form, setForm] = useState<QuickClientSetupInput>(emptyQuickClientSetup);
  const [errors, setErrors] = useState<QuickClientSetupErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [scopes, setScopes] = useState<ScopeOption[]>([]);
  const [organizationUnitId, setOrganizationUnitId] = useState("");

  useEffect(() => {
    if (prototypeMode) return;
    let cancelled = false;
    fetch("/api/organization/units")
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load operating scopes.");
        return response.json() as Promise<{ data?: Array<ScopeOption & { effective_from?: string | null; effective_to?: string | null }> }>;
      })
      .then((result) => {
        if (cancelled) return;
        const today = new Date().toISOString().slice(0, 10);
        const units = (result.data ?? []).filter((unit) => (unit.unit_kind === "cluster" || unit.unit_kind === "tower") && isOrganizationUnitInEffect(unit, today));
        if (units.length === 0) throw new Error("No active Cluster or Tower is available to receive this client.");
        setScopes(units);
        if (units.length === 1 && units[0]) setOrganizationUnitId(units[0].id);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) setSaveError(loadError instanceof Error ? loadError.message : "Unable to load operating scopes.");
      });
    return () => { cancelled = true; };
  }, [prototypeMode]);

  function update<K extends keyof QuickClientSetupInput>(key: K, value: QuickClientSetupInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors({});
    setSaveError(null);
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const found = quickClientSetupErrors(form, { prototypeMode });
    if (!prototypeMode && !organizationUnitId) {
      setSaveError("Choose the Cluster or Tower that will service this client.");
    }
    if (Object.keys(found).length > 0 || (!prototypeMode && !organizationUnitId)) {
      setErrors(found);
      return;
    }
    setSaving(true);
    const reference = form.crmNumber.trim().toUpperCase();
    try {
      if (prototypeMode) {
        const parsed = JSON.parse(window.localStorage.getItem(draftStorageKey) ?? "[]") as unknown;
        const existing = Array.isArray(parsed) ? parsed : [];
        const duplicate = existing.some((item) => {
          const client = item && typeof item === "object" ? (item as { client?: { clientReferenceCode?: unknown } }).client : undefined;
          return typeof client?.clientReferenceCode === "string" && client.clientReferenceCode.toUpperCase() === reference;
        });
        if (duplicate) throw new Error(`A setup already uses CRM number ${reference}.`);
        const draft = buildQuickClientSetupDraft(form, { createdAt: fixtureClock.label });
        window.localStorage.setItem(draftStorageKey, JSON.stringify([...existing, draft]));
        window.dispatchEvent(new Event(prototypeClientSetupUpdatedEvent));
      } else {
        const response = await fetch("/api/portfolio", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildQuickClientSetupRequest(form, { prototypeMode, organizationUnitId })),
        });
        const result = await response.json() as { error?: string; details?: string[] };
        if (!response.ok) throw new Error([result.error, ...(result.details ?? [])].filter(Boolean).join(" ") || "Unable to save the client.");
      }
      onSaved(reference);
    } catch (failure) {
      setSaveError(failure instanceof Error ? failure.message : "Unable to save the client.");
    } finally {
      setSaving(false);
    }
  }

  const fiscal = form.yearEndBasis === "Fiscal year";
  return <DetailDrawer eyebrow="Clients · quick setup" title="Add client" subtitle="Four answers decide what will be due. Everything else can be finished later." onClose={onClose}>
    <form className="form-stack quick-setup" data-usage-form="client_quick_setup" noValidate onSubmit={save}>
      <fieldset className="quick-setup__question">
        <legend><span className="quick-setup__number" aria-hidden="true">1</span>Which client?</legend>
        <div className="form-grid">
          <label className={errors.client && !form.clientName.trim() ? "form-field form-field--invalid" : "form-field"}><span>Client name *</span><input autoFocus autoComplete="off" onChange={(event) => update("clientName", event.target.value)} placeholder="Registered name" value={form.clientName} /></label>
          <label className={errors.client && form.clientName.trim() ? "form-field form-field--invalid" : "form-field"}><span>CRM no. *</span><input autoComplete="off" onChange={(event) => update("crmNumber", event.target.value)} placeholder="e.g. CRM-2026-001" value={form.crmNumber} /></label>
        </div>
        {errors.client && <small className="form-field__error" role="alert">{errors.client}</small>}
      </fieldset>

      <fieldset className="quick-setup__question">
        <legend><span className="quick-setup__number" aria-hidden="true">2</span>Which returns?</legend>
        <ReturnTaxSelector invalid={Boolean(errors.returns)} onChange={(codes) => update("returnCodes", codes)} selectedCodes={[...form.returnCodes]} />
        {errors.returns && errors.returns !== "Add at least one return." && <small className="form-field__error" role="alert">{errors.returns}</small>}
      </fieldset>

      <fieldset className="quick-setup__question">
        <legend><span className="quick-setup__number" aria-hidden="true">3</span>What year-end?</legend>
        <div className="quick-setup__choice" role="radiogroup" aria-label="Year-end basis">
          {(["Calendar year", "Fiscal year"] as const).map((basis) => <label className={form.yearEndBasis === basis ? "quick-setup__option quick-setup__option--on" : "quick-setup__option"} key={basis}>
            <input checked={form.yearEndBasis === basis} name="year-end-basis" onChange={() => { setForm((current) => ({ ...current, yearEndBasis: basis, fiscalYearEndMonth: basis === "Calendar year" ? "" : current.fiscalYearEndMonth, fiscalYearEndDay: basis === "Calendar year" ? "" : current.fiscalYearEndDay })); setErrors({}); }} type="radio" value={basis} />
            <span><strong>{basis}</strong><small>{basis === "Calendar year" ? "Ends December 31" : "Ends another month"}</small></span>
          </label>)}
        </div>
        {fiscal && <div className="form-grid form-grid--compact">
          <label className="form-field"><span>Year-end month *</span><select onChange={(event) => { setForm((current) => ({ ...current, fiscalYearEndMonth: event.target.value, fiscalYearEndDay: "" })); setErrors({}); }} value={form.fiscalYearEndMonth}><option value="">Month</option>{quickSetupMonths.map((month) => <option key={month}>{month}</option>)}</select></label>
          <label className="form-field"><span>Day *</span><select disabled={!form.fiscalYearEndMonth} onChange={(event) => update("fiscalYearEndDay", event.target.value)} value={form.fiscalYearEndDay}><option value="">Day</option>{Array.from({ length: quickSetupDayCount(form.fiscalYearEndMonth) }, (_, index) => String(index + 1)).map((day) => <option key={day}>{day}</option>)}</select></label>
        </div>}
        {errors.yearEnd && <small className="form-field__error" role="alert">{errors.yearEnd}</small>}
      </fieldset>

      <fieldset className="quick-setup__question">
        <legend><span className="quick-setup__number" aria-hidden="true">4</span>When do we start filing?</legend>
        <MonthYearPicker label="First month to file" onChange={(value) => update("firstPeriodToFile", value)} value={form.firstPeriodToFile} />
        <small className="form-help">The first period we file for. Earlier periods are not generated.</small>
        {errors.firstPeriod && <small className="form-field__error" role="alert">{errors.firstPeriod}</small>}
      </fieldset>

      <details className="quick-setup__more" open={!prototypeMode || Boolean(errors.fileLocation) || undefined}>
        <summary>{prototypeMode ? "Permanent file location (optional here)" : "Permanent file location *"}</summary>
        <label className={errors.fileLocation ? "form-field form-field--invalid" : "form-field"}><span>SharePoint link or shared-drive path</span><input autoComplete="off" onChange={(event) => update("fileLocation", event.target.value)} placeholder="https://…sharepoint.com/… or S:\Clients\…" value={form.fileLocation} /></label>
        {errors.fileLocation && <small className="form-field__error" role="alert">{errors.fileLocation}</small>}
        {!prototypeMode && scopes.length > 1 && <label className="form-field"><span>Serviced by *</span><select onChange={(event) => { setOrganizationUnitId(event.target.value); setSaveError(null); }} value={organizationUnitId}><option value="">Choose Cluster or Tower</option>{scopes.map((scope) => <option key={scope.id} value={scope.id}>{scope.name}</option>)}</select></label>}
      </details>

      <div className="drawer-form-note">Registration facts, operating setup and the source pack stay marked <strong>not configured</strong> until you finish the full setup. Work is generated only after Expected Compliance is reviewed and approved.</div>
      {saveError && <div className="form-error" role="alert">{saveError}</div>}
      <div className="onboarding-actions">
        <button className="button button--quiet" onClick={onOpenFullSetup} type="button">Use full setup instead</button>
        <div className="onboarding-actions__submit"><button className="button button--quiet" onClick={onClose} type="button">Cancel</button><button className="button button--primary" disabled={saving} type="submit">{saving ? "Saving…" : "Add client"}</button></div>
      </div>
    </form>
  </DetailDrawer>;
}

"use client";

import { useEffect, useState } from "react";

import { SectionHeading } from "./workspace-components";

type Item = {
  id: string;
  formNumber: string;
  status: "candidate" | "approved" | "excluded" | "unresolved" | "superseded";
  serviceScope: "in_scope" | "out_of_scope" | null;
  reason: string | null;
  pendingDecision: "in_scope" | "out_of_scope" | "not_applicable" | "unresolved" | null;
  pendingReason: string | null;
};

type Permissions = { canPropose: boolean; canApprove: boolean; canGenerate: boolean };
type Generation = { created: number; existing: number; skipped: { reason: string }[] };

const decisions = [
  { value: "in_scope", label: "Applicable · In TMF Scope" },
  { value: "out_of_scope", label: "Applicable · Out of TMF Scope" },
  { value: "not_applicable", label: "Not Applicable" },
  { value: "unresolved", label: "Requires review" },
] as const;

/** Status in words, never color alone. */
function itemLabel(item: Item) {
  if (item.status === "excluded") return { text: "Not Applicable", tone: "neutral" };
  if (item.status === "unresolved") return { text: "Requires review", tone: "unresolved" };
  const scope = item.serviceScope === "out_of_scope" ? "Out of TMF Scope" : "In TMF Scope";
  return item.status === "approved" ? { text: `Approved · ${scope}`, tone: item.serviceScope === "out_of_scope" ? "neutral" : "green" } : { text: `Proposed · ${scope}`, tone: "amber" };
}

function generationSummary(generation: Generation) {
  const skipped = generation.skipped.length;
  return `${generation.created} work item${generation.created === 1 ? "" : "s"} generated` +
    (generation.existing > 0 ? ` · ${generation.existing} already existed` : "") +
    (skipped > 0 ? ` · ${skipped} held back: ${[...new Set(generation.skipped.map((item) => item.reason))].join(" ")}` : "");
}

/**
 * Expected Compliance for the client's Registration Unit: proposed from the
 * validated Tax Profile, decided per return, approved per Registration Unit.
 * Approval generates the Compliance Work; generating again never duplicates.
 */
export function ExpectedComplianceSection({ clientId, registrationUnitId }: { clientId: string; registrationUnitId?: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [approval, setApproval] = useState<{ approvedAt: string; approvedBy: string } | null>(null);
  const [permissions, setPermissions] = useState<Permissions>({ canPropose: false, canApprove: false, canGenerate: false });
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { decision: string; reason: string }>>({});

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    const query = registrationUnitId ? `?registrationUnitId=${encodeURIComponent(registrationUnitId)}` : "";
    void fetch(`/api/clients/${encodeURIComponent(clientId)}/expected-compliance${query}`, { headers: { accept: "application/json" }, cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as { data?: { items: Item[]; latestApproval: { approvedAt: string; approvedBy: string } | null }; permissions?: Permissions; error?: string };
        if (!response.ok || !payload.data) throw new Error(payload.error ?? "Expected Compliance could not be loaded.");
        if (!active) return;
        setItems(payload.data.items);
        setApproval(payload.data.latestApproval);
        setPermissions(payload.permissions ?? { canPropose: false, canApprove: false, canGenerate: false });
        setState("ready");
      })
      .catch(() => {
        if (active) setState("error");
      });
    return () => {
      active = false;
    };
  }, [clientId, registrationUnitId, reloadKey]);

  async function command(body: Record<string, unknown>, success: (payload: Record<string, unknown>) => string): Promise<{ error?: string }> {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/clients/${encodeURIComponent(clientId)}/expected-compliance`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, registrationUnitId }) });
      const payload = await response.json() as Record<string, unknown> & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "The command could not be applied.");
      setMessage(success(payload));
      return {};
    } catch (error) {
      const text = error instanceof Error ? error.message : "The command could not be applied.";
      setMessage(text);
      return { error: text };
    } finally {
      setReloadKey((key) => key + 1);
      setBusy(false);
    }
  }

  async function approve() {
    const reason = window.prompt("Approval note (required):", "Expected Compliance reviewed against the validated Tax Profile")?.trim();
    if (!reason) return;
    const outcome = await command({ action: "approve", reason }, (payload) => `Approved. ${generationSummary(payload.generation as Generation)}.`);
    // Approving one's own decisions needs another approver, or a marked, audited Elevated Override.
    if (outcome.error?.includes("another approver") && window.confirm(`${outcome.error}\n\nApprove anyway as an Elevated Override? It is recorded and marked in the audit trail.`)) {
      await command({ action: "approve", reason, elevatedOverride: true }, (payload) => `Approved by Elevated Override. ${generationSummary(payload.generation as Generation)}.`);
    }
  }

  const proposed = items.filter((item) => item.status === "candidate" || item.pendingDecision).length;
  const approvedInScope = items.filter((item) => item.status === "approved" && item.serviceScope === "in_scope").length;

  return <section className="dossier-section" id="client-expected-compliance">
    <SectionHeading detail="What this Registration Unit is expected to file, and whether TMF handles it. Approval generates the work; generating again never duplicates." title="Expected Compliance" />
    {state === "loading" && <div className="inline-empty" role="status">Loading Expected Compliance…</div>}
    {state === "error" && <div className="inline-empty" role="alert">Expected Compliance could not be loaded. Refresh to try again.</div>}
    {state === "ready" && <>
      {items.length === 0 ? <div className="inline-empty">Nothing proposed yet. Propose from the validated Tax Profile&apos;s selected returns.</div>
        : <div className="dossier-facts dossier-facts--compact">{items.map((item) => {
          const label = itemLabel(item);
          const draft = drafts[item.id];
          return <div className="expected-compliance-row" key={item.id}>
            <div><strong>{item.formNumber}</strong> <span className={`status-pill status-pill--${label.tone}`}>{label.text}</span>{item.reason && <small className="status-label__detail"> · {item.reason}</small>}{item.pendingDecision && <small className="status-label__detail"> · Proposed change: {decisions.find((decision) => decision.value === item.pendingDecision)?.label}{item.pendingReason ? ` (${item.pendingReason})` : ""} — applies on approval</small>}</div>
            {permissions.canPropose && <div className="expected-compliance-row__decision">
              <select aria-label={`${item.formNumber} decision`} disabled={busy} onChange={(event) => setDrafts({ ...drafts, [item.id]: { decision: event.target.value, reason: draft?.reason ?? "" } })} value={draft?.decision ?? ""}>
                <option value="">Change decision…</option>
                {decisions.map((decision) => <option key={decision.value} value={decision.value}>{decision.label}</option>)}
              </select>
              {draft?.decision && (draft.decision === "out_of_scope" || draft.decision === "not_applicable") && <input aria-label={`${item.formNumber} reason`} onChange={(event) => setDrafts({ ...drafts, [item.id]: { ...draft, reason: event.target.value } })} placeholder="Reason (required)" value={draft.reason} />}
              {draft?.decision && <button className="text-button" disabled={busy} onClick={() => void command({ action: "decide", itemId: item.id, decision: draft.decision, reason: draft.reason }, () => `${item.formNumber}: change proposed. It applies when Expected Compliance is approved.`).then(() => setDrafts((current) => {
                const next = { ...current };
                delete next[item.id];
                return next;
              }))} type="button">Save</button>}
            </div>}
          </div>;
        })}</div>}
      <div className="dossier-section__footer">
        <div><span className="meta-label">Controlled action</span><strong>{approval ? `Approved by ${approval.approvedBy} · ${approval.approvedAt.slice(0, 10)}` : "Not yet approved"}</strong><small>{proposed > 0 ? `${proposed} proposed decision${proposed === 1 ? "" : "s"} waiting for approval.` : `${approvedInScope} return${approvedInScope === 1 ? "" : "s"} approved In TMF Scope.`}</small></div>
        <div className="dossier-section__actions">
          {permissions.canPropose && <button className="text-button" disabled={busy} onClick={() => void command({ action: "propose" }, (payload) => `${Number(payload.proposed ?? 0)} return${Number(payload.proposed ?? 0) === 1 ? "" : "s"} proposed from the Tax Profile.`)} type="button">Propose from profile</button>}
          {permissions.canGenerate && approvedInScope > 0 && <button className="text-button" disabled={busy} onClick={() => void command({ action: "generate" }, (payload) => `${generationSummary(payload.generation as Generation)}.`)} type="button">Generate work</button>}
          {permissions.canApprove && proposed > 0 && <button className="button button--primary button--small" disabled={busy} onClick={() => void approve()} type="button">Approve &amp; generate work</button>}
        </div>
      </div>
      {message && <div className="saved-notice" role="status">{message}</div>}
    </>}
  </section>;
}

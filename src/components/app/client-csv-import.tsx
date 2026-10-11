"use client";

import { useState } from "react";

import { clientOnboardingDocumentTypes, getClientOnboardingReadiness, type ClientOnboardingDocument } from "@/lib/domain/client-onboarding";
import { clientCsvTemplateHeaders, parseClientSetupCsv, type ClientCsvImportResult } from "@/lib/domain/client-csv-import";
import { fixtureClock } from "@/lib/fixtures";
import { DetailDrawer } from "./workspace-components";

const draftStorageKey = "taxmon.client.setup.drafts";

export function ClientCsvImportDrawer({ onClose, onImported }: { onClose: () => void; onImported: (message: string) => void }) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<ClientCsvImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function readFile(file: File) {
    setFileName(file.name);
    setError(null);
    try {
      setResult(parseClientSetupCsv(await file.text()));
    } catch {
      setResult(null);
      setError("The CSV could not be read. Check that it is a UTF-8 text file and try again.");
    }
  }

  function downloadTemplate() {
    const sample = [
      clientCsvTemplateHeaders.join(","),
      "CLIENT-2026-001,Cresthaven Consumer Products Inc.,ENTITY-2026-001,Cresthaven Consumer Products Inc.,000-123-456-000,RU-2026-001,Head Office,msa,MSA-2026-001,contract-source-001,2303-reference-001,manual_reference,Source reference only",
    ].join("\n");
    const url = URL.createObjectURL(new Blob([sample], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "taxmon-client-intake-template.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function saveDrafts() {
    if (!result || result.rows.length === 0) return;
    let existing: unknown[] = [];
    try {
      const parsed = JSON.parse(window.localStorage.getItem(draftStorageKey) ?? "[]") as unknown;
      existing = Array.isArray(parsed) ? parsed : [];
    } catch {
      existing = [];
    }

    const existingReferences = new Set(existing.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const client = (item as { client?: { clientReferenceCode?: unknown } }).client;
      return typeof client?.clientReferenceCode === "string" ? [client.clientReferenceCode.toUpperCase()] : [];
    }));
    const documents = (): ClientOnboardingDocument[] => clientOnboardingDocumentTypes.map(({ id }) => ({ type: id, status: "not_captured", sourceReference: "", notes: "" }));
    const newDrafts = result.rows.filter((row) => !existingReferences.has(row.identity.clientReferenceCode)).map((row) => {
      const rowDocuments = documents();
      return {
        version: 2,
        importSource: "csv_import",
        client: row.identity,
        contract: row.contract,
        registrationFacts: {
          rdoOrLts: "",
          registeredAddress: "",
          registrationReference: "",
          taxYearBasis: "",
          fiscalYearEnd: "",
          accountingSystem: "",
          registeredTaxTypes: "",
          filingChannel: "Not configured",
          eFPSGroup: "",
          sourceSystem: row.sourceSystem,
          sourceNotes: row.sourceNotes,
        },
        documents: rowDocuments,
        readiness: getClientOnboardingReadiness(row.identity, rowDocuments),
        status: "intake_pending",
        createdAt: fixtureClock.label,
      };
    });

    if (newDrafts.length > 0) window.localStorage.setItem(draftStorageKey, JSON.stringify([...existing, ...newDrafts]));
    const skipped = result.rows.length - newDrafts.length;
    onImported(`${newDrafts.length} intake draft${newDrafts.length === 1 ? "" : "s"} saved${skipped > 0 ? ` · ${skipped} existing reference${skipped === 1 ? "" : "s"} skipped` : ""}. Complete source review before activation.`);
  }

  const validCount = result?.rows.length ?? 0;
  const errorCount = result?.errors.length ?? 0;
  return (
    <DetailDrawer eyebrow="Client registry · controlled intake" title="Import client CSV" subtitle="Load identity and source references into intake drafts. This does not activate profiles or generate compliance work." onClose={onClose}>
      <div className="form-stack client-csv-import">
        <div className="drawer-section-intro"><strong>Use the client intake template</strong><span>Export the CRM data to this CSV shape first. Extra CRM columns are ignored; required identity and source fields are validated before anything is saved. Registration facts, documents, assignment, and Tax Profile validation remain controlled follow-up steps.</span></div>
        <div className="client-csv-import__actions"><button className="button button--quiet button--small" onClick={downloadTemplate} type="button">Download template</button><label className="button button--quiet button--small client-csv-import__file"><span>Choose CSV</span><input accept=".csv,text/csv" onChange={(event) => { const file = event.target.files?.[0]; if (file) void readFile(file); }} type="file" /></label></div>
        {fileName && <div className="drawer-form-note">Selected: <strong>{fileName}</strong></div>}
        {error && <div className="form-error" role="alert">{error}</div>}
        {result && <>
          <div className="client-csv-import__summary" role="status"><strong>{validCount} valid row{validCount === 1 ? "" : "s"}</strong><span>{errorCount} issue{errorCount === 1 ? "" : "s"}</span>{result.ignoredHeaders.length > 0 && <span>{result.ignoredHeaders.length} extra column{result.ignoredHeaders.length === 1 ? "" : "s"} ignored</span>}</div>
          {result.errors.length > 0 && <div className="client-csv-import__errors"><strong>Rows needing correction</strong>{result.errors.slice(0, 8).map((item, index) => <span key={`${item.rowNumber ?? "file"}-${item.field ?? "general"}-${index}`}>{item.rowNumber ? `Row ${item.rowNumber}` : "File"}{item.field ? ` · ${item.field}` : ""}: {item.message}</span>)}{result.errors.length > 8 && <span>+ {result.errors.length - 8} more issue{result.errors.length - 8 === 1 ? "" : "s"}</span>}</div>}
          {result.rows.length > 0 && <div className="taxpayer-register client-csv-import__preview" role="region" aria-label="Client CSV preview" tabIndex={0}><table className="taxpayer-table"><thead><tr><th>Row</th><th>Client</th><th>Entity</th><th>Unit</th><th>Contract</th><th>Source</th></tr></thead><tbody>{result.rows.slice(0, 12).map((row) => <tr key={row.rowNumber}><td>{row.rowNumber}</td><td><strong>{row.identity.clientDisplayName}</strong><small>{row.identity.clientReferenceCode}</small></td><td>{row.identity.entityDisplayName}<small>{row.identity.entityReferenceCode}</small></td><td>{row.identity.unitDisplayName}<small>{row.identity.unitKind}</small></td><td>{row.contract.recordType}<small>{row.contract.referenceCode || "Not recorded"}</small></td><td>{row.identity.sourceReference}<small>{row.sourceSystem}</small></td></tr>)}</tbody></table>{result.rows.length > 12 && <div className="inline-empty">Showing the first 12 valid rows. All valid rows will be saved as drafts.</div>}</div>}
          <button className="button button--primary" disabled={validCount === 0} onClick={saveDrafts} type="button">Save {validCount} valid intake draft{validCount === 1 ? "" : "s"}</button>
        </>}
        <div className="drawer-form-note">CSV import is intentionally an intake convenience, not a bulk activation route. No source document is uploaded through this control.</div>
      </div>
    </DetailDrawer>
  );
}

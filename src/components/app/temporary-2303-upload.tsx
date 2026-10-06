"use client";

import { useState } from "react";

import { temporary2303MaxBytes, validateTemporaryDocumentMetadata } from "@/lib/domain/temporary-document";

type UploadState = "idle" | "uploading" | "uploaded" | "queued" | "failed";

export function Temporary2303Upload({ registrationUnitId, dataMode = "sanitized", demoMode = false }: { registrationUnitId?: string; dataMode?: string; demoMode?: boolean }) {
  const [file, setFile] = useState<File | null>(null);
  const sanitizedOnly = dataMode !== "production";
  const [sourceReference, setSourceReference] = useState(demoMode || sanitizedOnly ? "synthetic-2303-upload" : "");
  const [sourceSystem, setSourceSystem] = useState<"sharepoint" | "synthetic_fixture" | "manual_reference">(sanitizedOnly ? "synthetic_fixture" : "manual_reference");
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const [state, setState] = useState<UploadState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [documentId, setDocumentId] = useState<string | null>(null);

  async function upload() {
    if (!file) {
      setMessage("Choose a PDF, JPEG, PNG, or TIFF source first.");
      return;
    }
    if (!sourceReference.trim()) {
      setMessage("Add the human-controlled source reference before uploading.");
      return;
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const requestKey = idempotencyKey ?? window.crypto.randomUUID();
    if (!idempotencyKey) setIdempotencyKey(requestKey);
    const errors = validateTemporaryDocumentMetadata({
      originalFilename: file.name,
      contentType: file.type,
      byteSize: file.size,
      idempotencyKey: requestKey,
      sourceReference: sourceReference.trim(),
      sourceSystem,
    }, bytes);
    if (errors.length > 0) {
      setMessage(errors[0]);
      return;
    }

    setMessage(null);
    setState("uploading");
    if (demoMode) {
      setState("uploaded");
      setMessage("Uploaded to a temporary sanitized fixture boundary. No document was persisted by this demo.");
      return;
    }
    if (!registrationUnitId) {
      setState("failed");
      setMessage("A connected Registration Unit context is required before a document can be persisted.");
      return;
    }

    const form = new FormData();
    form.set("file", file);
    form.set("sourceReference", sourceReference.trim());
    form.set("sourceSystem", sourceSystem);
    form.set("idempotencyKey", requestKey);
    const response = await fetch(`/api/registration-units/${registrationUnitId}/temporary-2303`, { method: "POST", body: form });
    const result = await response.json() as { data?: { id?: string }; error?: string; details?: string[] };
    if (!response.ok) {
      setState("failed");
      setMessage(result.details?.[0] ?? result.error ?? "The temporary upload could not be completed.");
      return;
    }
    setDocumentId(result.data?.id ?? null);
    setState("uploaded");
    setMessage("Uploaded privately. The source is ready for the processing command.");
  }

  async function queueProcessing() {
    if (!documentId) {
      setState("queued");
      setMessage("Processing is represented as queued in this sanitized fixture. Provider execution belongs to the next slice.");
      return;
    }
    const response = await fetch(`/api/temporary-2303/${documentId}/process`, { method: "POST" });
    const result = await response.json() as { error?: string };
    if (!response.ok) {
      setState("failed");
      setMessage(result.error ?? "The processing command could not be queued.");
      return;
    }
    setState("queued");
    setMessage("Processing queued. Extraction results will remain separate from Tax Profile activation.");
  }

  return <div className="temporary-upload">
    <div className="temporary-upload__callout">
      <strong>Temporary source boundary</strong>
      <span>Private processing copy only. Permanent document retention and SharePoint remain outside this upload step.</span>
    </div>
    <label className="form-field"><span>Source reference</span><input onChange={(event) => setSourceReference(event.target.value)} placeholder="e.g. approved reference or synthetic fixture" value={sourceReference} /></label>
    <label className="form-field"><span>Source system</span><select disabled={sanitizedOnly} onChange={(event) => setSourceSystem(event.target.value as typeof sourceSystem)} value={sourceSystem}><option value="synthetic_fixture">Synthetic fixture</option>{!sanitizedOnly && <><option value="manual_reference">Manual reference</option><option value="sharepoint">SharePoint reference</option></>}</select></label>
    <label className="form-field"><span>2303 file</span><input accept="application/pdf,image/jpeg,image/png,image/tiff" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setIdempotencyKey(null); setDocumentId(null); setState("idle"); setMessage(null); }} type="file" /></label>
    <small className="temporary-upload__limit">PDF, JPEG, PNG, or TIFF · up to {Math.round(temporary2303MaxBytes / (1024 * 1024))} MB · file content is checked against its declared type.</small>
    {file && <div className="temporary-upload__selected"><strong>{file.name}</strong><span>{Math.ceil(file.size / 1024)} KB · {file.type || "type not declared"}</span></div>}
    {message && <div className={state === "failed" ? "form-error" : "saved-notice"} role={state === "failed" ? "alert" : "status"}>{message}</div>}
    <div className="source-review__actions"><button className="button button--primary" disabled={state === "uploading"} onClick={upload} type="button">{state === "uploading" ? "Uploading…" : "Upload temporary copy"}</button>{state === "uploaded" && <button className="button button--quiet" onClick={queueProcessing} type="button">Queue processing</button>}</div>
    {state === "queued" && <p className="temporary-upload__note">The job boundary is ready for the normalized extraction provider slice. No extracted value or tax decision was created here.</p>}
  </div>;
}

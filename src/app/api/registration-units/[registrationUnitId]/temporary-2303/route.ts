import { NextResponse } from "next/server";

import { temporary2303MaxBytes, temporaryDocumentContentTypes, uuidPattern, validateTemporaryDocumentMetadata } from "@/lib/domain/temporary-document";
import {
  completeTemporary2303Upload,
  createTemporary2303Document,
  failTemporary2303Upload,
  uploadTemporary2303Object,
} from "@/lib/server/portfolio-repository";
import { getAuthenticatedUser } from "@/lib/supabase/server";

export async function POST(request: Request, { params }: { params: Promise<{ registrationUnitId: string }> }) {
  if (!await getAuthenticatedUser()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { registrationUnitId } = await params;
  if (!uuidPattern.test(registrationUnitId)) return NextResponse.json({ error: "A valid Registration Unit is required." }, { status: 400 });
  const form = await request.formData();
  const file = form.get("file");
  const sourceReference = form.get("sourceReference");
  const sourceSystem = form.get("sourceSystem");
  const idempotencyKey = form.get("idempotencyKey");

  if (!(file instanceof File)) return NextResponse.json({ error: "A source file is required." }, { status: 400 });
  if (typeof sourceReference !== "string" || typeof sourceSystem !== "string" || typeof idempotencyKey !== "string") {
    return NextResponse.json({ error: "Source reference, source system, and idempotency key are required." }, { status: 400 });
  }

  // Reject obviously invalid uploads before buffering the body in memory.
  // The full signature/content validation still runs below.
  if (!temporaryDocumentContentTypes.includes(file.type as typeof temporaryDocumentContentTypes[number])) {
    return NextResponse.json({ error: "Only PDF, JPEG, PNG, and TIFF files are accepted." }, { status: 400 });
  }
  if (!Number.isSafeInteger(file.size) || file.size <= 0 || file.size > temporary2303MaxBytes) {
    return NextResponse.json({ error: "The file exceeds the temporary 2303 upload limit or is empty." }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const errors = validateTemporaryDocumentMetadata({
    originalFilename: file.name,
    contentType: file.type,
    byteSize: file.size,
    idempotencyKey,
    sourceReference,
    sourceSystem: sourceSystem as "sharepoint" | "synthetic_fixture" | "manual_reference",
  }, bytes);
  if (errors.length > 0) return NextResponse.json({ error: "Invalid temporary 2303 upload.", details: errors }, { status: 400 });

  if (process.env.TAXMON_DATA_MODE !== "production" && sourceSystem !== "synthetic_fixture") {
    return NextResponse.json({ error: "Only synthetic fixture uploads are enabled in this environment." }, { status: 403 });
  }

  let documentId: string | undefined;
  try {
    const document = await createTemporary2303Document({
      registrationUnitId,
      sourceSystem: sourceSystem as "sharepoint" | "synthetic_fixture" | "manual_reference",
      sourceReference,
      originalFilename: file.name,
      contentType: file.type,
      byteSize: file.size,
      idempotencyKey,
    });
    documentId = document.id;

    if (document.status === "uploaded" || document.status === "processing_queued") {
      return NextResponse.json({ data: document, reused: true });
    }

    await uploadTemporary2303Object({
      storageBucket: document.storageBucket ?? "taxmon-temporary-2303",
      storagePath: document.storagePath ?? "",
      file,
      contentType: file.type,
    });
    const completed = await completeTemporary2303Upload(document.id);
    return NextResponse.json({ data: completed, reused: document.reused === true });
  } catch (error) {
    if (documentId) {
      try { await failTemporary2303Upload(documentId, "storage_upload_failed"); } catch { /* preserve the original safe response */ }
    }
    const message = error instanceof Error ? error.message : "Unable to upload the temporary document.";
    const status = message.includes("not authorized") ? 403 : message.includes("no longer available for retry") ? 409 : 500;
    return NextResponse.json({ error: status === 500 ? "Unable to upload the temporary document." : message }, { status });
  }
}

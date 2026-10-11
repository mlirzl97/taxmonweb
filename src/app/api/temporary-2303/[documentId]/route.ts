import { NextResponse } from "next/server";

import {
  createTemporary2303SignedUrl,
  getTemporary2303Document,
} from "@/lib/server/temporary-document-repository";
import { apiErrorResponse, inferredApiErrorStatus } from "@/lib/server/api-error";
import { requireApiCapability } from "@/lib/server/api-authorization";
import { uuidPattern } from "@/lib/domain/temporary-document";

export async function GET(_request: Request, { params }: { params: Promise<{ documentId: string }> }) {
  const denied = await requireApiCapability(["ReviewTaxProfile", "CorrectTaxProfile", "MaintainClientRepository"]);
  if (denied) return denied;

  try {
    const { documentId } = await params;
    if (!uuidPattern.test(documentId)) return NextResponse.json({ error: "A valid temporary document is required." }, { status: 400 });
    const document = await getTemporary2303Document(documentId);
    if (!document) return NextResponse.json({ error: "Temporary document not found." }, { status: 404 });
    const signedUrl = await createTemporary2303SignedUrl(document);
    return NextResponse.json({ data: { ...document, signedUrl } });
  } catch (error) {
    return apiErrorResponse(error, "Unable to load the temporary document.", { status: inferredApiErrorStatus(error), logContext: "load temporary document" });
  }
}

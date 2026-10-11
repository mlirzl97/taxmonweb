import { NextResponse } from "next/server";

import { queueTemporary2303Processing } from "@/lib/server/temporary-document-repository";
import { apiErrorResponse, inferredApiErrorStatus } from "@/lib/server/api-error";
import { requireApiCapability } from "@/lib/server/api-authorization";
import { uuidPattern } from "@/lib/domain/temporary-document";
import { requireSameOrigin } from "@/lib/server/request-origin";

export async function POST(request: Request, { params }: { params: Promise<{ documentId: string }> }) {
  const denied = await requireApiCapability(["CorrectTaxProfile", "MaintainClientRepository"]);
  if (denied) return denied;
  const originDenied = requireSameOrigin(request);
  if (originDenied) return originDenied;

  try {
    const { documentId } = await params;
    if (!uuidPattern.test(documentId)) return NextResponse.json({ error: "A valid temporary document is required." }, { status: 400 });
    const data = await queueTemporary2303Processing(documentId);
    return NextResponse.json({ data });
  } catch (error) {
    return apiErrorResponse(error, "Unable to queue temporary document processing.", { status: inferredApiErrorStatus(error), logContext: "queue temporary document processing" });
  }
}

import { NextResponse } from "next/server";

import { queueTemporary2303Processing } from "@/lib/server/portfolio-repository";
import { uuidPattern } from "@/lib/domain/temporary-document";
import { getAuthenticatedUser } from "@/lib/supabase/server";

export async function POST(_request: Request, { params }: { params: Promise<{ documentId: string }> }) {
  if (!await getAuthenticatedUser()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { documentId } = await params;
    if (!uuidPattern.test(documentId)) return NextResponse.json({ error: "A valid temporary document is required." }, { status: 400 });
    const data = await queueTemporary2303Processing(documentId);
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to queue temporary document processing.";
    const status = message.includes("not authorized") ? 403 : message.includes("Only an uploaded") ? 409 : 500;
    return NextResponse.json({ error: status === 500 ? "Unable to queue temporary document processing." : message }, { status });
  }
}

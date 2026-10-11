import { NextResponse } from "next/server";

import {
  createTemporary2303SignedUrl,
  getTemporary2303Document,
} from "@/lib/server/temporary-document-repository";
import { uuidPattern } from "@/lib/domain/temporary-document";
import { getAuthenticatedUser } from "@/lib/supabase/server";

export async function GET(_request: Request, { params }: { params: Promise<{ documentId: string }> }) {
  if (!await getAuthenticatedUser()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { documentId } = await params;
    if (!uuidPattern.test(documentId)) return NextResponse.json({ error: "A valid temporary document is required." }, { status: 400 });
    const document = await getTemporary2303Document(documentId);
    if (!document) return NextResponse.json({ error: "Temporary document not found." }, { status: 404 });
    const signedUrl = await createTemporary2303SignedUrl(document);
    return NextResponse.json({ data: { ...document, signedUrl } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load the temporary document.";
    return NextResponse.json({ error: message.includes("not authorized") ? message : "Unable to load the temporary document." }, { status: message.includes("not authorized") ? 403 : 500 });
  }
}

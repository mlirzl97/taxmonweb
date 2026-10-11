import { NextResponse } from "next/server";

import { isAuthorizedPurgeRequest, purgeEligibleTemporary2303Documents } from "@/lib/server/temporary-document-purge";

export async function GET(request: Request) {
  if (!isAuthorizedPurgeRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const result = await purgeEligibleTemporary2303Documents();
    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("[purge] temporary 2303 cleanup failed", error);
    return NextResponse.json({ error: "Temporary document cleanup is unavailable." }, { status: 503 });
  }
}

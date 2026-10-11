import { NextResponse } from "next/server";

import { isTaxTeamReviewInput, listPersistedTaxTeamReviews, savePersistedTaxTeamReview } from "@/lib/server/tax-team-review-repository";
import { apiErrorResponse, inferredApiErrorStatus } from "@/lib/server/api-error";
import { requireApiCapability } from "@/lib/server/api-authorization";
import { requireSameOrigin } from "@/lib/server/request-origin";

export async function GET() {
  const denied = await requireApiCapability(["ViewTaxControlHistory", "ValidateTaxProfile"]);
  if (denied) return denied;
  try {
    return NextResponse.json({ data: await listPersistedTaxTeamReviews() });
  } catch (error) {
    return apiErrorResponse(error, "Unable to load Tax Team transaction reviews.", { logContext: "load Tax Team transaction reviews" });
  }
}

export async function POST(request: Request) {
  const denied = await requireApiCapability(["ValidateTaxProfile"]);
  if (denied) return denied;
  const originDenied = requireSameOrigin(request);
  if (originDenied) return originDenied;
  let input: unknown;
  try { input = await request.json(); } catch { return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 }); }
  if (!input || typeof input !== "object") return NextResponse.json({ error: "A transaction review is required." }, { status: 400 });
  try {
    if (!isTaxTeamReviewInput(input)) return NextResponse.json({ error: "The transaction review is incomplete or invalid." }, { status: 400 });
    const data = await savePersistedTaxTeamReview(input);
    return NextResponse.json({ data });
  } catch (error) {
    return apiErrorResponse(error, "Unable to save Tax Team transaction review.", { status: inferredApiErrorStatus(error, 422), logContext: "save Tax Team transaction review" });
  }
}

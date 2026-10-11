import { NextResponse } from "next/server";

import { listPersistedTaxTeamReviews, savePersistedTaxTeamReview } from "@/lib/server/tax-team-review-repository";
import { getAuthenticatedUser } from "@/lib/supabase/server";

export async function GET() {
  if (!(await getAuthenticatedUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({ data: await listPersistedTaxTeamReviews() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load Tax Team transaction reviews." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!(await getAuthenticatedUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let input: unknown;
  try { input = await request.json(); } catch { return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 }); }
  if (!input || typeof input !== "object") return NextResponse.json({ error: "A transaction review is required." }, { status: 400 });
  try {
    const data = await savePersistedTaxTeamReview(input as Parameters<typeof savePersistedTaxTeamReview>[0]);
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save Tax Team transaction review.";
    return NextResponse.json({ error: message }, { status: /authorized|authentication/i.test(message) ? 403 : 422 });
  }
}

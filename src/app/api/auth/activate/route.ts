import { NextResponse } from "next/server";

import { apiErrorResponse, inferredApiErrorStatus } from "@/lib/server/api-error";
import { requireSameOrigin } from "@/lib/server/request-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const originDenied = requireSameOrigin(request);
  if (originDenied) return originDenied;

  const client = await createSupabaseServerClient();
  if (!client) return NextResponse.json({ error: "Authentication is not configured." }, { status: 503 });

  try {
    const { data, error } = await client.rpc("activate_staff_account");
    if (error) throw new Error(error.message);
    return NextResponse.json({ data });
  } catch (error) {
    return apiErrorResponse(error, "This account is not ready for activation.", { status: inferredApiErrorStatus(error, 409), logContext: "activate staff account" });
  }
}

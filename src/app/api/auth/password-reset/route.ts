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
    const { data, error } = await client.rpc("record_password_reset");
    if (error) throw new Error(error.message);
    return NextResponse.json({ data });
  } catch (error) {
    return apiErrorResponse(error, "Password reset could not be recorded.", { status: inferredApiErrorStatus(error), logContext: "record password reset" });
  }
}

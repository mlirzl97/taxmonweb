import { NextResponse } from "next/server";

import { applicationOrigin } from "@/lib/server/request-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function safeNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/app/control-tower";
  return value;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = `${applicationOrigin(request)}/`;
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));
  const client = await createSupabaseServerClient();

  if (!client || !code) {
    return NextResponse.redirect(new URL("/login?error=activation", origin));
  }

  const { error } = await client.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL("/login?error=activation", origin));
  }

  return NextResponse.redirect(new URL(next, origin));
}

import { NextResponse } from "next/server";

import { createSupabaseServerClient, getAuthenticatedUser } from "@/lib/supabase/server";

export async function GET() {
  const user = await getAuthenticatedUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = await createSupabaseServerClient();

  if (!client) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const [capabilities, scopes] = await Promise.all([
    client
      .from("user_capability_assignments")
      .select("capability_key, effective_from, effective_to")
      .eq("user_id", user.id)
      .order("capability_key"),
    client
      .from("user_scope_assignments")
      .select("scope_kind, organization_unit_id, effective_from, effective_to")
      .eq("user_id", user.id)
      .order("scope_kind"),
  ]);

  if (capabilities.error || scopes.error) {
    return NextResponse.json({ error: "Unable to load effective access assignments." }, { status: 500 });
  }

  return NextResponse.json({
    userId: user.id,
    email: user.email ?? null,
    capabilities: capabilities.data ?? [],
    scopes: scopes.data ?? [],
  });
}

import { NextResponse } from "next/server";

import { adaptLiveGeneratedWork } from "@/lib/domain/live-work-adapter";
import { listLiveGeneratedWork } from "@/lib/server/generated-work-repository";
import { createSupabaseServerClient, getAuthenticatedUser } from "@/lib/supabase/server";
import { isPrototypeDemoMode } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

const workReadCapabilities = ["ViewAssignedWork", "ViewScopedPortfolio", "ViewTaxControlHistory"] as const;

export async function GET() {
  if (isPrototypeDemoMode()) return NextResponse.json({ data: [], source: "prototype-disabled", fixtureSafe: true });

  const user = await getAuthenticatedUser();
  const client = await createSupabaseServerClient();
  if (!user || !client) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const capabilityResults = await Promise.all(workReadCapabilities.map((capability) => client.rpc("has_active_capability", { required_capability: capability })));
  if (!capabilityResults.some((result) => !result.error && result.data === true)) {
    return NextResponse.json({ error: "Work access is not configured for this user." }, { status: 403 });
  }

  try {
    const records = await listLiveGeneratedWork();
    const userIds = [...new Set(records.flatMap((record) => [record.preparer_user_id, record.checker_user_id, record.reviewer_user_id, record.current_owner_user_id]).filter((id): id is string => Boolean(id)))];
    const { data: users, error: usersError } = userIds.length > 0
      ? await client.from("app_users").select("id, display_name").in("id", userIds)
      : { data: [], error: null };
    if (usersError) throw new Error(`Unable to load work owners: ${usersError.message}`);
    const names = new Map((users ?? []).map((record) => [record.id, record.display_name]));
    return NextResponse.json({ data: records.map((record) => adaptLiveGeneratedWork(record, names)), source: "generated_compliance_work", fixtureSafe: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load generated compliance work." }, { status: 503 });
  }
}

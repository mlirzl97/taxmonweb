import { createSupabaseServerClient } from "@/lib/supabase/server";

export type LiveTeamMember = {
  id: string;
  name: string;
  active: boolean;
  reportsToUserId: string | null;
  roleKey: string | null;
  title: string | null;
  organizationUnitId: string | null;
  organizationUnitCode: string | null;
  organizationUnitName: string | null;
  organizationUnitKind: string | null;
  careerServiceLevel: string | null;
  operatingModel: "engagement_agile" | "engagement_dedicated" | "tax_team";
  reportingLineExceptionReason: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
};

export async function listLiveTeamMembers(): Promise<LiveTeamMember[]> {
  const client = await createSupabaseServerClient();
  if (!client) throw new Error("Supabase is not configured for this environment.");

  const [{ data: users, error: usersError }, { data: profiles, error: profilesError }] = await Promise.all([
    client.from("app_users").select("id, display_name, is_active, account_status").order("display_name"),
    client.from("team_member_profiles").select("user_id, role_key, title, organization_unit_id, effective_from, effective_to, active, career_service_level, reports_to_user_id, operating_model, reporting_line_exception_reason, organization_units(id, code, name, unit_kind)"),
  ]);

  if (usersError) throw new Error(`Unable to load people: ${usersError.message}`);
  if (profilesError) throw new Error(`Unable to load team profiles: ${profilesError.message}`);

  const profileByUser = new Map((profiles ?? []).map((profile) => {
    const unit = Array.isArray(profile.organization_units) ? profile.organization_units[0] : profile.organization_units;
    return [profile.user_id, { ...profile, unit }] as const;
  }));

  return (users ?? []).map((user) => {
    const profile = profileByUser.get(user.id);
    return {
      id: user.id,
      name: user.display_name,
      active: user.is_active && user.account_status === "active" && (profile?.active ?? true),
      reportsToUserId: profile?.reports_to_user_id ?? null,
      roleKey: profile?.role_key ?? null,
      title: profile?.title ?? null,
      organizationUnitId: profile?.organization_unit_id ?? null,
      organizationUnitCode: profile?.unit?.code ?? null,
      organizationUnitName: profile?.unit?.name ?? null,
      organizationUnitKind: profile?.unit?.unit_kind ?? null,
      careerServiceLevel: profile?.career_service_level ?? null,
      operatingModel: profile?.operating_model === "engagement_dedicated" || profile?.operating_model === "tax_team" ? profile.operating_model : "engagement_agile",
      reportingLineExceptionReason: profile?.reporting_line_exception_reason ?? null,
      effectiveFrom: profile?.effective_from ?? null,
      effectiveTo: profile?.effective_to ?? null,
    } satisfies LiveTeamMember;
  });
}

export type SaveLiveTeamMemberProfileInput = {
  userId: string;
  roleKey: "system_admin" | "leader" | "team_member" | "reviewer";
  title: string;
  organizationUnitId: string;
  effectiveFrom: string;
  active: boolean;
  careerServiceLevel: string | null;
  reportsToUserId: string | null;
  operatingModel: "engagement_agile" | "engagement_dedicated" | "tax_team";
  reportingLineExceptionReason: string | null;
};

export async function saveLiveTeamMemberProfile(input: SaveLiveTeamMemberProfileInput) {
  const client = await createSupabaseServerClient();
  if (!client) throw new Error("Supabase is not configured for this environment.");

  const { data, error } = await client.rpc("save_team_member_profile", {
    p_user_id: input.userId,
    p_role_key: input.roleKey,
    p_title: input.title,
    p_organization_unit_id: input.organizationUnitId,
    p_effective_from: input.effectiveFrom,
    p_active: input.active,
    p_career_service_level: input.careerServiceLevel,
    p_reports_to_user_id: input.reportsToUserId,
    p_operating_model: input.operatingModel,
    p_reporting_line_exception_reason: input.reportingLineExceptionReason,
  });
  if (error) throw new Error(`Unable to save the Team profile: ${error.message}`);
  return data as Record<string, unknown>;
}

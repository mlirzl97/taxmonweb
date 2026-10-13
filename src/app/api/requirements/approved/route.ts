import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/server/api-error";
import { requireApiCapability } from "@/lib/server/api-authorization";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type RequirementRow = {
  id: string;
  requirement_code: string;
  requirement_name: string;
  operating_category: string;
  frequency_label: string;
  status: string;
  effective_from: string | null;
  effective_to: string | null;
};

type VersionRow = {
  requirement_id: string;
  version_label: string;
  effective_from: string;
  effective_to: string | null;
  status: string;
};

function isEffective(row: { effective_from: string | null; effective_to: string | null }, today: string) {
  return (!row.effective_from || row.effective_from <= today) && (!row.effective_to || row.effective_to >= today);
}

/**
 * The Add Work control is intentionally backed by the governed Requirement
 * Master. It must never become a free-text list of tax returns.
 */
export async function GET() {
  const denied = await requireApiCapability(["MaintainGeneratedComplianceWork"]);
  if (denied) return denied;

  try {
    const client = await createSupabaseServerClient();
    if (!client) return NextResponse.json({ error: "Supabase is not configured for this environment." }, { status: 503 });

    const today = new Date().toISOString().slice(0, 10);
    const [{ data: requirements, error: requirementsError }, { data: versions, error: versionsError }] = await Promise.all([
      client
        .from("bir_requirements")
        .select("id, requirement_code, requirement_name, operating_category, frequency_label, status, effective_from, effective_to")
        .eq("status", "active")
        .order("requirement_code"),
      client
        .from("bir_requirement_versions")
        .select("requirement_id, version_label, effective_from, effective_to, status")
        .eq("status", "approved")
        .order("effective_from", { ascending: false }),
    ]);
    if (requirementsError) throw new Error(`Unable to load approved BIR requirements: ${requirementsError.message}`);
    if (versionsError) throw new Error(`Unable to load approved BIR requirement versions: ${versionsError.message}`);

    const approvedVersionByRequirement = new Map<string, VersionRow>();
    for (const version of (versions ?? []) as VersionRow[]) {
      if (isEffective(version, today) && !approvedVersionByRequirement.has(version.requirement_id)) approvedVersionByRequirement.set(version.requirement_id, version);
    }

    const data = ((requirements ?? []) as RequirementRow[])
      .filter((requirement) => isEffective(requirement, today) && approvedVersionByRequirement.has(requirement.id))
      .map((requirement) => ({
        code: requirement.requirement_code,
        name: requirement.requirement_name,
        operatingCategory: requirement.operating_category,
        frequency: requirement.frequency_label,
        version: approvedVersionByRequirement.get(requirement.id)?.version_label,
      }));

    return NextResponse.json({ data, source: "bir_requirement_master", fixtureSafe: true });
  } catch (error) {
    return apiErrorResponse(error, "Unable to load the approved requirement pool.", { status: 503, logContext: "load approved requirements" });
  }
}

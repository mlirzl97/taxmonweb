import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { TaxProfilePersistencePayload } from "@/lib/domain/client-profile-persistence";

export async function saveTaxProfileVersion(clientReferenceCode: string, input: TaxProfilePersistencePayload) {
  const client = await createSupabaseServerClient();
  if (!client) throw new Error("Supabase is not configured for this environment.");

  const { data, error } = await client.rpc("save_tax_profile_version", {
    p_client_reference_code: clientReferenceCode,
    p_profile_data: input.profile,
    p_assignment_data: input.assignment,
    p_effective_from: input.effectiveFrom,
    p_reason: input.reason,
  });
  if (error) throw new Error(`Unable to save the Tax Profile version: ${error.message}`);
  return data;
}

export async function validateTaxProfileVersion(versionId: string, reason: string) {
  const client = await createSupabaseServerClient();
  if (!client) throw new Error("Supabase is not configured for this environment.");

  const { data, error } = await client.rpc("validate_tax_profile_version", {
    p_tax_profile_version_id: versionId,
    p_reason: reason,
  });
  if (error) throw new Error(`Unable to validate the Tax Profile: ${error.message}`);
  return data;
}

export async function getLatestTaxProfileVersion(clientReferenceCode: string) {
  const client = await createSupabaseServerClient();
  if (!client) throw new Error("Supabase is not configured for this environment.");

  const { data, error } = await client.rpc("get_latest_tax_profile_version", {
    p_client_reference_code: clientReferenceCode,
  });
  if (error) throw new Error(`Unable to load the saved Tax Profile: ${error.message}`);
  return data as {
    clientFound: boolean;
    data: {
      id: string;
      state: "draft" | "ready_for_validation" | "active" | "superseded";
      effectiveFrom: string;
      versionNumber: number;
      profile: Record<string, unknown>;
      assignment: Record<string, unknown>;
      createdAt: string;
      validatedAt: string | null;
      validatedBy: string | null;
      changeReason: string;
    } | null;
  };
}

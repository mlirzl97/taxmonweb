import { createSupabaseServerClient } from "@/lib/supabase/server";

export type BirOfficeReference = {
  code: string;
  name: string;
  officeType: "rdo" | "revenue_region" | "lts" | "lt_office" | "other";
  parentCode: string | null;
  parentName: string | null;
};

export async function listBirOfficeReference(): Promise<BirOfficeReference[]> {
  const client = await createSupabaseServerClient();
  if (!client) return [];

  const { data, error } = await client
    .from("bir_offices")
    .select(`
      official_code,
      official_name,
      office_type,
      parent:parent_office_id (official_code, official_name)
    `)
    .eq("status", "active")
    .in("verification_status", ["verified", "partially_verified"])
    .order("office_type")
    .order("official_code");

  if (error) throw new Error(`Unable to load the BIR office reference: ${error.message}`);

  return (data ?? []).map((row) => {
    const parent = Array.isArray(row.parent) ? row.parent[0] : row.parent;
    return {
      code: row.official_code,
      name: row.official_name,
      officeType: row.office_type,
      parentCode: parent?.official_code ?? null,
      parentName: parent?.official_name ?? null,
    } as BirOfficeReference;
  });
}

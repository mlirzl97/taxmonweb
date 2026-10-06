import { createSupabaseServerClient } from "@/lib/supabase/server";

export type BirOfficeReference = {
  code: string;
  name: string;
  officeType: "rdo" | "revenue_region" | "lts" | "lt_office" | "other";
  parentCode: string | null;
  parentName: string | null;
  address: string | null;
  cityOrArea: string | null;
  publicEmail: string | null;
  publicTelephone: string | null;
  notes: string | null;
};

export async function listBirOfficeReference(): Promise<BirOfficeReference[]> {
  const client = await createSupabaseServerClient();
  if (!client) return [];

  const current = await client
    .from("bir_offices")
    .select(`
      official_code,
      official_name,
      office_type,
      parent:parent_office_id (official_code, official_name),
      address,
      city_or_area,
      public_email,
      public_telephone,
      notes
    `)
    .eq("status", "active")
    .in("verification_status", ["verified", "partially_verified"])
    .order("office_type")
    .order("official_code");

  // The contact columns are additive and may not exist in an already-linked
  // preview database. Keep the read surface useful while the governed
  // migration is being applied; do not turn missing optional contact context
  // into a fatal BIR Center outage.
  const result = current.error
    ? await client
      .from("bir_offices")
      .select(`official_code, official_name, office_type, parent:parent_office_id (official_code, official_name)`)
      .eq("status", "active")
      .in("verification_status", ["verified", "partially_verified"])
      .order("office_type")
      .order("official_code")
    : current;

  if (result.error) throw new Error(`Unable to load the BIR office reference: ${result.error.message}`);

  return (result.data ?? []).map((row) => {
    const parent = Array.isArray(row.parent) ? row.parent[0] : row.parent;
    return {
      code: row.official_code,
      name: row.official_name,
      officeType: row.office_type,
      parentCode: parent?.official_code ?? null,
      parentName: parent?.official_name ?? null,
      address: "address" in row ? row.address : null,
      cityOrArea: "city_or_area" in row ? row.city_or_area : null,
      publicEmail: "public_email" in row ? row.public_email : null,
      publicTelephone: "public_telephone" in row ? row.public_telephone : null,
      notes: "notes" in row ? row.notes : null,
    } as BirOfficeReference;
  });
}

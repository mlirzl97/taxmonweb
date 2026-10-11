import { createSupabaseServerClient } from "@/lib/supabase/server";

export type BirOfficeReference = {
  code: string;
  name: string;
  active: boolean;
  officeType: "rdo" | "revenue_region" | "lts" | "lt_office" | "national_office" | "other";
  parentCode: string | null;
  parentName: string | null;
  address: string | null;
  cityOrArea: string | null;
  publicEmail: string | null;
  publicTelephone: string | null;
  notes: string | null;
  contacts: BirOfficeContact[];
};

export type BirOfficeContact = {
  group: string;
  room: string | null;
  telephone: string | null;
  email: string | null;
  kind: "general" | "division" | "service" | "data_center" | "other";
  sourceReference: string | null;
  notes: string | null;
};

export async function listBirOfficeReference(): Promise<BirOfficeReference[]> {
  const client = await createSupabaseServerClient();
  if (!client) return [];

  const current = await client
    .from("bir_offices")
    .select(`
      official_code,
      id,
      official_name,
      office_type,
      status,
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
  const result = isMissingContactColumnError(current.error)
    ? await client
      .from("bir_offices")
      .select(`id, official_code, official_name, office_type, status, parent:parent_office_id (official_code, official_name)`)
      .eq("status", "active")
      .in("verification_status", ["verified", "partially_verified"])
      .order("office_type")
      .order("official_code")
    : current;

  if (result.error) throw new Error(`Unable to load the BIR office reference: ${result.error.message}`);

  const officeRows = result.data ?? [];
  const officeIds = officeRows.map((row) => row.id).filter((id): id is string => typeof id === "string");
  const contactResult = officeIds.length > 0
    ? await client
      .from("bir_office_contacts")
      .select("office_id, contact_group, room, telephone, email, contact_kind, source_reference, notes")
      .in("office_id", officeIds)
      .eq("status", "active")
      .in("verification_status", ["verified", "partially_verified"])
      .order("contact_group")
    : { data: [], error: null };
  const contactsByOffice = new Map<string, BirOfficeContact[]>();
  if (!contactResult.error) {
    for (const row of contactResult.data ?? []) {
      const contacts = contactsByOffice.get(row.office_id) ?? [];
      contacts.push({
        group: row.contact_group,
        room: row.room,
        telephone: row.telephone,
        email: row.email,
        kind: row.contact_kind,
        sourceReference: row.source_reference,
        notes: row.notes,
      });
      contactsByOffice.set(row.office_id, contacts);
    }
  }

  return officeRows.map((row) => {
    const parent = Array.isArray(row.parent) ? row.parent[0] : row.parent;
    return {
      code: row.official_code,
      name: row.official_name,
      active: row.status === "active",
      officeType: row.office_type,
      parentCode: parent?.official_code ?? null,
      parentName: parent?.official_name ?? null,
      address: "address" in row ? row.address : null,
      cityOrArea: "city_or_area" in row ? row.city_or_area : null,
      publicEmail: "public_email" in row ? row.public_email : null,
      publicTelephone: "public_telephone" in row ? row.public_telephone : null,
      notes: "notes" in row ? row.notes : null,
      contacts: contactsByOffice.get(row.id) ?? [],
    } as BirOfficeReference;
  });
}

function isMissingContactColumnError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "42703" || /column|schema cache/i.test(error.message ?? "");
}

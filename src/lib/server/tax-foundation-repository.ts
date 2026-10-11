import { createSupabaseServerClient } from "@/lib/supabase/server";

export type TaxFoundationTaxType = {
  code: string;
  label: string;
  operatingCategory: "cit" | "vat_percentage" | "wht" | "others";
  verificationStatus: "verified" | "partially_verified" | "unresolved" | "superseded";
};

export type TaxFoundationForm = {
  formNumber: string;
  title: string;
  revisionLabel: string;
  verificationStatus: "verified" | "partially_verified" | "unresolved" | "superseded";
};

/**
 * Read-only projection of the governed BIR supporting masters.
 *
 * Requirement/version mappings are deliberately not inferred here. Until an
 * approved Requirement Master version links a form to a tax type, the UI must
 * show that relationship as unresolved rather than importing the old catalog
 * as a second source of truth.
 */
export async function listTaxFoundationReference(): Promise<{
  taxTypes: TaxFoundationTaxType[];
  forms: TaxFoundationForm[];
}> {
  const client = await createSupabaseServerClient();
  if (!client) return { taxTypes: [], forms: [] };

  const [taxTypeResult, formResult] = await Promise.all([
    client
      .from("tax_types")
      .select("code, label, operating_category, verification_status")
      .eq("status", "active")
      .neq("verification_status", "superseded")
      .order("code"),
    client
      .from("bir_forms")
      .select("form_number, title, revision_label, verification_status")
      .eq("status", "active")
      .neq("verification_status", "superseded")
      .order("form_number"),
  ]);

  if (taxTypeResult.error) throw new Error(`Unable to load the BIR tax-type reference: ${taxTypeResult.error.message}`);
  if (formResult.error) throw new Error(`Unable to load the BIR form reference: ${formResult.error.message}`);

  return {
    taxTypes: (taxTypeResult.data ?? []).map((row) => ({
      code: row.code,
      label: row.label,
      operatingCategory: row.operating_category,
      verificationStatus: row.verification_status,
    })),
    forms: (formResult.data ?? []).map((row) => ({
      formNumber: row.form_number,
      title: row.title,
      revisionLabel: row.revision_label,
      verificationStatus: row.verification_status,
    })),
  };
}

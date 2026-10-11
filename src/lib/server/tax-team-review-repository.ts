import { createSupabaseServerClient } from "@/lib/supabase/server";

export type PersistedTaxTeamReview = {
  review_key: string;
  review_date: string;
  client_label: string;
  requirement_label: string;
  period_label: string;
  tower_label: string;
  cluster_label: string;
  source_label: string;
  records_pulled: number;
  review_status: "awaiting_review" | "in_review" | "certified" | "follow_up";
  completeness_checked: boolean;
  awareness_checked: boolean;
  certified_by: string | null;
  certified_at: string | null;
};

export type TaxTeamReviewInput = Omit<PersistedTaxTeamReview, "certified_by" | "certified_at">;

export function isTaxTeamReviewInput(value: unknown): value is TaxTeamReviewInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const input = value as Record<string, unknown>;
  return ["review_key", "review_date", "client_label", "requirement_label", "period_label", "tower_label", "cluster_label", "source_label"].every((key) => typeof input[key] === "string" && input[key].trim().length > 0)
    && Number.isSafeInteger(input.records_pulled) && (input.records_pulled as number) >= 0
    && typeof input.completeness_checked === "boolean"
    && typeof input.awareness_checked === "boolean"
    && ["awaiting_review", "in_review", "certified", "follow_up"].includes(String(input.review_status));
}

async function requireClient() {
  const client = await createSupabaseServerClient();
  if (!client) throw new Error("Supabase is not configured for this environment.");
  return client;
}

export async function listPersistedTaxTeamReviews() {
  const client = await requireClient();
  const { data, error } = await client.rpc("get_tax_team_transaction_reviews");
  if (error) throw new Error(`Unable to load Tax Team transaction reviews: ${error.message}`);
  return (Array.isArray(data) ? data : []) as PersistedTaxTeamReview[];
}

export async function savePersistedTaxTeamReview(input: TaxTeamReviewInput) {
  const client = await requireClient();
  const { data, error } = await client.rpc("save_tax_team_transaction_review", {
    p_review_key: input.review_key,
    p_review_date: input.review_date,
    p_client_label: input.client_label,
    p_requirement_label: input.requirement_label,
    p_period_label: input.period_label,
    p_tower_label: input.tower_label,
    p_cluster_label: input.cluster_label,
    p_source_label: input.source_label,
    p_records_pulled: input.records_pulled,
    p_completeness_checked: input.completeness_checked,
    p_awareness_checked: input.awareness_checked,
    p_review_status: input.review_status,
  });
  if (error) throw new Error(`Unable to save Tax Team transaction review: ${error.message}`);
  return data as PersistedTaxTeamReview;
}

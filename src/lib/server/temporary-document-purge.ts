import { createClient } from "@supabase/supabase-js";

type PurgeCandidate = {
  id: string;
  storage_bucket: string;
  storage_path: string;
};

export type PurgeResult = {
  scanned: number;
  purged: number;
  failed: number;
};

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;
  return createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function purgeEligibleTemporary2303Documents(batchSize = 100): Promise<PurgeResult> {
  const client = adminClient();
  if (!client) throw new Error("The temporary-document purge service is not configured.");

  const { data, error } = await client
    .from("temporary_source_documents")
    .select("id, storage_bucket, storage_path")
    .eq("status", "purge_eligible")
    .lte("purge_eligible_at", new Date().toISOString())
    .order("purge_eligible_at", { ascending: true })
    .limit(batchSize);
  if (error) throw new Error(`Unable to load purge candidates: ${error.message}`);

  const candidates = (data ?? []) as PurgeCandidate[];
  let purged = 0;
  let failed = 0;
  for (const candidate of candidates) {
    const storage = await client.storage.from(candidate.storage_bucket).remove([candidate.storage_path]);
    if (storage.error) {
      failed += 1;
      console.error("[purge] unable to remove temporary document object", { id: candidate.id, error: storage.error });
      continue;
    }

    const update = await client
      .from("temporary_source_documents")
      .update({ status: "purged", purged_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", candidate.id)
      .eq("status", "purge_eligible");
    if (update.error) {
      failed += 1;
      console.error("[purge] unable to mark temporary document purged", { id: candidate.id, error: update.error });
      continue;
    }
    purged += 1;
  }

  return { scanned: candidates.length, purged, failed };
}

export function isAuthorizedPurgeRequest(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  return request.headers.get("authorization") === `Bearer ${expected}`;
}

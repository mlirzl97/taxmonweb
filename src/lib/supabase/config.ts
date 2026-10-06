export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return {
    url,
    anonKey,
    isConfigured: Boolean(url && anonKey),
  };
}

export function isPrototypeDemoMode() {
  return process.env.TAXMON_DEMO_MODE === "true";
}

export const temporary2303StorageBucket = "taxmon-temporary-2303";

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
  // Demo access is deliberately impossible on Vercel production. The local
  // E2E harness may run the production build with an explicit test-only flag.
  const localE2E = process.env.TAXMON_E2E_MODE === "true" && !process.env.VERCEL_ENV;
  if (process.env.VERCEL_ENV === "production" && !localE2E) return false;

  const localDemo = process.env.TAXMON_DEMO_MODE === "true";
  const previewDemo = process.env.TAXMON_PUBLIC_SANITIZED_DEMO === "true" && process.env.TAXMON_DATA_MODE === "sanitized";
  return localDemo || previewDemo;
}

/**
 * Temporary calibration switch for the ungated sanitized prototype. It makes
 * Client/Profile calibration edits usable without weakening authenticated
 * Supabase commands or RLS. It must be disabled before real client data.
 */
export function isCalibrationOpenEditMode() {
  if (!isPrototypeDemoMode()) return false;
  return process.env.TAXMON_CALIBRATION_EDIT_MODE === "true" && process.env.TAXMON_DATA_MODE === "sanitized";
}

export const temporary2303StorageBucket = "taxmon-temporary-2303";

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

/**
 * Temporary calibration switch for the ungated sanitized prototype. It makes
 * Module 01 profile/setup edits usable without weakening authenticated
 * Supabase commands or RLS. It must be disabled before real client data.
 */
export function isCalibrationOpenEditMode() {
  return process.env.TAXMON_CALIBRATION_EDIT_MODE === "true";
}

export const temporary2303StorageBucket = "taxmon-temporary-2303";

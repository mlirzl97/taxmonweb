/**
 * Browser-local state used by the sanitized calibration prototype.
 *
 * This is intentionally separate from Supabase data. Clearing it restores the
 * shipped fixture baseline; it must never be treated as a database delete.
 */
const localStoragePrefixes = [
  "taxmonweb.prototype.",
  "taxmonweb.calibration.tax-profile.",
  "taxmon.client.",
  "taxmon.team.",
  "taxmon.bir.",
] as const;

function isPrototypeStorageKey(key: string) {
  return localStoragePrefixes.some((prefix) => key.startsWith(prefix));
}

function removeMatchingKeys(storage: Storage) {
  const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter((key): key is string => Boolean(key));
  let removed = 0;
  for (const key of keys) {
    if (!isPrototypeStorageKey(key)) continue;
    storage.removeItem(key);
    removed += 1;
  }
  return removed;
}

export function clearPrototypeSeedData(localStorage: Storage, sessionStorage: Storage) {
  return {
    local: removeMatchingKeys(localStorage),
    session: removeMatchingKeys(sessionStorage),
  };
}

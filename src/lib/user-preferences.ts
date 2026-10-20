export type ThemePreference = "system" | "light" | "dark";

export type UserPreferences = {
  theme: ThemePreference;
  avatarUrl: string | null;
};

export const userPreferencesChangedEvent = "taxmonweb:user-preferences-changed";
const storageKey = "taxmonweb.user-preferences.v1";
const defaults: UserPreferences = { theme: "system", avatarUrl: null };

function fromRemotePayload(value: unknown): UserPreferences {
  const payload = value && typeof value === "object" ? value as { theme?: unknown; avatarUrl?: unknown } : {};
  return {
    theme: payload.theme === "light" || payload.theme === "dark" ? payload.theme : "system",
    avatarUrl: typeof payload.avatarUrl === "string" ? payload.avatarUrl : null,
  };
}

export function readUserPreferences(storage?: Storage): UserPreferences {
  if (!storage) return defaults;
  try {
    const parsed = JSON.parse(storage.getItem(storageKey) ?? "null") as Partial<UserPreferences> | null;
    return {
      theme: parsed?.theme === "light" || parsed?.theme === "dark" ? parsed.theme : "system",
      avatarUrl: typeof parsed?.avatarUrl === "string" ? parsed.avatarUrl : null,
    };
  } catch {
    return defaults;
  }
}

export function saveUserPreferences(patch: Partial<UserPreferences>, storage?: Storage): UserPreferences {
  const next = { ...readUserPreferences(storage), ...patch };
  if (storage) storage.setItem(storageKey, JSON.stringify(next));
  if (typeof window !== "undefined") window.dispatchEvent(new Event(userPreferencesChangedEvent));
  return next;
}

export async function loadAccountPreferences(): Promise<UserPreferences> {
  const response = await fetch("/api/me/preferences", { cache: "no-store" });
  if (!response.ok) throw new Error("Unable to load account preferences.");
  return fromRemotePayload(await response.json());
}

export async function saveAccountPreferences(patch: Partial<Pick<UserPreferences, "theme">>): Promise<UserPreferences> {
  const response = await fetch("/api/me/preferences", {
    body: JSON.stringify(patch),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  if (!response.ok) throw new Error("Unable to save account preferences.");
  const next = fromRemotePayload(await response.json());
  if (typeof window !== "undefined") window.dispatchEvent(new Event(userPreferencesChangedEvent));
  return next;
}

export async function uploadAccountAvatar(file: File): Promise<UserPreferences> {
  const form = new FormData();
  form.set("avatar", file);
  const response = await fetch("/api/me/preferences", { body: form, method: "POST" });
  if (!response.ok) throw new Error("Unable to save the account photo.");
  const next = fromRemotePayload(await response.json());
  if (typeof window !== "undefined") window.dispatchEvent(new Event(userPreferencesChangedEvent));
  return next;
}

export async function removeAccountAvatar(): Promise<UserPreferences> {
  const response = await fetch("/api/me/preferences", { method: "DELETE" });
  if (!response.ok) throw new Error("Unable to remove the account photo.");
  const next = fromRemotePayload(await response.json());
  if (typeof window !== "undefined") window.dispatchEvent(new Event(userPreferencesChangedEvent));
  return next;
}

export function applyThemePreference(preference: ThemePreference): void {
  if (typeof window === "undefined") return;
  const isDark = preference === "dark" || (preference === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const resolved = isDark ? "dark" : "light";
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
}

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";

import { getSupabaseConfig } from "./config";

export async function createSupabaseServerClient() {
  const { url, anonKey, isConfigured } = getSupabaseConfig();

  if (!isConfigured || !url || !anonKey) {
    return null;
  }

  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Components cannot always write cookies. Proxy refresh handles it.
        }
      },
    },
  });
}

export const getAuthenticatedRequestContext = cache(async () => {
  const client = await createSupabaseServerClient();

  if (!client) {
    return { client: null, user: null };
  }

  const {
    data: { user },
  } = await client.auth.getUser();

  return { client, user };
});

export const getAuthenticatedUser = cache(async () => (await getAuthenticatedRequestContext()).user);

export const getAuthenticatedUserProfile = cache(async () => {
  const { client, user } = await getAuthenticatedRequestContext();

  if (!client || !user) {
    return null;
  }

  const { data: appUser } = await client
    .from("app_users")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  return {
    user,
    displayName: appUser?.display_name?.trim() || user.user_metadata?.display_name?.trim() || user.email || "Authenticated user",
  };
});

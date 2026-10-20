import { NextResponse } from "next/server";

import { requireSameOrigin } from "@/lib/server/request-origin";
import { createSupabaseServerClient, getAuthenticatedUser } from "@/lib/supabase/server";

const avatarBucket = "taxmon-user-avatars";
const maxAvatarBytes = 2_000_000;
const themes = new Set(["system", "light", "dark"]);

type StoredPreferences = { theme: "system" | "light" | "dark"; avatar_path: string | null };

async function authenticatedStore() {
  const [user, client] = await Promise.all([getAuthenticatedUser(), createSupabaseServerClient()]);
  if (!user || !client) return null;
  return { user, client };
}

async function readStoredPreferences(client: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>, userId: string): Promise<StoredPreferences> {
  const { data, error } = await client
    .from("user_preferences")
    .select("theme, avatar_path")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return {
    theme: data?.theme === "light" || data?.theme === "dark" ? data.theme : "system",
    avatar_path: typeof data?.avatar_path === "string" ? data.avatar_path : null,
  };
}

async function responseFor(client: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>, userId: string, stored: StoredPreferences) {
  let avatarUrl: string | null = null;
  if (stored.avatar_path) {
    const signed = await client.storage.from(avatarBucket).createSignedUrl(stored.avatar_path, 60 * 60);
    if (!signed.error) avatarUrl = signed.data.signedUrl;
  }
  return NextResponse.json({ theme: stored.theme, avatarUrl });
}

export async function GET() {
  const context = await authenticatedStore();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    return await responseFor(context.client, context.user.id, await readStoredPreferences(context.client, context.user.id));
  } catch {
    return NextResponse.json({ error: "Unable to load account preferences." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const originDenied = requireSameOrigin(request);
  if (originDenied) return originDenied;
  const context = await authenticatedStore();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const current = await readStoredPreferences(context.client, context.user.id);
    const contentType = request.headers.get("content-type") ?? "";
    let next = current;

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("avatar");
      if (!(file instanceof File)) return NextResponse.json({ error: "An image is required." }, { status: 400 });
      if (!file.type.startsWith("image/") || file.size > maxAvatarBytes) {
        return NextResponse.json({ error: "Choose an image smaller than 2 MB." }, { status: 400 });
      }

      const path = `${context.user.id}/avatar-${crypto.randomUUID()}`;
      const upload = await context.client.storage.from(avatarBucket).upload(path, file, { contentType: file.type, upsert: false });
      if (upload.error) return NextResponse.json({ error: "This photo could not be saved." }, { status: 503 });

      const saved = await context.client
        .from("user_preferences")
        .upsert({ user_id: context.user.id, theme: current.theme, avatar_path: path, updated_at: new Date().toISOString() })
        .select("theme, avatar_path")
        .single();
      if (saved.error) {
        await context.client.storage.from(avatarBucket).remove([path]);
        throw new Error(saved.error.message);
      }
      if (current.avatar_path) await context.client.storage.from(avatarBucket).remove([current.avatar_path]);
      next = { theme: saved.data.theme === "light" || saved.data.theme === "dark" ? saved.data.theme : "system", avatar_path: path };
    } else {
      const payload = await request.json() as { theme?: unknown };
      if (payload.theme !== undefined && (typeof payload.theme !== "string" || !themes.has(payload.theme))) {
        return NextResponse.json({ error: "Unsupported appearance preference." }, { status: 400 });
      }
      if (payload.theme !== undefined) {
        const saved = await context.client
          .from("user_preferences")
          .upsert({ user_id: context.user.id, theme: payload.theme, avatar_path: current.avatar_path, updated_at: new Date().toISOString() })
          .select("theme, avatar_path")
          .single();
        if (saved.error) throw new Error(saved.error.message);
        next = { theme: saved.data.theme === "light" || saved.data.theme === "dark" ? saved.data.theme : "system", avatar_path: typeof saved.data.avatar_path === "string" ? saved.data.avatar_path : null };
      }
    }

    return await responseFor(context.client, context.user.id, next);
  } catch {
    return NextResponse.json({ error: "Unable to save account preferences." }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  const originDenied = requireSameOrigin(request);
  if (originDenied) return originDenied;
  const context = await authenticatedStore();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const current = await readStoredPreferences(context.client, context.user.id);
    if (current.avatar_path) {
      const removed = await context.client.storage.from(avatarBucket).remove([current.avatar_path]);
      if (removed.error) throw new Error(removed.error.message);
    }
    const saved = await context.client
      .from("user_preferences")
      .upsert({ user_id: context.user.id, theme: current.theme, avatar_path: null, updated_at: new Date().toISOString() })
      .select("theme, avatar_path")
      .single();
    if (saved.error) throw new Error(saved.error.message);
    return await responseFor(context.client, context.user.id, { theme: current.theme, avatar_path: null });
  } catch {
    return NextResponse.json({ error: "Unable to remove the account photo." }, { status: 503 });
  }
}

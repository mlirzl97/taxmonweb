import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(join(process.cwd(), "supabase/migrations/20261204000000_account_preferences.sql"), "utf8");

describe("account preferences persistence contract", () => {
  it("keeps preferences and avatar storage private to the signed-in account", () => {
    expect(migration).toContain("create table if not exists public.user_preferences");
    expect(migration).toContain("user_id uuid primary key references auth.users(id)");
    expect(migration).toContain("user_preferences_self_read");
    expect(migration).toContain("user_preferences_self_update");
    expect(migration).toContain("values ('taxmon-user-avatars', 'taxmon-user-avatars', false)");
    expect(migration).toContain("bucket_id = 'taxmon-user-avatars'");
    expect(migration).toContain("(storage.foldername(name))[1] = (select auth.uid())::text");
    expect(migration).not.toContain("public = true");
  });
});

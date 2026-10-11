import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/20261109000000_private_staff_account_lifecycle.sql"), "utf8");
const provisioning = readFileSync(resolve(process.cwd(), "supabase/migrations/20261110000000_provision_pending_staff.sql"), "utf8");
const backfill = readFileSync(resolve(process.cwd(), "supabase/migrations/20261111000000_reclassify_existing_app_users.sql"), "utf8");
const hardening = readFileSync(resolve(process.cwd(), "supabase/migrations/20261112000000_harden_staff_provisioning.sql"), "utf8");

describe("private account lifecycle migration contract", () => {
  it("does not allow Auth identity creation to become workspace access", () => {
    expect(migration).toContain("account_status in ('pending', 'active', 'suspended', 'retired')");
    expect(migration).toContain("false,\n    'pending'");
    expect(migration).toContain("account_status = 'active'");
    expect(migration).toContain("drop policy if exists app_users_self_read");
    expect(backfill).toContain("else 'pending' end");
    expect(backfill).toContain("team_member_profiles");
    expect(backfill).toContain("user_capability_assignments");
    expect(backfill).toContain("user_scope_assignments");
  });

  it("requires controlled setup before activation", () => {
    expect(migration).toContain("activate_staff_account");
    expect(migration).toContain("team_member_profiles");
    expect(migration).toContain("user_capability_assignments");
    expect(migration).toContain("user_scope_assignments");
    expect(provisioning).toContain("provision_pending_staff");
    expect(provisioning).toContain("has_active_capability('AdministerUsers')");
    expect(provisioning).toContain("Cross-portfolio access requires approved Tax Control authority.");
    expect(provisioning).toContain("p_effective_from,\n    true,\n    p_career_service_level");
  });

  it("keeps privileged bundles and roles inside the server-side profile boundary", () => {
    expect(hardening).toContain("resolved_capability_keys");
    expect(hardening).toContain("expected_role_key");
    expect(hardening).toContain("Only approved Tax Control authority may grant the HOD / Master Admin profile.");
    expect(hardening).toContain("p_capability_keys text[]");
    expect(hardening).toContain("    true,");
  });
});

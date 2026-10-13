import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const triggerMigration = readFileSync(join(process.cwd(), "supabase/migrations/20261126000000_materialize_requirement_components_on_work.sql"), "utf8");
const backfillMigration = readFileSync(join(process.cwd(), "supabase/migrations/20261126010000_backfill_generated_work_components.sql"), "utf8");

describe("generated work component relationship", () => {
  it("materializes governed requirement components under the parent work object", () => {
    expect(triggerMigration).toContain("generated_work_id");
    expect(triggerMigration).toContain("requirement_components");
    expect(triggerMigration).toContain("requirement_version_id = new.requirement_version_id");
    expect(triggerMigration).toContain("component_type = 'payment'");
    expect(triggerMigration).toContain("on conflict (generated_work_id, component_code) do nothing");
  });

  it("backfills existing work without creating peer work objects", () => {
    expect(backfillMigration).toContain("insert into public.generated_compliance_work_components");
    expect(backfillMigration).toContain("join public.requirement_components");
    expect(backfillMigration).not.toMatch(/insert into public\.generated_compliance_work\s*\(/);
  });
});

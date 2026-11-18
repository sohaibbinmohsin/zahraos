import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

describe("0019 org admin RLS visibility migration", () => {
  const migrationPath = path.join(
    process.cwd(),
    "supabase/migrations/0019_fix_org_admin_rls_visibility.sql",
  );
  const sql = readFileSync(migrationPath, "utf8");

  it("redefines is_org_admin_or_above as security definer", () => {
    expect(sql).toContain("create or replace function is_org_admin_or_above(p_org_id uuid)");
    expect(sql).toContain("security definer");
    expect(sql).toContain("set search_path = public");
  });

  it("treats Super Admin and org-wide Org Admin role assignments as admin", () => {
    expect(sql).toContain("staff_role_assignments sra");
    expect(sql).toContain("r.name = 'Super Admin'");
    expect(sql).toContain("r.name = 'Org Admin' and sra.scope_kind = 'org_wide'");
    expect(sql).toContain("staff_org_roles sor");
  });

  it("backfills missing staff_org_roles tiers from admin role assignments", () => {
    expect(sql).toContain("insert into staff_org_roles (staff_id, organization_id, org_tier)");
    expect(sql).toContain("on conflict (staff_id, organization_id) do update");
    expect(sql).toContain("when bool_or(r.name = 'Super Admin') then 'super_admin'");
  });
});

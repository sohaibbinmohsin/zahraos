import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

describe("0020 partner inquiries permission RLS migration", () => {
  const migrationPath = path.join(
    process.cwd(),
    "supabase/migrations/0020_partner_inquiries_permission_rls.sql",
  );
  const sql = readFileSync(migrationPath, "utf8");

  it("adds staff_has_org_permission security definer helper", () => {
    expect(sql).toContain("create or replace function staff_has_org_permission(");
    expect(sql).toContain("security definer");
    expect(sql).toContain("sra.scope_kind = 'org_wide'");
  });

  it("allows select for inquiries:read or inquiries:write", () => {
    expect(sql).toContain("partner_inquiries_select");
    expect(sql).toContain("staff_has_org_permission(organization_id, 'inquiries', 'read')");
    expect(sql).toContain("staff_has_org_permission(organization_id, 'inquiries', 'write')");
  });

  it("gates update and delete on inquiries:write", () => {
    expect(sql).toContain("partner_inquiries_update");
    expect(sql).toContain("partner_inquiries_delete");
    expect(sql).toMatch(/partner_inquiries_update[\s\S]*inquiries', 'write'/);
  });
});

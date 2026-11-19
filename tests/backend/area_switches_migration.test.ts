import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

describe("0022 area switches", () => {
  const sql = fs.readFileSync(
    path.join(process.cwd(), "supabase/migrations/0022_area_switches.sql"),
    "utf8",
  );

  it("replaces lead, coordinator, reviewer, and auditor keys and does not rewrite assignment rows", () => {
    expect(sql).toContain("delete from role_permissions");
    expect(sql).toContain(
      "name in ('Chapter Lead', 'City Lead', 'Drive Coordinator', 'Application Reviewer', 'Auditor')",
    );
    expect(sql).not.toContain("name in ('Super Admin'");
    expect(sql).toContain(
      "'opportunities:read','opportunities:write','opportunities:update','noticeboard:read','noticeboard:write','applications:read','applications:update','hours:read','hours:update'",
    );
    expect(sql).toContain("admin_action_log:read");
    expect(sql).not.toContain("update staff_role_assignments");
    expect(sql).not.toContain("delete from staff_role_assignments");
  });
});
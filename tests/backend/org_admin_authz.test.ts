import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

describe("orgAdminAuthz shared helper", () => {
  it("exists and checks staff_org_roles plus Super Admin / Org Admin assignments", () => {
    const source = readFileSync(
      path.join(process.cwd(), "supabase/functions/_shared/orgAdminAuthz.ts"),
      "utf8",
    );
    expect(source).toContain("isCallerOrgAdminOrAbove");
    expect(source).toContain('roleName === "Super Admin"');
    expect(source).toContain('roleName === "Org Admin" && row.scope_kind === "org_wide"');
    expect(source).toContain("staff_org_roles");
  });

  it("is used by invite, create-chapter, list-chapters, and update-organization", () => {
    const files = [
      "supabase/functions/invite-staff-member/handler.ts",
      "supabase/functions/create-chapter/handler.ts",
      "supabase/functions/list-chapters/handler.ts",
      "supabase/functions/update-organization/handler.ts",
    ];
    for (const file of files) {
      const source = readFileSync(path.join(process.cwd(), file), "utf8");
      expect(source).toContain("assertCallerIsOrgAdminOrAbove");
    }
  });
});

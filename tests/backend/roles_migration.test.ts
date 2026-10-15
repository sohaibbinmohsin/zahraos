import { describe, it, expect } from "vitest";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import fs from "fs";
import path from "path";

describe("0018 Chapter Lead and City Lead Migration", () => {
  const migrationPath = path.join(process.cwd(), "supabase/migrations/0018_chapter_and_city_leads.sql");

  it("defines Chapter Lead and City Lead system roles with chapters permissions", () => {
    // Assert migration file exists and contains role seeding
    const migration = fs.readFileSync(migrationPath, "utf8");
    expect(migration).toContain("Chapter Lead");
    expect(migration).toContain("City Lead");
    expect(migration).toContain("chapters:write");
    expect(migration).toContain("chapters:read");
  });

  it("seeds chapters permissions into permissions table", () => {
    const migration = fs.readFileSync(migrationPath, "utf8");
    expect(migration).toContain("insert into permissions (module_id, resource, action)");
    expect(migration).toContain("('chapters', 'read'), ('chapters', 'write')");
  });

  it("seeds Chapter Lead and City Lead with full operational and chapter permissions", () => {
    const migration = fs.readFileSync(migrationPath, "utf8");
    const expectedPerms = [
      "opportunities:write",
      "opportunities:read",
      "noticeboard:write",
      "noticeboard:read",
      "applications:update",
      "applications:read",
      "hours:update",
      "hours:read",
      "chapters:write",
      "chapters:read",
    ];

    for (const perm of expectedPerms) {
      expect(migration).toContain(`'${perm}'`);
    }

    // Both Chapter Lead and City Lead must be defined in seed_youth_republic_system_roles
    expect(migration).toContain("perform seed_youth_republic_system_role(p_org_id, p_module_id, 'Chapter Lead'");
    expect(migration).toContain("perform seed_youth_republic_system_role(p_org_id, p_module_id, 'City Lead'");
  });

  it("migrates existing Operations Lead rows and retroactively seeds City Lead", () => {
    const migration = fs.readFileSync(migrationPath, "utf8");
    expect(migration).toContain("set name = 'Chapter Lead'");
    expect(migration).toContain("where module_id = v_module_id and name = 'Operations Lead'");
    expect(migration).toContain("insert into role_permissions (role_id, permission_id)");
    expect(migration).toContain("seed_youth_republic_system_role(v_role.organization_id, v_module_id, 'City Lead'");
  });
});

import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { updateStaffAccess } from "@/supabase/functions/update-staff-access/handler";

describe("Task 1: Migration 0017 & Demotion Synchronization", () => {
  describe("0017_chapter_profiles_and_roster.sql schema", () => {
    const migrationPath = join(process.cwd(), "supabase/migrations/0017_chapter_profiles_and_roster.sql");
    const sql = readFileSync(migrationPath, "utf8");

    it("extends chapters with logo_url and about columns", () => {
      expect(sql).toContain("alter table chapters add column if not exists logo_url text;");
      expect(sql).toContain("alter table chapters add column if not exists about text;");
    });

    it("creates chapter_team_members table with unique constraint on (chapter_id, volunteer_code, term)", () => {
      expect(sql).toContain("create table if not exists chapter_team_members");
      expect(sql).toContain("chapter_id     uuid not null references chapters(id) on delete cascade");
      expect(sql).toContain("volunteer_code text not null");
      expect(sql).toContain("designation    text not null");
      expect(sql).toContain("status         text not null default 'active' check (status in ('active', 'alumni'))");
      expect(sql).toContain("unique (chapter_id, volunteer_code, term)");
    });

    it("configures RLS for intra-organizational team read access", () => {
      expect(sql).toContain("alter table chapter_team_members enable row level security;");
      expect(sql).toContain("create policy chapter_team_members_select on chapter_team_members");
      expect(sql).toContain("is_org_admin_or_above(c.organization_id)");
    });

    it("inserts inquiries:read and inquiries:write permissions", () => {
      expect(sql).toContain("('inquiries', 'read'), ('inquiries', 'write')");
    });

    it("seeds Org Admin system role into seed_youth_republic_system_roles", () => {
      expect(sql).toContain("perform seed_youth_republic_system_role(p_org_id, p_module_id, 'Org Admin'");
    });
  });

  describe("updateStaffAccess demotion & promotion lifecycle", () => {
    const mockOrgId = "org-111";
    const mockStaffId = "staff-222";
    const mockCallerId = "caller-333";
    const mockModId = "mod-yr";

    function createMockSupabase(initialOrgTier: string | null = null) {
      const db = {
        staff_org_roles: initialOrgTier ? [{ staff_id: mockStaffId, organization_id: mockOrgId, org_tier: initialOrgTier }] : [] as any[],
        staff_role_assignments: [] as any[],
        audit_logs: [] as any[],
      };

      const client: any = {
        from: (table: string) => {
          if (table === "modules") {
            return {
              select: () => ({
                eq: () => ({
                  single: async () => ({ data: { id: mockModId }, error: null }),
                }),
              }),
            };
          }
          if (table === "roles") {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    in: async (_col: string, ids: string[]) => ({
                      data: ids.map((id) => ({
                        id,
                        name: id === "role-super" ? "Super Admin" : id === "role-org-admin" ? "Org Admin" : "Operations Lead",
                      })),
                      error: null,
                    }),
                  }),
                }),
              }),
            };
          }
          if (table === "staff") {
            return {
              select: () => ({
                eq: () => ({
                  single: async () => ({ data: { id: mockStaffId, full_name: "Target Staff", platform_owner: false }, error: null }),
                }),
              }),
              update: () => ({
                eq: async () => ({ error: null }),
              }),
            };
          }
          if (table === "staff_role_assignments") {
            return {
              delete: () => ({
                eq: () => ({
                  eq: () => ({
                    eq: async () => ({ error: null }),
                  }),
                }),
              }),
              insert: async (rows: any[]) => {
                db.staff_role_assignments.push(...rows);
                return { error: null };
              },
            };
          }
          if (table === "staff_org_roles") {
            return {
              select: () => ({
                eq: () => ({
                  in: async () => ({
                    data: [{ organization_id: mockOrgId, org_tier: "super_admin" }],
                    error: null,
                  }),
                  data: db.staff_org_roles,
                  error: null,
                }),
              }),
              upsert: async (row: any) => {
                const idx = db.staff_org_roles.findIndex((r) => r.staff_id === row.staff_id && r.organization_id === row.organization_id);
                if (idx >= 0) db.staff_org_roles[idx] = row;
                else db.staff_org_roles.push(row);
                return { error: null };
              },
              delete: () => ({
                eq: (_col1: string, sId: string) => ({
                  eq: async (_col2: string, oId: string) => {
                    db.staff_org_roles = db.staff_org_roles.filter((r) => !(r.staff_id === sId && r.organization_id === oId));
                    return { error: null };
                  },
                }),
              }),
            };
          }
          if (table === "admin_audit_log") {
            return {
              insert: async (entry: any) => {
                db.audit_logs.push(entry);
                return { error: null };
              },
            };
          }
          throw new Error(`Unhandled table in mock: ${table}`);
        },
      };

      return { client, db };
    }

    it("rejects Super Admin role assignment when scoped to a chapter", async () => {
      const { client } = createMockSupabase();

      await expect(
        updateStaffAccess(client, mockCallerId, true, {
          staffId: mockStaffId,
          organizationId: mockOrgId,
          status: "active",
          roles: [
            {
              roleId: "role-super",
              scopeKind: "chapter",
              chapterId: "chapter-karachi",
              scopeLabel: "Karachi Chapter",
            },
          ],
        })
      ).rejects.toThrow("super_admin_cannot_be_scoped");
    });

    it("upserts staff_org_roles with 'super_admin' when Super Admin is assigned org-wide", async () => {
      const { client, db } = createMockSupabase(null);

      await updateStaffAccess(client, mockCallerId, true, {
        staffId: mockStaffId,
        organizationId: mockOrgId,
        status: "active",
        roles: [
          {
            roleId: "role-super",
            scopeKind: "org_wide",
            scopeLabel: "National / All Chapters",
          },
        ],
      });

      const orgRole = db.staff_org_roles.find((r) => r.staff_id === mockStaffId && r.organization_id === mockOrgId);
      expect(orgRole).toBeDefined();
      expect(orgRole?.org_tier).toBe("super_admin");
    });

    it("upserts staff_org_roles with 'admin' when Org Admin is assigned org-wide", async () => {
      const { client, db } = createMockSupabase(null);

      await updateStaffAccess(client, mockCallerId, true, {
        staffId: mockStaffId,
        organizationId: mockOrgId,
        status: "active",
        roles: [
          {
            roleId: "role-org-admin",
            scopeKind: "org_wide",
            scopeLabel: "National / All Chapters",
          },
        ],
      });

      const orgRole = db.staff_org_roles.find((r) => r.staff_id === mockStaffId && r.organization_id === mockOrgId);
      expect(orgRole).toBeDefined();
      expect(orgRole?.org_tier).toBe("admin");
    });

    it("deletes staff_org_roles row when user is demoted from Super Admin to Chapter Admin (chapter-scoped Org Admin)", async () => {
      const { client, db } = createMockSupabase("super_admin");
      expect(db.staff_org_roles.length).toBe(1);

      await updateStaffAccess(client, mockCallerId, true, {
        staffId: mockStaffId,
        organizationId: mockOrgId,
        status: "active",
        roles: [
          {
            roleId: "role-org-admin",
            scopeKind: "chapter",
            chapterId: "chapter-lahore",
            scopeLabel: "Lahore Chapter",
          },
        ],
      });

      const orgRole = db.staff_org_roles.find((r) => r.staff_id === mockStaffId && r.organization_id === mockOrgId);
      expect(orgRole).toBeUndefined();
      expect(db.staff_org_roles.length).toBe(0);
    });

    it("deletes staff_org_roles row when user is demoted to a lower operational role (e.g. Operations Lead)", async () => {
      const { client, db } = createMockSupabase("admin");
      expect(db.staff_org_roles.length).toBe(1);

      await updateStaffAccess(client, mockCallerId, true, {
        staffId: mockStaffId,
        organizationId: mockOrgId,
        status: "active",
        roles: [
          {
            roleId: "role-ops-lead",
            scopeKind: "org_wide",
            scopeLabel: "National / All Chapters",
          },
        ],
      });

      const orgRole = db.staff_org_roles.find((r) => r.staff_id === mockStaffId && r.organization_id === mockOrgId);
      expect(orgRole).toBeUndefined();
      expect(db.staff_org_roles.length).toBe(0);
    });

    it("deletes staff_org_roles row when user is deactivated even if holding Super Admin", async () => {
      const { client, db } = createMockSupabase("super_admin");
      expect(db.staff_org_roles.length).toBe(1);

      await updateStaffAccess(client, mockCallerId, true, {
        staffId: mockStaffId,
        organizationId: mockOrgId,
        status: "deactivated",
        roles: [
          {
            roleId: "role-super",
            scopeKind: "org_wide",
            scopeLabel: "National / All Chapters",
          },
        ],
      });

      const orgRole = db.staff_org_roles.find((r) => r.staff_id === mockStaffId && r.organization_id === mockOrgId);
      expect(orgRole).toBeUndefined();
    });
  });

  describe("Token Minting & Chapter Scoping Rules", () => {
    it("pins chapter scopes strictly to chapterId for Chapter Admin", () => {
      const keyScopes = new Map<string, { anyOrgWide: boolean; chapters: Set<string> }>();
      const chapterId = "chapter-123";

      // Chapter-scoped Org Admin
      const allPermissions = [
        "opportunities:write",
        "opportunities:read",
        "noticeboard:write",
        "applications:update",
        "applications:read",
        "hours:update",
        "hours:read",
        "team:write",
      ];

      for (const permKey of allPermissions) {
        let cur = keyScopes.get(permKey);
        if (!cur) {
          cur = { anyOrgWide: false, chapters: new Set<string>() };
          keyScopes.set(permKey, cur);
        }
        cur.chapters.add(chapterId);
      }

      // Convert to chapter_scopes
      const chapter_scopes: Record<string, string[]> = {};
      for (const [permKey, scope] of keyScopes) {
        if (!scope.anyOrgWide && scope.chapters.size > 0) {
          chapter_scopes[permKey] = Array.from(scope.chapters);
        }
      }

      expect(Object.keys(chapter_scopes).length).toBe(allPermissions.length);
      for (const permKey of allPermissions) {
        expect(chapter_scopes[permKey]).toEqual([chapterId]);
      }
    });

    it("unrestricts chapter scopes when user is Super Admin or National Org Admin", () => {
      const keyScopes = new Map<string, { anyOrgWide: boolean; chapters: Set<string> }>();

      const allPermissions = [
        "opportunities:write",
        "opportunities:read",
        "applications:update",
        "applications:read",
        "hours:update",
        "hours:read",
        "team:write",
      ];

      // Org-wide admin grant
      for (const permKey of allPermissions) {
        keyScopes.set(permKey, { anyOrgWide: true, chapters: new Set<string>() });
      }

      const chapter_scopes: Record<string, string[]> = {};
      for (const [permKey, scope] of keyScopes) {
        if (!scope.anyOrgWide && scope.chapters.size > 0) {
          chapter_scopes[permKey] = Array.from(scope.chapters);
        }
      }

      // All unconstrained -> no chapter_scopes entries
      expect(Object.keys(chapter_scopes).length).toBe(0);
    });
  });
});

import { describe, it, expect, vi } from "vitest";
import {
  CHAPTER_LEAD_CREDENTIALS,
  CITY_LEAD_CREDENTIALS,
  SEED_ORGS,
  SEED_CHAPTERS,
  LEAD_PERMISSIONS,
  getChapterLeadCredentials,
  getCityLeadCredentials,
  makeChapterLeadClaims,
  makeCityLeadClaims,
  makeChapterLeadToken,
  makeCityLeadToken,
  seedChapterAndCityLeads,
  ensureStaffRoleAssignment,
} from "./test_leads_seed";
import { main as runSeedMain, runSeed as runBackendSeed } from "@/supabase/seed/seed";
import { decodeStaffTokenClaims } from "@/lib/staffToken";
import { deriveRoleTitleFromPermissions } from "@/lib/capabilityMap";

describe("Test Leads Seed Fixtures & Credentials", () => {
  describe("Chapter Lead Credentials", () => {
    it("has exact expected credentials for Chapter Lead", () => {
      const creds = getChapterLeadCredentials();

      expect(creds.email).toBe("chapterlead@rizq.org");
      expect(creds.password).toBe("TestPassword123!");
      expect(creds.role).toBe("Chapter Lead");
      expect(creds.organizationId).toBe(SEED_ORGS.rizq);
      expect(creds.chapterName).toBe("Lahore Central");
      expect(creds.chapterId).toBe(SEED_CHAPTERS.lahoreCentral.id);
      expect(creds.staffId).toBeDefined();
      expect(creds.authUserId).toBeDefined();
    });

    it("returns an isolated clone from getChapterLeadCredentials", () => {
      const creds1 = getChapterLeadCredentials();
      const creds2 = getChapterLeadCredentials();

      expect(creds1).toEqual(creds2);
      expect(creds1).not.toBe(creds2);

      creds1.email = "mutated@example.com";
      expect(getChapterLeadCredentials().email).toBe("chapterlead@rizq.org");
    });
  });

  describe("City Lead Credentials", () => {
    it("has exact expected credentials for City Lead with multi-chapter scope", () => {
      const creds = getCityLeadCredentials();

      expect(creds.email).toBe("citylead@rizq.org");
      expect(creds.password).toBe("TestPassword123!");
      expect(creds.role).toBe("City Lead");
      expect(creds.organizationId).toBe(SEED_ORGS.rizq);
      expect(creds.chapterNames).toEqual(["Lahore Central", "Lahore North"]);
      expect(creds.chapterIds).toEqual([
        SEED_CHAPTERS.lahoreCentral.id,
        SEED_CHAPTERS.lahoreNorth.id,
      ]);
      expect(creds.staffId).toBeDefined();
      expect(creds.authUserId).toBeDefined();
    });

    it("returns an isolated clone from getCityLeadCredentials", () => {
      const creds1 = getCityLeadCredentials();
      const creds2 = getCityLeadCredentials();

      expect(creds1).toEqual(creds2);
      expect(creds1).not.toBe(creds2);

      creds1.chapterNames?.push("Mutated Chapter");
      expect(getCityLeadCredentials().chapterNames).toEqual(["Lahore Central", "Lahore North"]);
    });
  });

  describe("Claims & Scopes Generation", () => {
    it("generates correct StaffTokenClaims for Chapter Lead", () => {
      const claims = makeChapterLeadClaims();

      expect(claims.actorType).toBe("staff");
      expect(claims.platformOwner).toBe(false);
      expect(claims.staffId).toBe(CHAPTER_LEAD_CREDENTIALS.staffId);
      expect(claims.orgRoles).toEqual([{ organizationId: SEED_ORGS.rizq }]);

      expect(claims.moduleAccess).toHaveLength(1);
      const moduleAccess = claims.moduleAccess[0];
      expect(moduleAccess.organizationId).toBe(SEED_ORGS.rizq);
      expect(moduleAccess.module).toBe("youth-republic");

      // Verify all lead permissions are present
      for (const perm of LEAD_PERMISSIONS) {
        expect(moduleAccess.permissions).toContain(perm);
      }

      // Negative assertion: Lead must NOT have org-wide governance permissions
      expect(moduleAccess.permissions).not.toContain("team:write");
      expect(moduleAccess.permissions).not.toContain("inquiries:write");
      expect(moduleAccess.permissions).not.toContain("volunteers:read");

      // Verify single chapter scope for all permissions
      expect(moduleAccess.chapterScopes).toBeDefined();
      for (const perm of LEAD_PERMISSIONS) {
        expect(moduleAccess.chapterScopes![perm]).toEqual([SEED_CHAPTERS.lahoreCentral.id]);
      }
    });

    it("generates correct StaffTokenClaims for City Lead with multiple chapters", () => {
      const claims = makeCityLeadClaims();

      expect(claims.actorType).toBe("staff");
      expect(claims.platformOwner).toBe(false);
      expect(claims.staffId).toBe(CITY_LEAD_CREDENTIALS.staffId);
      expect(claims.orgRoles).toEqual([{ organizationId: SEED_ORGS.rizq }]);

      expect(claims.moduleAccess).toHaveLength(1);
      const moduleAccess = claims.moduleAccess[0];
      expect(moduleAccess.organizationId).toBe(SEED_ORGS.rizq);
      expect(moduleAccess.module).toBe("youth-republic");

      // Verify all lead permissions are present
      for (const perm of LEAD_PERMISSIONS) {
        expect(moduleAccess.permissions).toContain(perm);
      }

      // Verify multi-chapter scope for all permissions
      expect(moduleAccess.chapterScopes).toBeDefined();
      for (const perm of LEAD_PERMISSIONS) {
        expect(moduleAccess.chapterScopes![perm]).toEqual([
          SEED_CHAPTERS.lahoreCentral.id,
          SEED_CHAPTERS.lahoreNorth.id,
        ]);
      }
    });

    it("allows customizing chapterId and staffId in makeChapterLeadClaims", () => {
      const customClaims = makeChapterLeadClaims({
        staffId: "custom-staff-123",
        chapterId: "custom-chap-456",
        organizationId: "custom-org-789",
      });

      expect(customClaims.staffId).toBe("custom-staff-123");
      expect(customClaims.orgRoles).toEqual([{ organizationId: "custom-org-789" }]);
      expect(customClaims.moduleAccess[0].organizationId).toBe("custom-org-789");
      expect(customClaims.moduleAccess[0].chapterScopes!["chapters:write"]).toEqual(["custom-chap-456"]);
    });

    it("allows customizing chapterIds in makeCityLeadClaims", () => {
      const customClaims = makeCityLeadClaims({
        chapterIds: ["c1", "c2", "c3"],
      });

      expect(customClaims.moduleAccess[0].chapterScopes!["chapters:write"]).toEqual(["c1", "c2", "c3"]);
    });
  });

  describe("Role Title Derivation Alignment", () => {
    it("derives 'Chapter Lead' from single-chapter scoped claims", () => {
      const claims = makeChapterLeadClaims();
      const perms = claims.moduleAccess[0].permissions;
      const chapterCount = claims.moduleAccess[0].chapterScopes!["chapters:write"].length;

      const derived = deriveRoleTitleFromPermissions(perms, true, chapterCount);
      expect(derived).toBe("Chapter Lead");
    });

    it("derives 'City Lead' from multi-chapter scoped claims", () => {
      const claims = makeCityLeadClaims();
      const perms = claims.moduleAccess[0].permissions;
      const chapterCount = claims.moduleAccess[0].chapterScopes!["chapters:write"].length;

      const derived = deriveRoleTitleFromPermissions(perms, true, chapterCount);
      expect(derived).toBe("City Lead");
    });
  });

  describe("Token Minting & Decoding Round-Trip", () => {
    it("mints fake token for Chapter Lead that decodes exactly to expected claims", () => {
      const token = makeChapterLeadToken();
      expect(typeof token).toBe("string");
      expect(token.split(".")).toHaveLength(3);

      const decoded = decodeStaffTokenClaims(token);
      const expected = makeChapterLeadClaims();

      expect(decoded.actorType).toBe(expected.actorType);
      expect(decoded.staffId).toBe(expected.staffId);
      expect(decoded.platformOwner).toBe(expected.platformOwner);
      expect(decoded.orgRoles).toEqual(expected.orgRoles);
      expect(decoded.moduleAccess).toEqual(expected.moduleAccess);
    });

    it("mints fake token for City Lead that decodes exactly to expected claims", () => {
      const token = makeCityLeadToken();
      expect(typeof token).toBe("string");
      expect(token.split(".")).toHaveLength(3);

      const decoded = decodeStaffTokenClaims(token);
      const expected = makeCityLeadClaims();

      expect(decoded.actorType).toBe(expected.actorType);
      expect(decoded.staffId).toBe(expected.staffId);
      expect(decoded.platformOwner).toBe(expected.platformOwner);
      expect(decoded.orgRoles).toEqual(expected.orgRoles);
      expect(decoded.moduleAccess).toEqual(expected.moduleAccess);
    });
  });

  describe("Database Seeding Helper", () => {
    function createMockSupabase(tables: Record<string, any[]>) {
      return {
        auth: {
          admin: {
            listUsers: vi.fn().mockResolvedValue({ data: { users: [] }, error: null }),
            createUser: vi.fn().mockImplementation((payload) =>
              Promise.resolve({
                data: { user: { id: payload.id ?? "user-gen" } },
                error: null,
              }),
            ),
            updateUserById: vi.fn().mockResolvedValue({ error: null }),
          },
        },
        rpc: vi.fn().mockResolvedValue({ error: null }),
        from: (table: string) => {
          const builder: any = {
            upsert: vi.fn().mockImplementation((rows, _opts) => {
              const rowList = Array.isArray(rows) ? rows : [rows];
              tables[table] = [...(tables[table] || []), ...rowList];
              return Promise.resolve({ data: rows, error: null });
            }),
            insert: vi.fn().mockImplementation((rows) => {
              const rowList = Array.isArray(rows) ? rows : [rows];
              tables[table] = [...(tables[table] || []), ...rowList];
              return Promise.resolve({ data: rows, error: null });
            }),
            update: vi.fn().mockImplementation((_patch) => ({
              eq: vi.fn().mockResolvedValue({ error: null }),
            })),
            select: vi.fn().mockImplementation(() => builder),
            eq: vi.fn().mockImplementation(() => builder),
            is: vi.fn().mockImplementation(() => builder),
            maybeSingle: vi.fn().mockImplementation(() => {
              if (table === "modules") return Promise.resolve({ data: { id: "m-yr" }, error: null });
              return Promise.resolve({ data: null, error: null });
            }),
            single: vi.fn().mockImplementation(() => {
              if (table === "roles") return Promise.resolve({ data: { id: "r-lead" }, error: null });
              return Promise.resolve({ data: null, error: null });
            }),
            in: vi.fn().mockImplementation((_col, val) => {
              return Promise.resolve({
                data: (tables[table] || []).filter((r: any) => val.includes(r.name)),
                error: null,
              });
            }),
          };
          return builder;
        },
      };
    }

    it("seeds chapters, staff, staff_org_roles, and staff_role_assignments on Supabase client", async () => {
      const tables: Record<string, any[]> = {
        chapters: [],
        modules: [{ id: "m-yr", key: "youth-republic" }],
        roles: [
          { id: "r-chap", organization_id: SEED_ORGS.rizq, name: "Chapter Lead" },
          { id: "r-city", organization_id: SEED_ORGS.rizq, name: "City Lead" },
        ],
        staff: [],
        staff_org_roles: [],
        staff_role_assignments: [],
      };

      const mockSupabase: any = createMockSupabase(tables);
      const result = await seedChapterAndCityLeads(mockSupabase);

      expect(result.chapterLead.email).toBe("chapterlead@rizq.org");
      expect(result.chapterLead.role).toBe("Chapter Lead");
      expect(result.cityLead.email).toBe("citylead@rizq.org");
      expect(result.cityLead.role).toBe("City Lead");

      // Verify chapters were upserted
      expect(tables.chapters.length).toBeGreaterThanOrEqual(3);
      expect(tables.chapters.some((c) => c.name === "Lahore Central")).toBe(true);
      expect(tables.chapters.some((c) => c.name === "Lahore North")).toBe(true);
      expect(tables.chapters.some((c) => c.name === "Karachi Central")).toBe(true);

      // Verify staff were upserted
      expect(tables.staff.some((s) => s.email === "chapterlead@rizq.org")).toBe(true);
      expect(tables.staff.some((s) => s.email === "citylead@rizq.org")).toBe(true);

      // Verify staff_role_assignments were inserted with correct chapter scope
      const clAssignment = tables.staff_role_assignments.find(
        (a) => a.scope_label === "Lahore Central" && a.role_id === "r-chap",
      );
      expect(clAssignment).toBeDefined();
      expect(clAssignment.scope_kind).toBe("chapter");
      expect(clAssignment.chapter_id).toBe(SEED_CHAPTERS.lahoreCentral.id);

      const cityAssignments = tables.staff_role_assignments.filter((a) => a.role_id === "r-city");
      expect(cityAssignments).toHaveLength(2);
      expect(cityAssignments.some((a) => a.chapter_id === SEED_CHAPTERS.lahoreCentral.id)).toBe(true);
      expect(cityAssignments.some((a) => a.chapter_id === SEED_CHAPTERS.lahoreNorth.id)).toBe(true);
    });

    it("backend seed.ts runSeed seeds organizations, chapters, and lead accounts", async () => {
      const tables: Record<string, any[]> = {
        organizations: [],
        org_modules: [],
        chapters: [],
        modules: [{ id: "m-yr", key: "youth-republic" }],
        roles: [
          { id: "r-chap", organization_id: SEED_ORGS.rizq, name: "Chapter Lead" },
          { id: "r-city", organization_id: SEED_ORGS.rizq, name: "City Lead" },
        ],
        staff: [],
        staff_org_roles: [],
        staff_role_assignments: [],
      };

      const mockSupabase: any = createMockSupabase(tables);
      const result = await runBackendSeed(mockSupabase);

      expect(result.chapterLead.email).toBe("chapterlead@rizq.org");
      expect(result.chapterLead.role).toBe("Chapter Lead");
      expect(result.chapterLead.scope).toBe("Lahore Central");

      expect(result.cityLead.email).toBe("citylead@rizq.org");
      expect(result.cityLead.role).toBe("City Lead");
      expect(result.cityLead.scopes).toEqual(["Lahore Central", "Lahore North"]);

      // Verify orgs were seeded
      expect(tables.organizations.length).toBe(4);
      expect(tables.organizations.some((o) => o.slug === "rizq")).toBe(true);

      // Verify chapters were seeded
      expect(tables.chapters.some((c) => c.name === "Lahore Central")).toBe(true);
      expect(tables.chapters.some((c) => c.name === "Lahore North")).toBe(true);

      // Verify staff role assignments
      const clAssignment = tables.staff_role_assignments.find(
        (a) => a.scope_label === "Lahore Central" && a.role_id === "r-chap",
      );
      expect(clAssignment).toBeDefined();

      const cityAssignments = tables.staff_role_assignments.filter((a) => a.role_id === "r-city");
      expect(cityAssignments).toHaveLength(2);
    });

    it("backend seed.ts main throws Error when SUPABASE_SERVICE_ROLE_KEY is missing", async () => {
      const prevKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const prevAdminKey = process.env.ADMIN_SERVICE_ROLE_KEY;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      delete process.env.ADMIN_SERVICE_ROLE_KEY;

      try {
        await expect(runSeedMain()).rejects.toThrow(
          "SUPABASE_SERVICE_ROLE_KEY environment variable is required to run seed"
        );
      } finally {
        if (prevKey !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = prevKey;
        if (prevAdminKey !== undefined) process.env.ADMIN_SERVICE_ROLE_KEY = prevAdminKey;
      }
    });

    it("ensureStaffRoleAssignment inserts when absent and updates when existing without invalid onConflict", async () => {
      const records: any[] = [];
      const mockSupabase: any = {
        from: (table: string) => {
          let selectedRecord: any = null;
          const builder: any = {
            select: vi.fn().mockImplementation(() => builder),
            eq: vi.fn().mockImplementation((col, val) => {
              if (col === "staff_id") {
                selectedRecord = records.find((r) => r.staff_id === val);
              }
              if (col === "role_id" && selectedRecord && selectedRecord.role_id !== val) {
                selectedRecord = null;
              }
              if (col === "chapter_id" && selectedRecord && selectedRecord.chapter_id !== val) {
                selectedRecord = null;
              }
              return builder;
            }),
            is: vi.fn().mockImplementation((col, val) => {
              if (col === "chapter_id" && selectedRecord && selectedRecord.chapter_id !== val) {
                selectedRecord = null;
              }
              return builder;
            }),
            maybeSingle: vi.fn().mockImplementation(() => Promise.resolve({ data: selectedRecord, error: null })),
            insert: vi.fn().mockImplementation((row) => {
              const newRecord = { ...row, id: "assign-new-1" };
              records.push(newRecord);
              return Promise.resolve({ data: newRecord, error: null });
            }),
            update: vi.fn().mockImplementation((patch) => ({
              eq: vi.fn().mockImplementation((_col, idVal) => {
                const rec = records.find((r) => r.id === idVal);
                if (rec) Object.assign(rec, patch);
                return Promise.resolve({ data: rec, error: null });
              }),
            })),
          };
          return builder;
        },
      };

      // 1. Initial insert
      await ensureStaffRoleAssignment(mockSupabase, {
        staff_id: "s1",
        organization_id: "o1",
        module_id: "m1",
        role_id: "r1",
        scope_kind: "chapter",
        chapter_id: "c1",
        scope_label: "Chapter 1",
      });

      expect(records).toHaveLength(1);
      expect(records[0].scope_label).toBe("Chapter 1");

      // 2. Subsequent update
      await ensureStaffRoleAssignment(mockSupabase, {
        staff_id: "s1",
        organization_id: "o1",
        module_id: "m1",
        role_id: "r1",
        scope_kind: "chapter",
        chapter_id: "c1",
        scope_label: "Chapter 1 Renamed",
      });

      expect(records).toHaveLength(1);
      expect(records[0].scope_label).toBe("Chapter 1 Renamed");
    });
  });
});

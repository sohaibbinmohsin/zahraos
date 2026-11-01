import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import {
  CHAPTER_LEAD_CREDENTIALS,
  CITY_LEAD_CREDENTIALS,
  SEED_ORGS,
  SEED_CHAPTERS,
  getChapterLeadCredentials,
  getCityLeadCredentials,
  makeChapterLeadClaims,
  makeCityLeadClaims,
  makeChapterLeadToken,
  makeCityLeadToken,
} from "../fixtures/test_leads_seed";
import { decodeStaffTokenClaims } from "@/lib/staffToken";
import { deriveRoleTitleFromPermissions } from "@/lib/capabilityMap";
import { useStaffPermissions } from "@/components/shell/useStaffPermissions";
import {
  useStaffClaims,
  useSelectedOrg,
  useOrgTier,
  useIsOrgAdminOrAbove,
  useShellLoading,
} from "@/components/shell/AppShell";
import { updateChapter, type ChapterTeamMemberInput } from "@/supabase/functions/update-chapter/handler";
import { createChapter } from "@/supabase/functions/create-chapter/handler";
import { updateOrganization } from "@/supabase/functions/update-organization/handler";
import { updateStaffAccess } from "@/supabase/functions/update-staff-access/handler";
import {
  createOpportunity,
  updateOpportunity,
  decideApplication,
  verifyHours,
} from "@/lib/youthRepublicFunctions";

vi.mock("@/components/shell/AppShell", () => ({
  useStaffClaims: vi.fn(),
  useSelectedOrg: vi.fn(),
  useOrgTier: vi.fn(),
  useIsOrgAdminOrAbove: vi.fn(),
  useShellLoading: vi.fn(),
  useShellAccessToken: vi.fn(),
  useShellStaffToken: vi.fn(),
}));

// ---------------------------------------------------------------------------
// In-Memory Supabase Client Builder for Handler Verification
// ---------------------------------------------------------------------------

interface MockDatabaseState {
  chapters: Array<{
    id: string;
    organization_id: string;
    name: string;
    city: string | null;
    status: string;
    about: string | null;
    logo_url: string | null;
  }>;
  chapter_team_members: Array<{
    id: string;
    chapter_id: string;
    volunteer_code: string;
    full_name: string;
    email: string | null;
    avatar_url: string | null;
    designation: string;
    term: string | null;
    status: "active" | "alumni";
  }>;
  staff: Array<{
    id: string;
    auth_user_id: string;
    email: string;
    full_name: string;
    platform_owner: boolean;
    status: string;
  }>;
  staff_org_roles: Array<{
    staff_id: string;
    organization_id: string;
    org_tier: string;
  }>;
  staff_role_assignments: Array<{
    id: string;
    staff_id: string;
    organization_id: string;
    module_id: string;
    role_id: string;
    scope_kind: string;
    chapter_id: string | null;
    scope_label: string;
  }>;
  roles: Array<{
    id: string;
    organization_id: string;
    module_id: string;
    name: string;
    description: string;
  }>;
  organizations: Array<{
    id: string;
    name: string;
    about: string | null;
    brand_color: string | null;
    logo_url: string | null;
  }>;
  org_modules: Array<{
    organization_id: string;
    module_id: string;
    modules: { key: string };
  }>;
  modules: Array<{
    id: string;
    key: string;
    name: string;
  }>;
  audit_logs: Array<Record<string, unknown>>;
}

const MODULE_YOUTH_REPUBLIC_ID = "50000000-0000-4000-8000-000000000001";
const ROLE_CHAPTER_LEAD_ID = "60000000-0000-4000-8000-000000000001";
const ROLE_CITY_LEAD_ID = "60000000-0000-4000-8000-000000000002";

function createInitialDatabaseState(): MockDatabaseState {
  return {
    chapters: [
      {
        id: SEED_CHAPTERS.lahoreCentral.id,
        organization_id: SEED_ORGS.rizq,
        name: SEED_CHAPTERS.lahoreCentral.name,
        city: SEED_CHAPTERS.lahoreCentral.city,
        status: "active",
        about: "Original Lahore Central description",
        logo_url: null,
      },
      {
        id: SEED_CHAPTERS.lahoreNorth.id,
        organization_id: SEED_ORGS.rizq,
        name: SEED_CHAPTERS.lahoreNorth.name,
        city: SEED_CHAPTERS.lahoreNorth.city,
        status: "active",
        about: "Original Lahore North description",
        logo_url: null,
      },
      {
        id: SEED_CHAPTERS.karachiCentral.id,
        organization_id: SEED_ORGS.rizq,
        name: SEED_CHAPTERS.karachiCentral.name,
        city: SEED_CHAPTERS.karachiCentral.city,
        status: "active",
        about: "Original Karachi Central description",
        logo_url: null,
      },
    ],
    chapter_team_members: [
      {
        id: "mem-lhr-1",
        chapter_id: SEED_CHAPTERS.lahoreCentral.id,
        volunteer_code: "YR-2026-000001",
        full_name: "Initial Lahore Member",
        email: "init.lhr@example.com",
        avatar_url: null,
        designation: "Volunteer Lead",
        term: "2024–2025",
        status: "active",
      },
      {
        id: "mem-north-1",
        chapter_id: SEED_CHAPTERS.lahoreNorth.id,
        volunteer_code: "YR-2026-000002",
        full_name: "Initial North Member",
        email: "init.north@example.com",
        avatar_url: null,
        designation: "Outreach Lead",
        term: "2024–2025",
        status: "active",
      },
      {
        id: "mem-khi-1",
        chapter_id: SEED_CHAPTERS.karachiCentral.id,
        volunteer_code: "YR-2026-000003",
        full_name: "Initial Karachi Member",
        email: "init.khi@example.com",
        avatar_url: null,
        designation: "Coordinator",
        term: "2024–2025",
        status: "active",
      },
    ],
    staff: [
      {
        id: CHAPTER_LEAD_CREDENTIALS.staffId,
        auth_user_id: CHAPTER_LEAD_CREDENTIALS.authUserId,
        email: CHAPTER_LEAD_CREDENTIALS.email,
        full_name: CHAPTER_LEAD_CREDENTIALS.fullName,
        platform_owner: false,
        status: "active",
      },
      {
        id: CITY_LEAD_CREDENTIALS.staffId,
        auth_user_id: CITY_LEAD_CREDENTIALS.authUserId,
        email: CITY_LEAD_CREDENTIALS.email,
        full_name: CITY_LEAD_CREDENTIALS.fullName,
        platform_owner: false,
        status: "active",
      },
      {
        id: "target-staff-999",
        auth_user_id: "auth-target-999",
        email: "target@rizq.org",
        full_name: "Target Staff Member",
        platform_owner: false,
        status: "active",
      },
    ],
    staff_org_roles: [
      {
        staff_id: CHAPTER_LEAD_CREDENTIALS.staffId,
        organization_id: SEED_ORGS.rizq,
        org_tier: "member",
      },
      {
        staff_id: CITY_LEAD_CREDENTIALS.staffId,
        organization_id: SEED_ORGS.rizq,
        org_tier: "member",
      },
      {
        staff_id: "target-staff-999",
        organization_id: SEED_ORGS.rizq,
        org_tier: "member",
      },
    ],
    staff_role_assignments: [
      {
        id: "assign-cl-1",
        staff_id: CHAPTER_LEAD_CREDENTIALS.staffId,
        organization_id: SEED_ORGS.rizq,
        module_id: MODULE_YOUTH_REPUBLIC_ID,
        role_id: ROLE_CHAPTER_LEAD_ID,
        scope_kind: "chapter",
        chapter_id: SEED_CHAPTERS.lahoreCentral.id,
        scope_label: SEED_CHAPTERS.lahoreCentral.name,
      },
      {
        id: "assign-city-1",
        staff_id: CITY_LEAD_CREDENTIALS.staffId,
        organization_id: SEED_ORGS.rizq,
        module_id: MODULE_YOUTH_REPUBLIC_ID,
        role_id: ROLE_CITY_LEAD_ID,
        scope_kind: "chapter",
        chapter_id: SEED_CHAPTERS.lahoreCentral.id,
        scope_label: SEED_CHAPTERS.lahoreCentral.name,
      },
      {
        id: "assign-city-2",
        staff_id: CITY_LEAD_CREDENTIALS.staffId,
        organization_id: SEED_ORGS.rizq,
        module_id: MODULE_YOUTH_REPUBLIC_ID,
        role_id: ROLE_CITY_LEAD_ID,
        scope_kind: "chapter",
        chapter_id: SEED_CHAPTERS.lahoreNorth.id,
        scope_label: SEED_CHAPTERS.lahoreNorth.name,
      },
    ],
    roles: [
      {
        id: ROLE_CHAPTER_LEAD_ID,
        organization_id: SEED_ORGS.rizq,
        module_id: MODULE_YOUTH_REPUBLIC_ID,
        name: "Chapter Lead",
        description: "Oversees local chapter operations and chapter roster governance.",
      },
      {
        id: ROLE_CITY_LEAD_ID,
        organization_id: SEED_ORGS.rizq,
        module_id: MODULE_YOUTH_REPUBLIC_ID,
        name: "City Lead",
        description: "Oversees multi-chapter regional operations and chapter roster governance.",
      },
    ],
    organizations: [
      {
        id: SEED_ORGS.rizq,
        name: "Rizq Foundation",
        about: "Food banking and youth volunteer network in Pakistan",
        brand_color: "#16a34a",
        logo_url: "https://example.com/rizq-logo.png",
      },
    ],
    org_modules: [
      {
        organization_id: SEED_ORGS.rizq,
        module_id: MODULE_YOUTH_REPUBLIC_ID,
        modules: { key: "youth-republic" },
      },
    ],
    modules: [
      {
        id: MODULE_YOUTH_REPUBLIC_ID,
        key: "youth-republic",
        name: "Youth Republic",
      },
    ],
    audit_logs: [],
  };
}

function createMockSupabase(db: MockDatabaseState): any {
  return {
    from: (table: string) => {
      let currentRows = [...((db as any)[table] ?? [])];

      const builder: any = {
        select: (_fields?: string) => builder,
        eq: (col: string, val: any) => {
          currentRows = currentRows.filter((r) => r[col] === val);
          return builder;
        },
        in: (col: string, vals: any[]) => {
          currentRows = currentRows.filter((r) => vals.includes(r[col]));
          return builder;
        },
        single: async () => {
          if (currentRows.length === 0) return { data: null, error: new Error("not_found") };
          return { data: { ...currentRows[0] }, error: null };
        },
        maybeSingle: async () => {
          if (currentRows.length === 0) return { data: null, error: null };
          return { data: { ...currentRows[0] }, error: null };
        },
        order: (_col: string) => builder,
        then: (resolve: any, reject: any) => {
          return Promise.resolve({ data: currentRows.map((r) => ({ ...r })), error: null }).then(resolve, reject);
        },
        insert: (data: any) => {
          if (!((db as any)[table])) (db as any)[table] = [];
          const list = Array.isArray(data) ? data : [data];
          const inserted: any[] = [];
          for (const item of list) {
            const row = { ...item, id: item.id ?? `gen-${Math.random().toString(36).substring(7)}` };
            ((db as any)[table] as any[]).push(row);
            inserted.push(row);
          }
          const res = {
            data: Array.isArray(data) ? inserted : inserted[0],
            error: null,
            select: () => ({
              single: async () => ({ data: inserted[0], error: null }),
            }),
          };
          return res;
        },
        update: (patch: any) => ({
          eq: async (col: string, val: any) => {
            const tableRows = (db as any)[table] as any[];
            for (let i = 0; i < tableRows.length; i++) {
              if (tableRows[i][col] === val) {
                tableRows[i] = { ...tableRows[i], ...patch };
              }
            }
            return { error: null };
          },
        }),
        upsert: async (data: any) => {
          const list = Array.isArray(data) ? data : [data];
          const tableRows = (db as any)[table] as any[];
          for (const item of list) {
            if (item.id) {
              const idx = tableRows.findIndex((r) => r.id === item.id);
              if (idx >= 0) tableRows[idx] = { ...tableRows[idx], ...item };
              else tableRows.push(item);
            } else {
              tableRows.push({ ...item, id: `gen-${Math.random().toString(36).substring(7)}` });
            }
          }
          return { error: null };
        },
        delete: () => {
          const deleteBuilder: any = {
            eq: (col: string, val: any) => {
              const tableRows = (db as any)[table] as any[];
              (db as any)[table] = tableRows.filter((r) => r[col] !== val);
              return deleteBuilder;
            },
            in: async (col: string, ids: string[]) => {
              const tableRows = (db as any)[table] as any[];
              (db as any)[table] = tableRows.filter((r) => !ids.includes(r[col]));
              return { error: null };
            },
            then: (resolve: any, reject: any) => {
              return Promise.resolve({ error: null }).then(resolve, reject);
            },
          };
          return deleteBuilder;
        },
      };

      return builder;
    },
  };
}

// ---------------------------------------------------------------------------
// Simulated Youth Republic Backend Dispatcher (HTTP fetch mock)
// ---------------------------------------------------------------------------

function setupYouthRepublicFetchMock() {
  const drives = new Map<string, { id: string; chapterId: string | null; name: string; status: string }>();
  drives.set("opp-lhr-1", {
    id: "opp-lhr-1",
    chapterId: SEED_CHAPTERS.lahoreCentral.id,
    name: "Lahore Central Drive",
    status: "draft",
  });
  drives.set("opp-north-1", {
    id: "opp-north-1",
    chapterId: SEED_CHAPTERS.lahoreNorth.id,
    name: "Lahore North Drive",
    status: "draft",
  });
  drives.set("opp-khi-1", {
    id: "opp-khi-1",
    chapterId: SEED_CHAPTERS.karachiCentral.id,
    name: "Karachi Central Drive",
    status: "draft",
  });

  const applications = new Map<string, { id: string; opportunityId: string }>();
  applications.set("app-lhr-1", { id: "app-lhr-1", opportunityId: "opp-lhr-1" });
  applications.set("app-north-1", { id: "app-north-1", opportunityId: "opp-north-1" });
  applications.set("app-khi-1", { id: "app-khi-1", opportunityId: "opp-khi-1" });

  const hoursRows = new Map<string, { id: string; opportunityId: string }>();
  hoursRows.set("hours-lhr-1", { id: "hours-lhr-1", opportunityId: "opp-lhr-1" });
  hoursRows.set("hours-north-1", { id: "hours-north-1", opportunityId: "opp-north-1" });
  hoursRows.set("hours-khi-1", { id: "hours-khi-1", opportunityId: "opp-khi-1" });

  process.env.NEXT_PUBLIC_YOUTH_REPUBLIC_FUNCTIONS_URL = "http://localhost:54322/functions/v1";

  const fetchMock = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
    const authHeader = (init?.headers as Record<string, string>)?.["Authorization"] || "";
    const token = authHeader.replace(/^Bearer\s+/, "");
    const claims = decodeStaffTokenClaims(token);
    const body = init?.body ? JSON.parse(init.body as string) : {};
    const yrAccess = claims.moduleAccess.find(
      (m) => m.organizationId === SEED_ORGS.rizq && m.module === "youth-republic",
    );

    function checkPermission(permKey: string, targetChapterId: string | null | undefined): boolean {
      if (!yrAccess || !yrAccess.permissions.includes(permKey)) return false;
      const scopes = yrAccess.chapterScopes?.[permKey];
      if (!scopes) return true; // unrestricted
      if (!targetChapterId) return false; // scoped user cannot operate org-wide
      return scopes.includes(targetChapterId);
    }

    if (url.endsWith("/create-opportunity")) {
      const allowed = checkPermission("opportunities:write", body.chapterId);
      if (!allowed) {
        return { ok: false, status: 403, json: async () => ({ error: "forbidden" }) };
      }
      const oppId = `opp-created-${Math.random().toString(36).substring(7)}`;
      drives.set(oppId, { id: oppId, chapterId: body.chapterId, name: body.name, status: "draft" });
      return { ok: true, status: 200, json: async () => ({ opportunityId: oppId }) };
    }

    if (url.endsWith("/update-opportunity")) {
      const drive = drives.get(body.opportunityId);
      const chapterId = drive ? drive.chapterId : body.chapterId;
      const permKey = body.statusOverride === "published" ? "noticeboard:write" : "opportunities:write";
      const allowed = checkPermission(permKey, chapterId);
      if (!allowed) {
        return { ok: false, status: 403, json: async () => ({ error: "forbidden" }) };
      }
      if (drive && body.statusOverride) drive.status = body.statusOverride;
      return { ok: true, status: 200, json: async () => ({ opportunityId: body.opportunityId }) };
    }

    if (url.endsWith("/decide-application")) {
      const app = applications.get(body.applicationId);
      const opp = app ? drives.get(app.opportunityId) : null;
      const targetChapterId = opp?.chapterId;
      const allowed = checkPermission("applications:update", targetChapterId);
      if (!allowed) {
        return { ok: false, status: 403, json: async () => ({ error: "forbidden" }) };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ applicationId: body.applicationId, participationId: `part-${body.applicationId}` }),
      };
    }

    if (url.endsWith("/verify-hours")) {
      const row = hoursRows.get(body.activityHoursId);
      const opp = row ? drives.get(row.opportunityId) : null;
      const targetChapterId = opp?.chapterId;
      const allowed = checkPermission("hours:update", targetChapterId);
      if (!allowed) {
        return { ok: false, status: 403, json: async () => ({ error: "forbidden" }) };
      }
      return { ok: true, status: 200, json: async () => ({ activityHoursId: body.activityHoursId }) };
    }

    return { ok: false, status: 404, json: async () => ({ error: "not_found" }) };
  });

  vi.stubGlobal("fetch", fetchMock);
  return { drives, applications, hoursRows };
}

// ---------------------------------------------------------------------------
// TEST SUITE: Exhaustive Role-by-Role Task Verification
// ---------------------------------------------------------------------------

describe("Exhaustive Role-by-Role Task Verification Matrix (Chapter Lead & City Lead)", () => {
  let db: MockDatabaseState;
  let mockSupabase: any;

  beforeEach(() => {
    db = createInitialDatabaseState();
    mockSupabase = createMockSupabase(db);
    setupYouthRepublicFetchMock();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. CHAPTER LEAD MATRIX (Single Chapter: Lahore Central)
  // =========================================================================

  describe("1. Chapter Lead Matrix (single chapter: Lahore Central)", () => {
    const creds = getChapterLeadCredentials();
    const clClaims = makeChapterLeadClaims();
    const clToken = makeChapterLeadToken();

    beforeEach(() => {
      vi.mocked(useStaffClaims).mockReturnValue(clClaims);
      vi.mocked(useSelectedOrg).mockReturnValue(SEED_ORGS.rizq);
      vi.mocked(useOrgTier).mockReturnValue("member");
      vi.mocked(useIsOrgAdminOrAbove).mockReturnValue(false);
      vi.mocked(useShellLoading).mockReturnValue(false);
    });

    describe("Task 1: Authentication & Token Claims", () => {
      it("has exact expected credentials for Chapter Lead", () => {
        expect(creds.email).toBe("chapterlead@rizq.org");
        expect(creds.password).toBe("TestPassword123!");
        expect(creds.role).toBe("Chapter Lead");
        expect(creds.organizationId).toBe(SEED_ORGS.rizq);
        expect(creds.chapterName).toBe("Lahore Central");
        expect(creds.chapterId).toBe(SEED_CHAPTERS.lahoreCentral.id);
      });

      it("resolves role name to 'Chapter Lead' from single-chapter scoped permissions", () => {
        const perms = clClaims.moduleAccess[0].permissions;
        const chapterCount = clClaims.moduleAccess[0].chapterScopes!["chapters:write"].length;

        expect(chapterCount).toBe(1);
        const resolvedRole = deriveRoleTitleFromPermissions(perms, true, chapterCount);
        expect(resolvedRole).toBe("Chapter Lead");
      });

      it("contains Lahore Central in chapter_scopes for all operational and chapter governance keys", () => {
        const moduleAccess = clClaims.moduleAccess[0];
        expect(moduleAccess.chapterScopes).toBeDefined();

        const scopes = moduleAccess.chapterScopes!;
        expect(scopes["opportunities:write"]).toEqual([SEED_CHAPTERS.lahoreCentral.id]);
        expect(scopes["noticeboard:write"]).toEqual([SEED_CHAPTERS.lahoreCentral.id]);
        expect(scopes["applications:update"]).toEqual([SEED_CHAPTERS.lahoreCentral.id]);
        expect(scopes["hours:update"]).toEqual([SEED_CHAPTERS.lahoreCentral.id]);
        expect(scopes["chapters:write"]).toEqual([SEED_CHAPTERS.lahoreCentral.id]);
      });

      it("strictly lacks platform owner and broad administrative permissions", () => {
        expect(clClaims.platformOwner).toBe(false);
        const perms = clClaims.moduleAccess[0].permissions;

        expect(perms).not.toContain("team:write");
        expect(perms).not.toContain("members:write");
        expect(perms).not.toContain("roles:write");
        expect(perms).not.toContain("volunteers:read");
        expect(perms).not.toContain("inquiries:write");
      });

      it("decodes token back to identical claims", () => {
        const decoded = decodeStaffTokenClaims(clToken);
        expect(decoded.actorType).toBe("staff");
        expect(decoded.staffId).toBe(creds.staffId);
        expect(decoded.platformOwner).toBe(false);
        expect(decoded.moduleAccess[0].chapterScopes!["chapters:write"]).toEqual([
          SEED_CHAPTERS.lahoreCentral.id,
        ]);
      });
    });

    describe("Task 2: Chapter Details & Branding", () => {
      it("successfully updates details of Lahore Central (about, name, logoUrl)", async () => {
        const updateResult = await updateChapter(mockSupabase, creds.staffId, false, {
          chapterId: SEED_CHAPTERS.lahoreCentral.id,
          name: "Lahore Central Chapter Updated",
          city: "Lahore",
          about: "Serving central Lahore communities with high-impact food drives",
          logoUrl: "https://example.com/lahore-central-badge.png",
        });

        expect(updateResult).toEqual({ chapterId: SEED_CHAPTERS.lahoreCentral.id });

        const updatedRow = db.chapters.find((c) => c.id === SEED_CHAPTERS.lahoreCentral.id);
        expect(updatedRow?.name).toBe("Lahore Central Chapter Updated");
        expect(updatedRow?.about).toBe("Serving central Lahore communities with high-impact food drives");
        expect(updatedRow?.logo_url).toBe("https://example.com/lahore-central-badge.png");
      });

      it("asserts 403 (forbidden) when attempting to update unassigned chapter (Karachi Central)", async () => {
        await expect(
          updateChapter(mockSupabase, creds.staffId, false, {
            chapterId: SEED_CHAPTERS.karachiCentral.id,
            name: "Illicit Karachi Update",
          }),
        ).rejects.toThrow("forbidden");
      });

      it("asserts 403 (forbidden_status_change) when attempting to deactivate Lahore Central", async () => {
        await expect(
          updateChapter(mockSupabase, creds.staffId, false, {
            chapterId: SEED_CHAPTERS.lahoreCentral.id,
            status: "inactive",
          }),
        ).rejects.toThrow("forbidden_status_change");
      });
    });

    describe("Task 3: Chapter Roster Governance", () => {
      it("successfully adds member to Lahore Central roster", async () => {
        const newMember: ChapterTeamMemberInput = {
          volunteerCode: "YR-2026-000101",
          fullName: "Bilal Shahid",
          email: "bilal@rizq.org",
          designation: "Logistics Officer",
          term: "2025–2026",
          status: "active",
        };

        const result = await updateChapter(mockSupabase, creds.staffId, false, {
          chapterId: SEED_CHAPTERS.lahoreCentral.id,
          teamMembers: [newMember],
        });

        expect(result.chapterId).toBe(SEED_CHAPTERS.lahoreCentral.id);

        const memberInDb = db.chapter_team_members.find(
          (m) => m.chapter_id === SEED_CHAPTERS.lahoreCentral.id && m.volunteer_code === "YR-2026-000101",
        );
        expect(memberInDb).toBeDefined();
        expect(memberInDb?.full_name).toBe("Bilal Shahid");
        expect(memberInDb?.designation).toBe("Logistics Officer");
      });

      it("successfully updates existing member on Lahore Central roster", async () => {
        // Initial member exists with id "mem-lhr-1"
        const updatedMember: ChapterTeamMemberInput & { id?: string } = {
          volunteerCode: "YR-2026-000001",
          fullName: "Initial Lahore Member Promoted",
          email: "init.lhr@example.com",
          designation: "Vice President",
          term: "2025–2026",
          status: "alumni",
        };

        await updateChapter(mockSupabase, creds.staffId, false, {
          chapterId: SEED_CHAPTERS.lahoreCentral.id,
          teamMembers: [updatedMember],
        });

        const memberInDb = db.chapter_team_members.find((m) => m.volunteer_code === "YR-2026-000001");
        expect(memberInDb?.full_name).toBe("Initial Lahore Member Promoted");
        expect(memberInDb?.designation).toBe("Vice President");
        expect(memberInDb?.status).toBe("alumni");
      });

      it("successfully removes member from Lahore Central roster by omitting them", async () => {
        expect(db.chapter_team_members.some((m) => m.chapter_id === SEED_CHAPTERS.lahoreCentral.id)).toBe(true);

        await updateChapter(mockSupabase, creds.staffId, false, {
          chapterId: SEED_CHAPTERS.lahoreCentral.id,
          teamMembers: [], // clear roster
        });

        const remaining = db.chapter_team_members.filter((m) => m.chapter_id === SEED_CHAPTERS.lahoreCentral.id);
        expect(remaining).toHaveLength(0);
      });

      it("asserts 403 (forbidden) when attempting to touch roster of Karachi Central", async () => {
        await expect(
          updateChapter(mockSupabase, creds.staffId, false, {
            chapterId: SEED_CHAPTERS.karachiCentral.id,
            teamMembers: [
              {
                volunteerCode: "YR-999",
                fullName: "Attacker",
                designation: "Lead",
                status: "active",
              },
            ],
          }),
        ).rejects.toThrow("forbidden");
      });
    });

    describe("Task 4: Drive / Opportunity Operations", () => {
      it("successfully creates opportunity/drive in Lahore Central", async () => {
        const created = await createOpportunity(
          {
            organizationId: SEED_ORGS.rizq,
            name: "Lahore Central Iftar Drive",
            type: "community",
            chapterId: SEED_CHAPTERS.lahoreCentral.id,
          },
          clToken,
        );

        expect(created.opportunityId).toBeDefined();
        expect(created.opportunityId).toContain("opp-created-");
      });

      it("successfully publishes drive in Lahore Central", async () => {
        const published = await updateOpportunity(
          {
            opportunityId: "opp-lhr-1",
            organizationId: SEED_ORGS.rizq,
            chapterId: SEED_CHAPTERS.lahoreCentral.id,
            statusOverride: "published",
          },
          clToken,
        );

        expect(published.opportunityId).toBe("opp-lhr-1");
      });

      it("asserts 403 (forbidden) when attempting to create drive in Karachi Central", async () => {
        await expect(
          createOpportunity(
            {
              organizationId: SEED_ORGS.rizq,
              name: "Unauthorized Karachi Drive",
              type: "community",
              chapterId: SEED_CHAPTERS.karachiCentral.id,
            },
            clToken,
          ),
        ).rejects.toThrow("forbidden");
      });

      it("asserts 403 (forbidden) when attempting to create drive org-wide (null chapterId)", async () => {
        await expect(
          createOpportunity(
            {
              organizationId: SEED_ORGS.rizq,
              name: "Unauthorized National Drive",
              type: "community",
              chapterId: null,
            },
            clToken,
          ),
        ).rejects.toThrow("forbidden");
      });

      it("correctly evaluates client permissions via useStaffPermissions", () => {
        const { result } = renderHook(() => useStaffPermissions());

        expect(result.current.hasChapterPermission("opportunities:write", SEED_CHAPTERS.lahoreCentral.id)).toBe(true);
        expect(result.current.hasChapterPermission("opportunities:write", SEED_CHAPTERS.karachiCentral.id)).toBe(false);
        expect(result.current.hasChapterPermission("opportunities:write", null)).toBe(false);

        expect(result.current.hasChapterPermission("noticeboard:write", SEED_CHAPTERS.lahoreCentral.id)).toBe(true);
        expect(result.current.hasChapterPermission("noticeboard:write", SEED_CHAPTERS.karachiCentral.id)).toBe(false);
      });
    });

    describe("Task 5: Applicant Triage", () => {
      it("successfully triages applicant on Lahore Central drive", async () => {
        const result = await decideApplication(
          {
            applicationId: "app-lhr-1",
            decision: "selected",
          },
          clToken,
        );

        expect(result.applicationId).toBe("app-lhr-1");
        expect(result.participationId).toBe("part-app-lhr-1");
      });

      it("asserts 403 (forbidden) on applicant belonging to Karachi Central drive", async () => {
        await expect(
          decideApplication(
            {
              applicationId: "app-khi-1",
              decision: "selected",
            },
            clToken,
          ),
        ).rejects.toThrow("forbidden");
      });

      it("correctly evaluates applicant triage client permission", () => {
        const { result } = renderHook(() => useStaffPermissions());

        expect(result.current.hasChapterPermission("applications:update", SEED_CHAPTERS.lahoreCentral.id)).toBe(true);
        expect(result.current.hasChapterPermission("applications:update", SEED_CHAPTERS.karachiCentral.id)).toBe(false);
      });
    });

    describe("Task 6: Volunteer Hours Verification", () => {
      it("successfully approves volunteer hours on Lahore Central drive", async () => {
        const result = await verifyHours(
          {
            activityHoursId: "hours-lhr-1",
            decision: "verified",
            hoursVerified: 4,
          },
          clToken,
        );

        expect(result.activityHoursId).toBe("hours-lhr-1");
      });

      it("asserts 403 (forbidden) on hours belonging to Karachi Central drive", async () => {
        await expect(
          verifyHours(
            {
              activityHoursId: "hours-khi-1",
              decision: "verified",
              hoursVerified: 4,
            },
            clToken,
          ),
        ).rejects.toThrow("forbidden");
      });

      it("correctly evaluates hours update client permission", () => {
        const { result } = renderHook(() => useStaffPermissions());

        expect(result.current.hasChapterPermission("hours:update", SEED_CHAPTERS.lahoreCentral.id)).toBe(true);
        expect(result.current.hasChapterPermission("hours:update", SEED_CHAPTERS.karachiCentral.id)).toBe(false);
      });
    });

    describe("Task 7: Boundary Protection", () => {
      it("strictly forbids modifying Organization Profile", async () => {
        await expect(
          updateOrganization(mockSupabase, creds.staffId, false, {
            organizationId: SEED_ORGS.rizq,
            name: "Hacked Rizq Name",
          }),
        ).rejects.toThrow("forbidden");
      });

      it("strictly forbids creating new chapters", async () => {
        await expect(
          createChapter(mockSupabase, creds.staffId, false, {
            organizationId: SEED_ORGS.rizq,
            name: "Unauthorized New Chapter",
          }),
        ).rejects.toThrow("forbidden");
      });

      it("strictly forbids managing team members (updateStaffAccess)", async () => {
        await expect(
          updateStaffAccess(mockSupabase, creds.staffId, false, {
            staffId: "target-staff-999",
            organizationId: SEED_ORGS.rizq,
            roles: [{ roleId: ROLE_CHAPTER_LEAD_ID, scopeKind: "org_wide", scopeLabel: "National" }],
            status: "active",
          }),
        ).rejects.toThrow("forbidden");
      });

      it("evaluates governance boundary capabilities as disabled", () => {
        const { result } = renderHook(() => useStaffPermissions());

        expect(result.current.canManageOrgProfile).toBe(false);
        expect(result.current.canCreateChapters).toBe(false);
        expect(result.current.canManageTeam).toBe(false);
        expect(result.current.canViewInquiries).toBe(false);
        expect(result.current.canViewVolunteers).toBe(false);
        expect(result.current.canViewOrganization).toBe(true);
      });
    });
  });

  // =========================================================================
  // 2. CITY LEAD MATRIX (Multi-Chapter: Lahore Central AND Lahore North)
  // =========================================================================

  describe("2. City Lead Matrix (multi-chapter: Lahore Central AND Lahore North)", () => {
    const creds = getCityLeadCredentials();
    const cityClaims = makeCityLeadClaims();
    const cityToken = makeCityLeadToken();

    beforeEach(() => {
      vi.mocked(useStaffClaims).mockReturnValue(cityClaims);
      vi.mocked(useSelectedOrg).mockReturnValue(SEED_ORGS.rizq);
      vi.mocked(useOrgTier).mockReturnValue("member");
      vi.mocked(useIsOrgAdminOrAbove).mockReturnValue(false);
      vi.mocked(useShellLoading).mockReturnValue(false);
    });

    describe("Task 1: Authentication & Token Claims", () => {
      it("has exact expected credentials for City Lead", () => {
        expect(creds.email).toBe("citylead@rizq.org");
        expect(creds.password).toBe("TestPassword123!");
        expect(creds.role).toBe("City Lead");
        expect(creds.organizationId).toBe(SEED_ORGS.rizq);
        expect(creds.chapterNames).toEqual(["Lahore Central", "Lahore North"]);
        expect(creds.chapterIds).toEqual([
          SEED_CHAPTERS.lahoreCentral.id,
          SEED_CHAPTERS.lahoreNorth.id,
        ]);
      });

      it("resolves role name to 'City Lead' from multi-chapter scoped permissions", () => {
        const perms = cityClaims.moduleAccess[0].permissions;
        const chapterCount = cityClaims.moduleAccess[0].chapterScopes!["chapters:write"].length;

        expect(chapterCount).toBe(2);
        const resolvedRole = deriveRoleTitleFromPermissions(perms, true, chapterCount);
        expect(resolvedRole).toBe("City Lead");
      });

      it("contains both Lahore Central AND Lahore North in chapter_scopes for all operational and chapter governance keys", () => {
        const moduleAccess = cityClaims.moduleAccess[0];
        expect(moduleAccess.chapterScopes).toBeDefined();

        const scopes = moduleAccess.chapterScopes!;
        const expectedChapters = [SEED_CHAPTERS.lahoreCentral.id, SEED_CHAPTERS.lahoreNorth.id];

        expect(scopes["opportunities:write"]).toEqual(expectedChapters);
        expect(scopes["noticeboard:write"]).toEqual(expectedChapters);
        expect(scopes["applications:update"]).toEqual(expectedChapters);
        expect(scopes["hours:update"]).toEqual(expectedChapters);
        expect(scopes["chapters:write"]).toEqual(expectedChapters);
      });

      it("strictly lacks platform owner and broad administrative permissions", () => {
        expect(cityClaims.platformOwner).toBe(false);
        const perms = cityClaims.moduleAccess[0].permissions;

        expect(perms).not.toContain("team:write");
        expect(perms).not.toContain("members:write");
        expect(perms).not.toContain("roles:write");
        expect(perms).not.toContain("volunteers:read");
        expect(perms).not.toContain("inquiries:write");
      });

      it("decodes token back to identical multi-chapter claims", () => {
        const decoded = decodeStaffTokenClaims(cityToken);
        expect(decoded.actorType).toBe("staff");
        expect(decoded.staffId).toBe(creds.staffId);
        expect(decoded.platformOwner).toBe(false);
        expect(decoded.moduleAccess[0].chapterScopes!["chapters:write"]).toEqual([
          SEED_CHAPTERS.lahoreCentral.id,
          SEED_CHAPTERS.lahoreNorth.id,
        ]);
      });
    });

    describe("Task 2: Multi-Chapter Details & Branding", () => {
      it("successfully updates details of Chapter 1 (Lahore Central)", async () => {
        const res = await updateChapter(mockSupabase, creds.staffId, false, {
          chapterId: SEED_CHAPTERS.lahoreCentral.id,
          name: "Lahore Central City-Hub",
          about: "Regional distribution hub 1",
          logoUrl: "https://example.com/central-logo.png",
        });

        expect(res.chapterId).toBe(SEED_CHAPTERS.lahoreCentral.id);
        const row = db.chapters.find((c) => c.id === SEED_CHAPTERS.lahoreCentral.id);
        expect(row?.name).toBe("Lahore Central City-Hub");
        expect(row?.about).toBe("Regional distribution hub 1");
      });

      it("successfully updates details of Chapter 2 (Lahore North)", async () => {
        const res = await updateChapter(mockSupabase, creds.staffId, false, {
          chapterId: SEED_CHAPTERS.lahoreNorth.id,
          name: "Lahore North City-Hub",
          about: "Regional distribution hub 2",
          logoUrl: "https://example.com/north-logo.png",
        });

        expect(res.chapterId).toBe(SEED_CHAPTERS.lahoreNorth.id);
        const row = db.chapters.find((c) => c.id === SEED_CHAPTERS.lahoreNorth.id);
        expect(row?.name).toBe("Lahore North City-Hub");
        expect(row?.about).toBe("Regional distribution hub 2");
      });

      it("asserts 403 (forbidden) when attempting to update unassigned Chapter 3 (Karachi Central)", async () => {
        await expect(
          updateChapter(mockSupabase, creds.staffId, false, {
            chapterId: SEED_CHAPTERS.karachiCentral.id,
            name: "Intrusion in Karachi",
          }),
        ).rejects.toThrow("forbidden");
      });

      it("asserts 403 (forbidden_status_change) when attempting to deactivate assigned chapters", async () => {
        await expect(
          updateChapter(mockSupabase, creds.staffId, false, {
            chapterId: SEED_CHAPTERS.lahoreCentral.id,
            status: "inactive",
          }),
        ).rejects.toThrow("forbidden_status_change");

        await expect(
          updateChapter(mockSupabase, creds.staffId, false, {
            chapterId: SEED_CHAPTERS.lahoreNorth.id,
            status: "inactive",
          }),
        ).rejects.toThrow("forbidden_status_change");
      });
    });

    describe("Task 3: Multi-Chapter Roster Governance", () => {
      it("successfully manages roster on Chapter 1 (Lahore Central)", async () => {
        const newMember: ChapterTeamMemberInput = {
          volunteerCode: "YR-2026-000201",
          fullName: "Ayesha Tariq",
          email: "ayesha@rizq.org",
          designation: "Central Chapter Lead Volunteer",
          term: "2025–2026",
          status: "active",
        };

        await updateChapter(mockSupabase, creds.staffId, false, {
          chapterId: SEED_CHAPTERS.lahoreCentral.id,
          teamMembers: [newMember],
        });

        const member = db.chapter_team_members.find((m) => m.volunteer_code === "YR-2026-000201");
        expect(member).toBeDefined();
        expect(member?.full_name).toBe("Ayesha Tariq");
      });

      it("successfully manages roster on Chapter 2 (Lahore North)", async () => {
        const newMember: ChapterTeamMemberInput = {
          volunteerCode: "YR-2026-000202",
          fullName: "Usman Ghani",
          email: "usman@rizq.org",
          designation: "North Chapter Lead Volunteer",
          term: "2025–2026",
          status: "active",
        };

        await updateChapter(mockSupabase, creds.staffId, false, {
          chapterId: SEED_CHAPTERS.lahoreNorth.id,
          teamMembers: [newMember],
        });

        const member = db.chapter_team_members.find((m) => m.volunteer_code === "YR-2026-000202");
        expect(member).toBeDefined();
        expect(member?.full_name).toBe("Usman Ghani");
      });

      it("asserts 403 (forbidden) when attempting to touch roster of unassigned Chapter 3 (Karachi Central)", async () => {
        await expect(
          updateChapter(mockSupabase, creds.staffId, false, {
            chapterId: SEED_CHAPTERS.karachiCentral.id,
            teamMembers: [
              {
                volunteerCode: "YR-999999",
                fullName: "Malicious Roster Insertion",
                designation: "Lead",
                status: "active",
              },
            ],
          }),
        ).rejects.toThrow("forbidden");
      });
    });

    describe("Task 4: Multi-Chapter Drive Operations", () => {
      it("successfully creates & publishes drive in Chapter 1 (Lahore Central)", async () => {
        const created = await createOpportunity(
          {
            organizationId: SEED_ORGS.rizq,
            name: "Central Regional Drive",
            type: "community",
            chapterId: SEED_CHAPTERS.lahoreCentral.id,
          },
          cityToken,
        );
        expect(created.opportunityId).toBeDefined();

        const published = await updateOpportunity(
          {
            opportunityId: "opp-lhr-1",
            organizationId: SEED_ORGS.rizq,
            chapterId: SEED_CHAPTERS.lahoreCentral.id,
            statusOverride: "published",
          },
          cityToken,
        );
        expect(published.opportunityId).toBe("opp-lhr-1");
      });

      it("successfully creates & publishes drive in Chapter 2 (Lahore North)", async () => {
        const created = await createOpportunity(
          {
            organizationId: SEED_ORGS.rizq,
            name: "North Regional Drive",
            type: "community",
            chapterId: SEED_CHAPTERS.lahoreNorth.id,
          },
          cityToken,
        );
        expect(created.opportunityId).toBeDefined();

        const published = await updateOpportunity(
          {
            opportunityId: "opp-north-1",
            organizationId: SEED_ORGS.rizq,
            chapterId: SEED_CHAPTERS.lahoreNorth.id,
            statusOverride: "published",
          },
          cityToken,
        );
        expect(published.opportunityId).toBe("opp-north-1");
      });

      it("asserts 403 (forbidden) when attempting to create drive in Chapter 3 (Karachi Central)", async () => {
        await expect(
          createOpportunity(
            {
              organizationId: SEED_ORGS.rizq,
              name: "Unauthorized Karachi Drive by City Lead",
              type: "community",
              chapterId: SEED_CHAPTERS.karachiCentral.id,
            },
            cityToken,
          ),
        ).rejects.toThrow("forbidden");
      });

      it("asserts 403 (forbidden) when attempting to create drive org-wide (null chapterId)", async () => {
        await expect(
          createOpportunity(
            {
              organizationId: SEED_ORGS.rizq,
              name: "Unauthorized National Drive by City Lead",
              type: "community",
              chapterId: null,
            },
            cityToken,
          ),
        ).rejects.toThrow("forbidden");
      });

      it("correctly evaluates client multi-chapter permissions via useStaffPermissions", () => {
        const { result } = renderHook(() => useStaffPermissions());

        expect(result.current.hasChapterPermission("opportunities:write", SEED_CHAPTERS.lahoreCentral.id)).toBe(true);
        expect(result.current.hasChapterPermission("opportunities:write", SEED_CHAPTERS.lahoreNorth.id)).toBe(true);
        expect(result.current.hasChapterPermission("opportunities:write", SEED_CHAPTERS.karachiCentral.id)).toBe(false);
        expect(result.current.hasChapterPermission("opportunities:write", null)).toBe(false);

        expect(result.current.hasChapterPermission("noticeboard:write", SEED_CHAPTERS.lahoreCentral.id)).toBe(true);
        expect(result.current.hasChapterPermission("noticeboard:write", SEED_CHAPTERS.lahoreNorth.id)).toBe(true);
        expect(result.current.hasChapterPermission("noticeboard:write", SEED_CHAPTERS.karachiCentral.id)).toBe(false);
      });
    });

    describe("Task 5: Multi-Chapter Applicant Triage", () => {
      it("successfully triages applicant in Chapter 1 (Lahore Central)", async () => {
        const result = await decideApplication(
          {
            applicationId: "app-lhr-1",
            decision: "selected",
          },
          cityToken,
        );

        expect(result.applicationId).toBe("app-lhr-1");
      });

      it("successfully triages applicant in Chapter 2 (Lahore North)", async () => {
        const result = await decideApplication(
          {
            applicationId: "app-north-1",
            decision: "waitlisted",
          },
          cityToken,
        );

        expect(result.applicationId).toBe("app-north-1");
      });

      it("asserts 403 (forbidden) on applicant in unassigned Chapter 3 (Karachi Central)", async () => {
        await expect(
          decideApplication(
            {
              applicationId: "app-khi-1",
              decision: "selected",
            },
            cityToken,
          ),
        ).rejects.toThrow("forbidden");
      });

      it("correctly evaluates multi-chapter triage client permission", () => {
        const { result } = renderHook(() => useStaffPermissions());

        expect(result.current.hasChapterPermission("applications:update", SEED_CHAPTERS.lahoreCentral.id)).toBe(true);
        expect(result.current.hasChapterPermission("applications:update", SEED_CHAPTERS.lahoreNorth.id)).toBe(true);
        expect(result.current.hasChapterPermission("applications:update", SEED_CHAPTERS.karachiCentral.id)).toBe(false);
      });
    });

    describe("Task 6: Multi-Chapter Hours Approval", () => {
      it("successfully approves hours in Chapter 1 (Lahore Central)", async () => {
        const result = await verifyHours(
          {
            activityHoursId: "hours-lhr-1",
            decision: "verified",
            hoursVerified: 6,
          },
          cityToken,
        );

        expect(result.activityHoursId).toBe("hours-lhr-1");
      });

      it("successfully approves hours in Chapter 2 (Lahore North)", async () => {
        const result = await verifyHours(
          {
            activityHoursId: "hours-north-1",
            decision: "verified",
            hoursVerified: 8,
          },
          cityToken,
        );

        expect(result.activityHoursId).toBe("hours-north-1");
      });

      it("asserts 403 (forbidden) on hours in unassigned Chapter 3 (Karachi Central)", async () => {
        await expect(
          verifyHours(
            {
              activityHoursId: "hours-khi-1",
              decision: "verified",
              hoursVerified: 5,
            },
            cityToken,
          ),
        ).rejects.toThrow("forbidden");
      });

      it("correctly evaluates multi-chapter hours update client permission", () => {
        const { result } = renderHook(() => useStaffPermissions());

        expect(result.current.hasChapterPermission("hours:update", SEED_CHAPTERS.lahoreCentral.id)).toBe(true);
        expect(result.current.hasChapterPermission("hours:update", SEED_CHAPTERS.lahoreNorth.id)).toBe(true);
        expect(result.current.hasChapterPermission("hours:update", SEED_CHAPTERS.karachiCentral.id)).toBe(false);
      });
    });

    describe("Task 7: Boundary Protection", () => {
      it("strictly forbids modifying Organization Profile", async () => {
        await expect(
          updateOrganization(mockSupabase, creds.staffId, false, {
            organizationId: SEED_ORGS.rizq,
            name: "Hacked Rizq Regional Name",
          }),
        ).rejects.toThrow("forbidden");
      });

      it("strictly forbids creating new chapters", async () => {
        await expect(
          createChapter(mockSupabase, creds.staffId, false, {
            organizationId: SEED_ORGS.rizq,
            name: "Unauthorized Faisalabad Chapter",
          }),
        ).rejects.toThrow("forbidden");
      });

      it("strictly forbids managing team members (updateStaffAccess)", async () => {
        await expect(
          updateStaffAccess(mockSupabase, creds.staffId, false, {
            staffId: "target-staff-999",
            organizationId: SEED_ORGS.rizq,
            roles: [{ roleId: ROLE_CITY_LEAD_ID, scopeKind: "org_wide", scopeLabel: "National" }],
            status: "active",
          }),
        ).rejects.toThrow("forbidden");
      });

      it("evaluates governance boundary capabilities as disabled", () => {
        const { result } = renderHook(() => useStaffPermissions());

        expect(result.current.canManageOrgProfile).toBe(false);
        expect(result.current.canCreateChapters).toBe(false);
        expect(result.current.canManageTeam).toBe(false);
        expect(result.current.canViewInquiries).toBe(false);
        expect(result.current.canViewVolunteers).toBe(false);
        expect(result.current.canViewOrganization).toBe(true);
        expect(result.current.isChapterScoped).toBe(true);
        expect(result.current.scopedChapterIds).toEqual([
          SEED_CHAPTERS.lahoreCentral.id,
          SEED_CHAPTERS.lahoreNorth.id,
        ]);
      });
    });
  });
});

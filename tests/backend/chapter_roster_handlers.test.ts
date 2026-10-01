import { describe, it, expect, vi } from "vitest";
import { lookupYouthRepublicMember } from "@/supabase/functions/lookup-youth-republic-member/handler";
import { updateChapter } from "@/supabase/functions/update-chapter/handler";
import { listChapterTeamMembers } from "@/supabase/functions/list-chapter-team-members/handler";

describe("Backend Handlers: Youth Republic Member Lookup & Chapter Team Roster", () => {
  const mockOrgId = "org-111";
  const mockChapterId = "chap-222";
  const mockOtherChapterId = "chap-999";
  const mockCallerId = "staff-333";

  describe("lookupYouthRepublicMember", () => {
    it("returns volunteer details when found case-insensitively", async () => {
      const mockSupabase: any = {
        from: (table: string) => {
          if (table === "staff_org_roles") {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: async () => ({ data: { org_tier: "admin" }, error: null }),
                  }),
                }),
              }),
            };
          }
          if (table === "volunteers") {
            return {
              select: () => ({
                ilike: (_col: string, val: string) => ({
                  maybeSingle: async () => {
                    if (val.toUpperCase() === "YR-2026-000123") {
                      return {
                        data: {
                          volunteer_code: "YR-2026-000123",
                          full_name: "Fatima Ali",
                          email: "fatima@example.com",
                          profile_picture_url: "https://example.com/avatar.jpg",
                        },
                        error: null,
                      };
                    }
                    return { data: null, error: null };
                  },
                }),
              }),
            };
          }
          throw new Error(`Unexpected table: ${table}`);
        },
      };

      const result = await lookupYouthRepublicMember(mockSupabase, mockCallerId, false, {
        organizationId: mockOrgId,
        youthRepublicId: "yr-2026-000123",
      });

      expect(result).toEqual({
        volunteerCode: "YR-2026-000123",
        fullName: "Fatima Ali",
        email: "fatima@example.com",
        avatarUrl: "https://example.com/avatar.jpg",
      });
    });

    it("throws volunteer_not_found if volunteer does not exist", async () => {
      const mockSupabase: any = {
        from: (table: string) => {
          if (table === "staff_org_roles") {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: async () => ({ data: { org_tier: "admin" }, error: null }),
                  }),
                }),
              }),
            };
          }
          if (table === "volunteers") {
            return {
              select: () => ({
                ilike: () => ({
                  maybeSingle: async () => ({ data: null, error: null }),
                }),
              }),
            };
          }
          throw new Error(`Unexpected table: ${table}`);
        },
      };

      await expect(
        lookupYouthRepublicMember(mockSupabase, mockCallerId, false, {
          organizationId: mockOrgId,
          youthRepublicId: "YR-9999",
        }),
      ).rejects.toThrow("volunteer_not_found");
    });

    it("rejects caller not belonging to the organization with forbidden", async () => {
      const mockSupabase: any = {
        from: (table: string) => {
          if (table === "staff_org_roles") {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: async () => ({ data: null, error: null }),
                  }),
                }),
              }),
            };
          }
          if (table === "staff_role_assignments") {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    limit: async () => ({ data: [], error: null }),
                  }),
                }),
              }),
            };
          }
          throw new Error(`Unexpected table: ${table}`);
        },
      };

      await expect(
        lookupYouthRepublicMember(mockSupabase, mockCallerId, false, {
          organizationId: mockOrgId,
          youthRepublicId: "YR-2026-000123",
        }),
      ).rejects.toThrow("forbidden");
    });

    it("allows platform owner to lookup without org membership", async () => {
      const mockSupabase: any = {
        from: (table: string) => {
          if (table === "volunteers") {
            return {
              select: () => ({
                ilike: () => ({
                  maybeSingle: async () => ({
                    data: {
                      volunteer_code: "YR-1",
                      full_name: "Super Vol",
                      email: null,
                      profile_picture_url: null,
                    },
                    error: null,
                  }),
                }),
              }),
            };
          }
          throw new Error(`Unexpected table: ${table}`);
        },
      };

      const result = await lookupYouthRepublicMember(mockSupabase, mockCallerId, true, {
        organizationId: mockOrgId,
        youthRepublicId: "YR-1",
      });

      expect(result.volunteerCode).toBe("YR-1");
      expect(result.fullName).toBe("Super Vol");
    });
  });

  describe("updateChapter authorization & roster sync", () => {
    function createMockSupabase(callerRole: {
      isPlatformOwner?: boolean;
      orgTier?: string | null;
      assignments?: Array<{ roleId: string; roleName: string; scopeKind: string; chapterId: string | null }>;
    }) {
      const db = {
        chapters: [
          {
            id: mockChapterId,
            organization_id: mockOrgId,
            name: "Original Karachi",
            city: "Karachi",
            status: "active",
            logo_url: null,
            about: null,
          },
        ],
        chapter_team_members: [
          {
            id: "mem-existing-1",
            chapter_id: mockChapterId,
            volunteer_code: "YR-2026-001",
            full_name: "Old Member",
            email: "old@example.com",
            avatar_url: null,
            designation: "Lead",
            term: "2024–2025",
            status: "alumni",
          },
          {
            id: "mem-existing-to-remove",
            chapter_id: mockChapterId,
            volunteer_code: "YR-2026-002",
            full_name: "Remove Me",
            email: null,
            avatar_url: null,
            designation: "Coordinator",
            term: "2024–2025",
            status: "active",
          },
        ],
        staff_role_assignments: [
          {
            staff_id: "staff-other",
            organization_id: mockOrgId,
            chapter_id: mockChapterId,
            scope_label: "Original Karachi",
          },
        ],
        audit_logs: [] as any[],
      };

      const client: any = {
        from: (table: string) => {
          if (table === "chapters") {
            return {
              select: () => ({
                eq: (_col: string, val: string) => ({
                  single: async () => {
                    const row = db.chapters.find((c) => c.id === val);
                    return row ? { data: { ...row }, error: null } : { data: null, error: new Error("not_found") };
                  },
                }),
              }),
              update: (patch: any) => ({
                eq: async (_col: string, val: string) => {
                  const idx = db.chapters.findIndex((c) => c.id === val);
                  if (idx >= 0) db.chapters[idx] = { ...db.chapters[idx], ...patch };
                  return { error: null };
                },
              }),
            };
          }
          if (table === "staff_org_roles") {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: async () => ({
                      data: callerRole.orgTier ? { org_tier: callerRole.orgTier } : null,
                      error: null,
                    }),
                  }),
                }),
              }),
            };
          }
          if (table === "staff_role_assignments") {
            return {
              select: () => ({
                eq: () => ({
                  eq: async () => ({
                    data: (callerRole.assignments ?? []).map((a) => ({
                      role_id: a.roleId,
                      scope_kind: a.scopeKind,
                      chapter_id: a.chapterId,
                    })),
                    error: null,
                  }),
                }),
              }),
              update: (patch: any) => ({
                eq: async (_col: string, val: string) => {
                  for (const a of db.staff_role_assignments) {
                    if (a.chapter_id === val) Object.assign(a, patch);
                  }
                  return { error: null };
                },
              }),
            };
          }
          if (table === "roles") {
            return {
              select: () => ({
                in: async (_col: string, ids: string[]) => ({
                  data: (callerRole.assignments ?? [])
                    .filter((a) => ids.includes(a.roleId))
                    .map((a) => ({ id: a.roleId, name: a.roleName })),
                  error: null,
                }),
              }),
            };
          }
          if (table === "chapter_team_members") {
            return {
              select: () => ({
                eq: (_col: string, val: string) => ({
                  order: () => ({
                    data: db.chapter_team_members.filter((m) => m.chapter_id === val),
                    error: null,
                  }),
                  data: db.chapter_team_members.filter((m) => m.chapter_id === val),
                  error: null,
                }),
              }),
              delete: () => ({
                in: async (_col: string, ids: string[]) => {
                  db.chapter_team_members = db.chapter_team_members.filter((m) => !ids.includes(m.id));
                  return { error: null };
                },
              }),
              upsert: async (rows: any[]) => {
                for (const r of rows) {
                  if (r.id) {
                    const idx = db.chapter_team_members.findIndex((m) => m.id === r.id);
                    if (idx >= 0) db.chapter_team_members[idx] = { ...db.chapter_team_members[idx], ...r };
                    else db.chapter_team_members.push(r);
                  } else {
                    db.chapter_team_members.push({ ...r, id: `gen-${Math.random()}` });
                  }
                }
                return { error: null };
              },
            };
          }
          if (table === "staff") {
            return {
              select: () => ({
                eq: () => ({
                  single: async () => ({ data: { full_name: "Test Staff" }, error: null }),
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
          throw new Error(`Unhandled table: ${table}`);
        },
      };

      return { client, db };
    }

    it("allows Chapter Admin to update their OWN chapter", async () => {
      const { client, db } = createMockSupabase({
        assignments: [
          {
            roleId: "role-org-admin",
            roleName: "Org Admin",
            scopeKind: "chapter",
            chapterId: mockChapterId,
          },
        ],
      });

      const res = await updateChapter(client, mockCallerId, false, {
        chapterId: mockChapterId,
        about: "New Karachi chapter description",
        logoUrl: "https://example.com/logo-karachi.png",
      });

      expect(res.chapterId).toBe(mockChapterId);
      expect(db.chapters[0].about).toBe("New Karachi chapter description");
      expect(db.chapters[0].logo_url).toBe("https://example.com/logo-karachi.png");
    });

    it("rejects Chapter Admin attempting to update a DIFFERENT chapter with forbidden", async () => {
      const { client } = createMockSupabase({
        assignments: [
          {
            roleId: "role-org-admin",
            roleName: "Org Admin",
            scopeKind: "chapter",
            chapterId: mockOtherChapterId, // assigned to another chapter!
          },
        ],
      });

      await expect(
        updateChapter(client, mockCallerId, false, {
          chapterId: mockChapterId,
          name: "Attempted Hijack",
        }),
      ).rejects.toThrow("forbidden");
    });

    it("rejects non-admin role (e.g. Operations Lead) with forbidden", async () => {
      const { client } = createMockSupabase({
        assignments: [
          {
            roleId: "role-ops",
            roleName: "Operations Lead",
            scopeKind: "chapter",
            chapterId: mockChapterId,
          },
        ],
      });

      await expect(
        updateChapter(client, mockCallerId, false, {
          chapterId: mockChapterId,
          name: "Attempted Update",
        }),
      ).rejects.toThrow("forbidden");
    });

    it("allows National Org Admin and Super Admin to update any chapter", async () => {
      const { client, db } = createMockSupabase({
        orgTier: "super_admin",
      });

      const res = await updateChapter(client, mockCallerId, false, {
        chapterId: mockChapterId,
        name: "Renamed by Super Admin",
      });

      expect(res.chapterId).toBe(mockChapterId);
      expect(db.chapters[0].name).toBe("Renamed by Super Admin");
      expect(db.staff_role_assignments[0].scope_label).toBe("Renamed by Super Admin");
    });

    it("atomically syncs chapter_team_members (deletes removed, upserts existing, inserts new)", async () => {
      const { client, db } = createMockSupabase({
        assignments: [
          {
            roleId: "role-org-admin",
            roleName: "Org Admin",
            scopeKind: "chapter",
            chapterId: mockChapterId,
          },
        ],
      });

      // Existing: YR-2026-001 (term 2024–2025), YR-2026-002 (to remove)
      // New input: update YR-2026-001 (now active and new title), insert YR-2026-003, remove YR-2026-002
      await updateChapter(client, mockCallerId, false, {
        chapterId: mockChapterId,
        teamMembers: [
          {
            volunteerCode: "yr-2026-001",
            fullName: "Old Member Promoted",
            designation: "President",
            term: "2024–2025",
            status: "active",
          },
          {
            volunteerCode: "yr-2026-003",
            fullName: "Brand New Member",
            email: "new@example.com",
            avatarUrl: "https://example.com/new.png",
            designation: "General Secretary",
            term: "2025–2026",
            status: "active",
          },
        ],
      });

      // YR-2026-002 should have been deleted
      const removed = db.chapter_team_members.find((m) => m.volunteer_code === "YR-2026-002");
      expect(removed).toBeUndefined();

      // YR-2026-001 should have been updated with existing id
      const updated = db.chapter_team_members.find((m) => m.volunteer_code === "YR-2026-001");
      expect(updated).toBeDefined();
      expect(updated?.id).toBe("mem-existing-1");
      expect(updated?.full_name).toBe("Old Member Promoted");
      expect(updated?.designation).toBe("President");
      expect(updated?.status).toBe("active");

      // YR-2026-003 should have been inserted with normalized uppercase code
      const inserted = db.chapter_team_members.find((m) => m.volunteer_code === "YR-2026-003");
      expect(inserted).toBeDefined();
      expect(inserted?.full_name).toBe("Brand New Member");
      expect(inserted?.designation).toBe("General Secretary");
    });
  });

  describe("listChapterTeamMembers", () => {
    it("returns roster members for the chapter", async () => {
      const mockSupabase: any = {
        from: (table: string) => {
          if (table === "chapters") {
            return {
              select: () => ({
                eq: () => ({
                  single: async () => ({ data: { id: mockChapterId, organization_id: mockOrgId }, error: null }),
                }),
              }),
            };
          }
          if (table === "staff_org_roles") {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: async () => ({ data: { org_tier: "admin" }, error: null }),
                  }),
                }),
              }),
            };
          }
          if (table === "chapter_team_members") {
            return {
              select: () => ({
                eq: () => ({
                  order: async () => ({
                    data: [
                      {
                        id: "tm-1",
                        chapter_id: mockChapterId,
                        volunteer_code: "YR-2026-0001",
                        full_name: "Ali",
                        email: "ali@example.com",
                        avatar_url: null,
                        designation: "President",
                        term: "2025–2026",
                        status: "active",
                        created_at: "2026-01-01T00:00:00Z",
                        created_by: "staff-1",
                      },
                    ],
                    error: null,
                  }),
                }),
              }),
            };
          }
          throw new Error(`Unexpected table: ${table}`);
        },
      };

      const result = await listChapterTeamMembers(mockSupabase, mockCallerId, false, {
        chapterId: mockChapterId,
      });

      expect(result.teamMembers).toHaveLength(1);
      expect(result.teamMembers[0].volunteerCode).toBe("YR-2026-0001");
      expect(result.teamMembers[0].fullName).toBe("Ali");
    });

    it("rejects caller not belonging to the organization", async () => {
      const mockSupabase: any = {
        from: (table: string) => {
          if (table === "chapters") {
            return {
              select: () => ({
                eq: () => ({
                  single: async () => ({ data: { id: mockChapterId, organization_id: mockOrgId }, error: null }),
                }),
              }),
            };
          }
          if (table === "staff_org_roles") {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: async () => ({ data: null, error: null }),
                  }),
                }),
              }),
            };
          }
          if (table === "staff_role_assignments") {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    limit: async () => ({ data: [], error: null }),
                  }),
                }),
              }),
            };
          }
          throw new Error(`Unexpected table: ${table}`);
        },
      };

      await expect(
        listChapterTeamMembers(mockSupabase, mockCallerId, false, {
          chapterId: mockChapterId,
        }),
      ).rejects.toThrow("forbidden");
    });
  });
});

import { describe, it, expect, vi } from "vitest";
import { createCustomRole } from "@/supabase/functions/create-custom-role/handler";
import { updateCustomRole } from "@/supabase/functions/update-custom-role/handler";
import { deleteCustomRole } from "@/supabase/functions/delete-custom-role/handler";

describe("Backend Role Management Handlers: Super Admin & Org Admin Authorization", () => {
  const mockOrgId = "org-111";
  const mockModuleId = "mod-222";
  const superAdminStaffId = "staff-super-admin";
  const orgAdminStaffId = "staff-org-admin";
  const chapterLeadStaffId = "staff-chapter-lead";

  function createMockSupabase({
    roleAssignmentName = "Super Admin",
    orgTier = null as string | null,
    isSystemRole = false,
    assignmentCount = 0,
  } = {}) {
    return {
      from: (table: string) => {
        if (table === "staff_org_roles") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: orgTier ? { org_tier: orgTier } : null,
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }

        if (table === "staff_role_assignments") {
          return {
            select: (_cols: string, opts?: { count?: string; head?: boolean }) => {
              if (opts?.count === "exact") {
                return {
                  eq: async () => ({ count: assignmentCount, error: null }),
                };
              }
              return {
                eq: () => ({
                  eq: async () => ({
                    data: roleAssignmentName
                      ? [{ role_id: "role-assigned", scope_kind: "org_wide" }]
                      : [],
                    error: null,
                  }),
                }),
              };
            },
          };
        }

        if (table === "roles") {
          return {
            select: () => ({
              in: async () => ({
                data: [
                  {
                    id: "role-assigned",
                    name: roleAssignmentName,
                    role_permissions:
                      roleAssignmentName === "Super Admin" || roleAssignmentName === "Org Admin"
                        ? [{ permissions: { resource: "roles", action: "write" } }]
                        : [],
                  },
                ],
                error: null,
              }),
              eq: () => ({
                single: async () => ({
                  data: {
                    id: "target-role-id",
                    organization_id: mockOrgId,
                    module_id: mockModuleId,
                    name: "Target Role",
                    is_system: isSystemRole,
                  },
                  error: null,
                }),
              }),
            }),
            insert: () => ({
              select: () => ({
                single: async () => ({ data: { id: "new-role-id" }, error: null }),
              }),
            }),
            update: () => ({
              eq: async () => ({ error: null }),
            }),
            delete: () => ({
              eq: async () => ({ error: null }),
            }),
          };
        }

        if (table === "org_modules") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: { module_id: mockModuleId }, error: null }),
                }),
              }),
            }),
          };
        }

        if (table === "permissions") {
          return {
            select: () => ({
              eq: async () => ({
                data: [
                  { id: "perm-1", resource: "opportunities", action: "write" },
                  { id: "perm-2", resource: "hours", action: "update" },
                  { id: "perm-3", resource: "hours", action: "read" },
                  { id: "perm-4", resource: "noticeboard", action: "write" },
                  { id: "perm-5", resource: "applications", action: "read" },
                  { id: "perm-6", resource: "applications", action: "update" },
                  { id: "perm-7", resource: "roles", action: "write" },
                ],
                error: null,
              }),
            }),
          };
        }

        if (table === "role_permissions") {
          return {
            insert: async () => ({ error: null }),
            delete: () => ({
              eq: async () => ({ error: null }),
            }),
          };
        }

        if (table === "admin_audit_log") {
          return {
            insert: async () => ({ error: null }),
          };
        }

        if (table === "staff") {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({ data: { full_name: "Test Admin" }, error: null }),
                maybeSingle: async () => ({ data: { full_name: "Test Admin" }, error: null }),
              }),
            }),
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      },
    } as any;
  }

  describe("createCustomRole", () => {
    it("allows Super Admin to create a custom role", async () => {
      const mockSupabase = createMockSupabase({ roleAssignmentName: "Super Admin" });
      const result = await createCustomRole(mockSupabase, superAdminStaffId, false, {
        organizationId: mockOrgId,
        moduleId: mockModuleId,
        name: "New Field Coordinator",
        description: "Field ops",
        capabilities: {
          drive: "granted",
          publish: "restricted",
          triage: "restricted",
          hours: "read_only",
          team: "restricted",
        },
      });

      expect(result).toEqual({ roleId: "new-role-id" });
    });

    it("allows Org Admin to create a custom role", async () => {
      const mockSupabase = createMockSupabase({ roleAssignmentName: "Org Admin" });
      const result = await createCustomRole(mockSupabase, orgAdminStaffId, false, {
        organizationId: mockOrgId,
        moduleId: mockModuleId,
        name: "New Org Role",
        description: "Org description",
        capabilities: {
          drive: "granted",
          publish: "restricted",
          triage: "restricted",
          hours: "read_only",
          team: "restricted",
        },
      });

      expect(result).toEqual({ roleId: "new-role-id" });
    });

    it("forbids Chapter Lead from creating a custom role", async () => {
      const mockSupabase = createMockSupabase({ roleAssignmentName: "Chapter Lead" });
      await expect(
        createCustomRole(mockSupabase, chapterLeadStaffId, false, {
          organizationId: mockOrgId,
          moduleId: mockModuleId,
          name: "Unauthorized Role",
          description: "",
          capabilities: {
            drive: "granted",
            publish: "restricted",
            triage: "restricted",
            hours: "restricted",
            team: "restricted",
          },
        }),
      ).rejects.toThrow("forbidden");
    });
  });

  describe("updateCustomRole", () => {
    it("allows Super Admin and Org Admin to update a custom role", async () => {
      const mockSupabase = createMockSupabase({ roleAssignmentName: "Org Admin" });
      const result = await updateCustomRole(mockSupabase, orgAdminStaffId, false, {
        roleId: "target-role-id",
        name: "Updated Field Coordinator",
        description: "Updated description",
        capabilities: {
          drive: "granted",
          publish: "restricted",
          triage: "restricted",
          hours: "restricted",
          team: "restricted",
        },
      });

      expect(result).toEqual({ roleId: "target-role-id" });
    });

    it("prevents updating system default roles", async () => {
      const mockSupabase = createMockSupabase({
        roleAssignmentName: "Super Admin",
        isSystemRole: true,
      });
      await expect(
        updateCustomRole(mockSupabase, superAdminStaffId, false, {
          roleId: "target-role-id",
          name: "Attempted System Role Rename",
          description: "",
          capabilities: {
            drive: "granted",
            publish: "restricted",
            triage: "restricted",
            hours: "restricted",
            team: "restricted",
          },
        }),
      ).rejects.toThrow("system_role_immutable");
    });
  });

  describe("deleteCustomRole", () => {
    it("allows Org Admin to delete an unassigned custom role", async () => {
      const mockSupabase = createMockSupabase({
        roleAssignmentName: "Org Admin",
        assignmentCount: 0,
      });
      const result = await deleteCustomRole(mockSupabase, orgAdminStaffId, false, {
        roleId: "target-role-id",
      });

      expect(result).toEqual({ roleId: "target-role-id" });
    });

    it("prevents deleting a custom role currently in use", async () => {
      const mockSupabase = createMockSupabase({
        roleAssignmentName: "Super Admin",
        assignmentCount: 2,
      });
      await expect(
        deleteCustomRole(mockSupabase, superAdminStaffId, false, {
          roleId: "target-role-id",
        }),
      ).rejects.toThrow("role_in_use");
    });

    it("prevents deleting a system default role", async () => {
      const mockSupabase = createMockSupabase({
        roleAssignmentName: "Super Admin",
        isSystemRole: true,
      });
      await expect(
        deleteCustomRole(mockSupabase, superAdminStaffId, false, {
          roleId: "target-role-id",
        }),
      ).rejects.toThrow("system_role_immutable");
    });
  });
});

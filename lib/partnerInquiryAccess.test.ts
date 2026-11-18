import { describe, expect, it } from "vitest";
import { inquiryAccessFromRecords, normalizeInquiryAssignments, resolveInquiryAccess } from "./partnerInquiryAccess";

describe("inquiryAccessFromRecords", () => {
  const active = { platformOwner: false, staffStatus: "active", orgTier: null as string | null };

  it("lets an org-wide inquiries reader see every inquiry", () => {
    expect(inquiryAccessFromRecords({
      ...active,
      assignments: [{
        scopeKind: "org_wide",
        roleName: "Partner Inquiries Reader",
        permissions: [{ resource: "inquiries", action: "read" }],
      }],
    })).toBe("read");
  });

  it("lets inquiries:write update status", () => {
    expect(inquiryAccessFromRecords({
      ...active,
      assignments: [{
        scopeKind: "org_wide",
        roleName: "Partner Inquiries Reader",
        permissions: [{ resource: "inquiries", action: "write" }],
      }],
    })).toBe("write");
  });

  it("does not grant chapter-scoped inquiries access", () => {
    expect(inquiryAccessFromRecords({
      ...active,
      assignments: [{
        scopeKind: "chapter",
        roleName: "Partner Inquiries Reader",
        permissions: [{ resource: "inquiries", action: "read" }],
      }],
    })).toBe("none");
  });

  it("treats org admin tiers and named org-wide admin roles as writers", () => {
    expect(inquiryAccessFromRecords({ ...active, orgTier: "admin", assignments: [] })).toBe("write");
    expect(inquiryAccessFromRecords({
      ...active,
      assignments: [{ scopeKind: "org_wide", roleName: "Org Admin", permissions: [] }],
    })).toBe("write");
    expect(inquiryAccessFromRecords({
      ...active,
      assignments: [{ scopeKind: "chapter", roleName: "Super Admin", permissions: [] }],
    })).toBe("write");
  });

  it("blocks deactivated staff", () => {
    expect(inquiryAccessFromRecords({
      platformOwner: true,
      staffStatus: "deactivated",
      orgTier: "super_admin",
      assignments: [],
    })).toBe("none");
  });
});

describe("resolveInquiryAccess", () => {
  it("reads nested role permissions for a custom reader", async () => {
    const client = {
      from(table: string) {
        if (table === "staff") {
          return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { status: "active" }, error: null }) }) }) };
        }
        if (table === "staff_org_roles") {
          return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }) };
        }
        if (table === "staff_role_assignments") {
          return {
            select: () => ({
              eq: () => ({
                eq: async () => ({ data: [{ role_id: "r1", scope_kind: "org_wide" }], error: null }),
              }),
            }),
          };
        }
        return {
          select: () => ({
            in: async () => ({
              data: [{
                id: "r1",
                name: "Partner Inquiries Reader",
                role_permissions: [{ permissions: { resource: "inquiries", action: "read" } }],
              }],
              error: null,
            }),
          }),
        };
      },
    };

    await expect(resolveInquiryAccess(client, "staff-1", "org-1", false)).resolves.toBe("read");
    expect(normalizeInquiryAssignments([{
      scope_kind: "org_wide",
      roles: [{ name: "Org Admin", role_permissions: [] }],
    }])).toEqual([{ scopeKind: "org_wide", roleName: "Org Admin", permissions: [] }]);
  });
});

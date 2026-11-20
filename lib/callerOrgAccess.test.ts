import { describe, expect, it, vi } from "vitest";
import { callerBelongsToOrganization } from "./callerOrgAccess";

function mockClient(handlers: {
  orgRole?: { org_tier: string } | null;
  assignmentIds?: { id: string }[];
}) {
  const from = vi.fn((table: string) => {
    if (table === "staff_org_roles") {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: handlers.orgRole ?? null }),
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
              limit: async () => ({ data: handlers.assignmentIds ?? [] }),
            }),
          }),
        }),
      };
    }
    throw new Error(`unexpected table: ${table}`);
  });

  return { from } as never;
}

describe("callerBelongsToOrganization", () => {
  it("allows platform owners without org rows", async () => {
    expect(
      await callerBelongsToOrganization(mockClient({}), "staff-1", "org-a", true),
    ).toBe(true);
  });

  it("allows org admins via staff_org_roles", async () => {
    expect(
      await callerBelongsToOrganization(
        mockClient({ orgRole: { org_tier: "admin" } }),
        "staff-1",
        "org-a",
        false,
      ),
    ).toBe(true);
  });

  it("allows staff with a role assignment in the org", async () => {
    expect(
      await callerBelongsToOrganization(
        mockClient({ assignmentIds: [{ id: "asg-1" }] }),
        "staff-1",
        "org-a",
        false,
      ),
    ).toBe(true);
  });

  it("rejects staff with no affiliation to the org", async () => {
    expect(
      await callerBelongsToOrganization(mockClient({}), "staff-1", "org-other", false),
    ).toBe(false);
  });
});
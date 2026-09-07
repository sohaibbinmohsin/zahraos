import { describe, it, expect } from "vitest";
import { landingPathFor } from "@/lib/shellData";
import type { ShellData } from "@/lib/shellData";

function makeShell(overrides: Partial<ShellData>): ShellData {
  return {
    claims: {
      actorType: "staff",
      staffId: "s1",
      platformOwner: false,
      orgRoles: [{ organizationId: "org-1" }],
      moduleAccess: [],
    },
    staffToken: "t",
    fullName: "Sam",
    email: "sam@example.com",
    platformOwner: false,
    orgTiers: {},
    assignedRolesByOrg: {},
    availableOrgIds: ["org-1"],
    orgNames: { "org-1": "Org One" },
    orgBrands: {},
    ...overrides,
  };
}

describe("landingPathFor", () => {
  it("sends to the Youth Republic dashboard when that module is enabled for the active org", () => {
    const shell = makeShell({
      claims: {
        actorType: "staff", staffId: "s1", platformOwner: false,
        orgRoles: [{ organizationId: "org-1" }],
        moduleAccess: [{ organizationId: "org-1", module: "youth-republic", permissions: ["applications:read"] }],
      },
    });
    expect(landingPathFor(shell, "org-1")).toBe("/youth-republic/dashboard");
  });

  it("falls back to the Organization page when the active org has no Youth Republic module", () => {
    expect(landingPathFor(makeShell({}), "org-1")).toBe("/organization");
  });

  it("keys the module check to the cookie's org, not just the first available one", () => {
    const shell = makeShell({
      availableOrgIds: ["org-1", "org-2"],
      claims: {
        actorType: "staff", staffId: "s1", platformOwner: false,
        orgRoles: [{ organizationId: "org-1" }, { organizationId: "org-2" }],
        moduleAccess: [{ organizationId: "org-2", module: "youth-republic", permissions: ["applications:read"] }],
      },
    });
    expect(landingPathFor(shell, "org-2")).toBe("/youth-republic/dashboard");
    expect(landingPathFor(shell, "org-1")).toBe("/organization");
  });

  it("returns null (no redirect) when there is no shell or no org access", () => {
    expect(landingPathFor(null, null)).toBeNull();
    expect(landingPathFor(makeShell({ availableOrgIds: [] }), null)).toBeNull();
  });
});

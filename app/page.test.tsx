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
  it("sends someone who can open a Youth Republic section to the dashboard", () => {
    const shell = makeShell({
      claims: {
        actorType: "staff", staffId: "s1", platformOwner: false,
        orgRoles: [{ organizationId: "org-1" }],
        moduleAccess: [{ organizationId: "org-1", module: "youth-republic", permissions: ["applications:read"] }],
      },
    });
    expect(landingPathFor(shell, "org-1")).toBe("/youth-republic/dashboard");
  });

  it("sends an inquiries-only member to Partner Inquiries", () => {
    const shell = makeShell({
      claims: {
        actorType: "staff", staffId: "s1", platformOwner: false,
        orgRoles: [{ organizationId: "org-1" }],
        moduleAccess: [{ organizationId: "org-1", module: "youth-republic", permissions: ["inquiries:read"] }],
      },
    });
    expect(landingPathFor(shell, "org-1")).toBe("/team/organization/inquiries");
  });

  it("sends an organization admin with no module permissions to the dashboard", () => {
    const shell = makeShell({ orgTiers: { "org-1": "admin" } });
    expect(landingPathFor(shell, "org-1")).toBe("/youth-republic/dashboard");
  });

  it("returns null when the member has an org but no page they can open", () => {
    expect(landingPathFor(makeShell({}), "org-1")).toBeNull();
  });

  it("does not treat a chapter-scoped inquiries grant as the org inquiries page", () => {
    const shell = makeShell({
      claims: {
        actorType: "staff", staffId: "s1", platformOwner: false,
        orgRoles: [{ organizationId: "org-1" }],
        moduleAccess: [{
          organizationId: "org-1",
          module: "youth-republic",
          permissions: ["inquiries:read"],
          chapterScopes: { "inquiries:read": ["chapter-1"] },
        }],
      },
    });
    expect(landingPathFor(shell, "org-1")).toBeNull();
  });

  it("sends a team manager to Organization, the first governance page", () => {
    const shell = makeShell({
      claims: {
        actorType: "staff", staffId: "s1", platformOwner: false,
        orgRoles: [{ organizationId: "org-1" }],
        moduleAccess: [{ organizationId: "org-1", module: "youth-republic", permissions: ["team:write"] }],
      },
    });
    expect(landingPathFor(shell, "org-1")).toBe("/team/organization");
  });

  it("keys the page to the cookie's org, not just the first available one", () => {
    const shell = makeShell({
      availableOrgIds: ["org-1", "org-2"],
      claims: {
        actorType: "staff", staffId: "s1", platformOwner: false,
        orgRoles: [{ organizationId: "org-1" }, { organizationId: "org-2" }],
        moduleAccess: [
          { organizationId: "org-1", module: "youth-republic", permissions: ["inquiries:read"] },
          { organizationId: "org-2", module: "youth-republic", permissions: ["applications:read"] },
        ],
      },
    });
    expect(landingPathFor(shell, "org-2")).toBe("/youth-republic/dashboard");
    expect(landingPathFor(shell, "org-1")).toBe("/team/organization/inquiries");
  });

  it("returns null (no redirect) when there is no shell or no org access", () => {
    expect(landingPathFor(null, null)).toBeNull();
    expect(landingPathFor(makeShell({ availableOrgIds: [] }), null)).toBeNull();
  });
});

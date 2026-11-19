import { describe, it, expect } from "vitest";
import { landingAccessForOrg, youthRepublicBounceTarget, type ShellData } from "@/lib/shellData";

function makeShell(permissions: string[]): ShellData {
  return {
    claims: {
      actorType: "staff",
      staffId: "s1",
      platformOwner: false,
      orgRoles: [{ organizationId: "org-1" }],
      moduleAccess: [
        {
          organizationId: "org-1",
          module: "youth-republic",
          permissions,
        },
      ],
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
  };
}

describe("landingAccessForOrg", () => {
  it("does not grant canViewDrives for a write-only opportunities token", () => {
    const access = landingAccessForOrg(makeShell(["opportunities:write"]), "org-1");
    expect(access.canViewDrives).toBe(false);
    expect(access.canAccessDashboard).toBe(false);
  });

  it("grants canViewDrives when opportunities:read is present", () => {
    const access = landingAccessForOrg(
      makeShell(["opportunities:read", "opportunities:write"]),
      "org-1",
    );
    expect(access.canViewDrives).toBe(true);
    expect(access.canAccessDashboard).toBe(true);
  });

  it("redirects write-only staff away from /youth-republic/drives", () => {
    const shell = makeShell(["opportunities:write"]);
    expect(youthRepublicBounceTarget(shell, "org-1", "/youth-republic/drives")).toBe("/");
  });
});
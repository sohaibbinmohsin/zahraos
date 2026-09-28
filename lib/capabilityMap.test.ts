import { describe, it, expect } from "vitest";
import {
  gridToPermissionKeys,
  permissionKeysToGrid,
  effectivePermissionTags,
  deriveRoleTitleFromPermissions,
  RESTRICTED_GRID,
  MODULE_CAPABILITIES,
  type CapabilityGrid,
} from "./capabilityMap";

describe("capabilityMap", () => {
  it("exports MODULE_CAPABILITIES organized by module", () => {
    expect(MODULE_CAPABILITIES["youth-republic"]).toEqual([
      "drive", "publish", "triage", "hours", "volunteers",
    ]);
    expect(MODULE_CAPABILITIES["team-governance"]).toEqual([
      "org_governance", "members", "roles", "audit", "inquiries",
    ]);
  });

  it("expands a modular grid to sorted permission keys including inquiries and team", () => {
    const grid: CapabilityGrid = {
      ...RESTRICTED_GRID,
      drive: "granted",
      publish: "restricted",
      triage: "granted",
      hours: "read_only",
      inquiries: "granted",
      org_governance: "read_only",
      team: "granted",
    };
    expect(gridToPermissionKeys(grid)).toEqual([
      "applications:read",
      "applications:update",
      "chapters:read",
      "hours:read",
      "inquiries:read",
      "inquiries:write",
      "opportunities:read",
      "opportunities:write",
      "team:write",
    ]);
  });

  it("expands read_only inquiries to inquiries:read only", () => {
    const grid: CapabilityGrid = {
      ...RESTRICTED_GRID,
      inquiries: "read_only",
    };
    expect(gridToPermissionKeys(grid)).toEqual(["inquiries:read"]);
  });

  it("converts modular permission keys into modular capability grid", () => {
    const keys = [
      "opportunities:write",
      "opportunities:read",
      "noticeboard:write",
      "applications:update",
      "applications:read",
      "hours:update",
      "hours:read",
      "team:write",
      "inquiries:write",
      "inquiries:read",
      "chapters:write",
      "chapters:read",
      "volunteers:read",
      "admin_action_log:read",
    ];
    const grid = permissionKeysToGrid(keys);
    expect(grid.drive).toBe("granted");
    expect(grid.publish).toBe("granted");
    expect(grid.triage).toBe("granted");
    expect(grid.hours).toBe("granted");
    expect(grid.team).toBe("granted");
    expect(grid.inquiries).toBe("granted");
    expect(grid.org_governance).toBe("granted");
    expect(grid.volunteers).toBe("read_only");
    expect(grid.audit).toBe("read_only");
  });

  it("provides backwards compatibility for existing team:write mapping to team and members", () => {
    const grid = permissionKeysToGrid(["team:write"]);
    expect(grid.team).toBe("granted");
    expect(grid.members).toBe("granted");
  });

  it("round-trips modular grid <-> keys", () => {
    const grid: CapabilityGrid = {
      ...RESTRICTED_GRID,
      drive: "granted",
      publish: "granted",
      triage: "read_only",
      hours: "restricted",
      inquiries: "granted",
      org_governance: "read_only",
      audit: "read_only",
      volunteers: "read_only",
    };
    const keys = gridToPermissionKeys(grid);
    const roundTripped = permissionKeysToGrid(keys);
    expect(roundTripped.drive).toBe(grid.drive);
    expect(roundTripped.publish).toBe(grid.publish);
    expect(roundTripped.triage).toBe(grid.triage);
    expect(roundTripped.hours).toBe(grid.hours);
    expect(roundTripped.inquiries).toBe(grid.inquiries);
    expect(roundTripped.org_governance).toBe(grid.org_governance);
    expect(roundTripped.audit).toBe(grid.audit);
    expect(roundTripped.volunteers).toBe(grid.volunteers);
  });

  it("RESTRICTED_GRID contains all modular capabilities as restricted", () => {
    expect(RESTRICTED_GRID).toMatchObject({
      drive: "restricted",
      publish: "restricted",
      triage: "restricted",
      hours: "restricted",
      volunteers: "restricted",
      org_governance: "restricted",
      members: "restricted",
      roles: "restricted",
      audit: "restricted",
      inquiries: "restricted",
      team: "restricted",
    });
  });

  it("effectivePermissionTags includes Partner Inquiries when inquiries permission present", () => {
    const inquiriesPerms = ["inquiries:read", "inquiries:write"];
    expect(effectivePermissionTags([inquiriesPerms])).toContain("Partner Inquiries");
  });

  describe("deriveRoleTitleFromPermissions", () => {
    const superAdminPerms = [
      "opportunities:read", "opportunities:write", "noticeboard:write",
      "applications:read", "applications:update", "hours:read", "hours:update",
      "volunteers:read", "team:write", "inquiries:read", "inquiries:write",
    ];

    const orgAdminPerms = [
      "opportunities:read", "opportunities:write", "noticeboard:write",
      "applications:read", "applications:update", "hours:read", "hours:update",
      "team:write",
    ];

    const opsLeadPerms = [
      "opportunities:read", "opportunities:write", "noticeboard:write",
      "applications:read", "applications:update", "hours:read", "hours:update",
    ];

    const driveCoordPerms = [
      "opportunities:read", "opportunities:write",
      "applications:read", "applications:update", "hours:read", "hours:update",
    ];

    it("resolves Super Admin when unconstrained and possesses platform permissions", () => {
      expect(deriveRoleTitleFromPermissions(superAdminPerms, false)).toBe("Super Admin");
    });

    it("resolves Org Admin when unconstrained with operational and team management permissions", () => {
      expect(deriveRoleTitleFromPermissions(orgAdminPerms, false)).toBe("Org Admin");
    });

    it("resolves Chapter Admin when chapter-scoped for Org Admin permissions", () => {
      expect(deriveRoleTitleFromPermissions(orgAdminPerms, true)).toBe("Chapter Admin");
      expect(deriveRoleTitleFromPermissions(superAdminPerms, true)).toBe("Chapter Admin");
    });

    it("resolves Operations Lead vs Chapter Operations Lead based on chapter scope", () => {
      expect(deriveRoleTitleFromPermissions(opsLeadPerms, false)).toBe("Operations Lead");
      expect(deriveRoleTitleFromPermissions(opsLeadPerms, true)).toBe("Chapter Operations Lead");
    });

    it("resolves Drive Coordinator vs Chapter Coordinator based on chapter scope", () => {
      expect(deriveRoleTitleFromPermissions(driveCoordPerms, false)).toBe("Drive Coordinator");
      expect(deriveRoleTitleFromPermissions(driveCoordPerms, true)).toBe("Chapter Coordinator");
    });

    it("resolves Application Reviewer and Auditor", () => {
      expect(deriveRoleTitleFromPermissions(["applications:read", "applications:update"], false)).toBe("Application Reviewer");
      expect(deriveRoleTitleFromPermissions(["applications:read", "hours:read"], false)).toBe("Auditor");
    });

    it("returns null for unrecognized or empty permission sets", () => {
      expect(deriveRoleTitleFromPermissions([], false)).toBeNull();
      expect(deriveRoleTitleFromPermissions(["volunteers:read"], false)).toBeNull();
    });
  });
});

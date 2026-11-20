import { describe, it, expect } from "vitest";
import {
  permissionKeysToGrid,
  effectivePermissionTags,
  deriveRoleTitleFromPermissions,
  OFF_GRID,
  MODULE_CAPABILITIES,
  SERVICE_MODULES,
  getRoleModuleSummaries,
  type CapabilityGrid,
  type ServiceModuleConfig,
} from "./capabilityMap";
import { drawerCatalogs, permissionKeysFromDrawerGrid } from "@/registry/moduleCatalog";

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
      ...OFF_GRID,
      drive: "granted",
      publish: "off",
      triage: "granted",
      hours: "view",
      inquiries: "granted",
      org_governance: "view",
      team: "granted",
    };
    expect(permissionKeysFromDrawerGrid(drawerCatalogs, grid)).toEqual([
      "applications:read",
      "applications:update",
      "chapters:read",
      "hours:read",
      "inquiries:read",
      "inquiries:write",
      "members:read",
      "members:write",
      "opportunities:read",
      "opportunities:update",
      "opportunities:write",
      "team:write",
    ]);
  });

  it("expands view inquiries to inquiries:read only", () => {
    const grid: CapabilityGrid = {
      ...OFF_GRID,
      inquiries: "view",
    };
    expect(permissionKeysFromDrawerGrid(drawerCatalogs, grid)).toEqual(["inquiries:read"]);
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
    expect(grid.volunteers).toBe("view");
    expect(grid.audit).toBe("view");
  });

  it("provides backwards compatibility for existing team:write mapping to team and members", () => {
    const grid = permissionKeysToGrid(["team:write"]);
    expect(grid.team).toBe("granted");
    expect(grid.members).toBe("granted");
  });

  it("round-trips modular grid <-> keys", () => {
    const grid: CapabilityGrid = {
      ...OFF_GRID,
      drive: "granted",
      publish: "granted",
      triage: "view",
      hours: "off",
      inquiries: "granted",
      org_governance: "view",
      audit: "view",
      volunteers: "view",
    };
    const keys = permissionKeysFromDrawerGrid(drawerCatalogs, grid);
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

  it("OFF_GRID contains all modular capabilities as off", () => {
    expect(OFF_GRID).toMatchObject({
      drive: "off",
      publish: "off",
      triage: "off",
      hours: "off",
      volunteers: "off",
      org_governance: "off",
      members: "off",
      roles: "off",
      audit: "off",
      inquiries: "off",
      team: "off",
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

    it("resolves City Lead vs Chapter Lead for operational permissions without chapter governance", () => {
      expect(deriveRoleTitleFromPermissions(opsLeadPerms, false)).toBe("City Lead");
      expect(deriveRoleTitleFromPermissions(opsLeadPerms, true)).toBe("Chapter Lead");
    });

    it("resolves Chapter Lead for single-chapter scope and City Lead for multi-chapter scope", () => {
      const leadPerms = [
        "opportunities:write", "opportunities:read",
        "noticeboard:write",
        "applications:update", "applications:read",
        "hours:update", "hours:read",
        "chapters:write", "chapters:read",
      ];
      expect(deriveRoleTitleFromPermissions(leadPerms, true, 1)).toBe("Chapter Lead");
      expect(deriveRoleTitleFromPermissions(leadPerms, true, 2)).toBe("City Lead");
      expect(deriveRoleTitleFromPermissions(leadPerms, false)).toBe("City Lead"); // unconstrained/org-wide
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

  describe("getRoleModuleSummaries & SERVICE_MODULES", () => {
    it("exports SERVICE_MODULES with correct service configs for Youth Republic and Team & Governance", () => {
      expect(SERVICE_MODULES).toHaveLength(2);
      expect(SERVICE_MODULES[0]).toMatchObject({
        key: "youth-republic",
        title: "Youth Republic",
        capabilities: ["drive", "publish", "triage", "hours", "volunteers"],
      });
      expect(SERVICE_MODULES[1]).toMatchObject({
        key: "team-governance",
        title: "Team & Governance",
        capabilities: ["org_governance", "members", "roles", "audit", "inquiries"],
      });
    });

    it("derives full access for Super Admin across all modules", () => {
      const superAdminGrid: CapabilityGrid = {
        drive: "granted",
        publish: "granted",
        triage: "granted",
        hours: "granted",
        volunteers: "view",
        org_governance: "granted",
        members: "granted",
        roles: "granted",
        audit: "view",
        inquiries: "granted",
        team: "granted",
      };

      const summaries = getRoleModuleSummaries(superAdminGrid);
      expect(summaries).toHaveLength(2);

      const yr = summaries.find((s) => s.moduleKey === "youth-republic")!;
      expect(yr).toBeDefined();
      expect(yr.title).toBe("Youth Republic");
      expect(yr.level).toBe("full");
      expect(yr.grantedCount).toBe(4);
      expect(yr.readOnlyCount).toBe(1);
      expect(yr.offCount).toBe(0);
      expect(yr.totalCount).toBe(5);

      const tg = summaries.find((s) => s.moduleKey === "team-governance")!;
      expect(tg).toBeDefined();
      expect(tg.title).toBe("Team & Governance");
      expect(tg.level).toBe("full");
      expect(tg.grantedCount).toBe(4);
      expect(tg.readOnlyCount).toBe(1);
      expect(tg.offCount).toBe(0);
      expect(tg.totalCount).toBe(5);
    });

    it("derives full access for Youth Republic and limited for Team Governance for Chapter Lead", () => {
      const chapterLeadGrid: CapabilityGrid = {
        ...OFF_GRID,
        drive: "granted",
        publish: "granted",
        triage: "granted",
        hours: "granted",
        volunteers: "off",
        org_governance: "granted",
      };

      const summaries = getRoleModuleSummaries(chapterLeadGrid);
      const yr = summaries.find((s) => s.moduleKey === "youth-republic")!;
      expect(yr.level).toBe("full");
      expect(yr.grantedCount).toBe(4);
      expect(yr.readOnlyCount).toBe(0);
      expect(yr.offCount).toBe(1);
      expect(yr.totalCount).toBe(5);

      const tg = summaries.find((s) => s.moduleKey === "team-governance")!;
      expect(tg.level).toBe("limited");
      expect(tg.grantedCount).toBe(1);
      expect(tg.readOnlyCount).toBe(0);
      expect(tg.offCount).toBe(4);
      expect(tg.totalCount).toBe(5);
    });

    it("derives off for an empty capability module", () => {
      const emptyModule: ServiceModuleConfig = {
        key: "empty-module",
        title: "Empty Module",
        description: "Module with no capabilities yet",
        capabilities: [],
      };

      const summaries = getRoleModuleSummaries(OFF_GRID, [emptyModule]);
      expect(summaries).toHaveLength(1);
      expect(summaries[0].level).toBe("off");
      expect(summaries[0].totalCount).toBe(0);
      expect(summaries[0].grantedCount).toBe(0);
      expect(summaries[0].offCount).toBe(0);
    });

    it("derives off access for fully off grid", () => {
      const summaries = getRoleModuleSummaries(OFF_GRID);
      for (const summary of summaries) {
        expect(summary.level).toBe("off");
        expect(summary.grantedCount).toBe(0);
        expect(summary.readOnlyCount).toBe(0);
        expect(summary.offCount).toBe(5);
        expect(summary.totalCount).toBe(5);
      }
    });

    it("derives view access for Auditor role", () => {
      const auditorGrid: CapabilityGrid = {
        ...OFF_GRID,
        triage: "view",
        hours: "view",
        volunteers: "view",
        audit: "view",
      };

      const summaries = getRoleModuleSummaries(auditorGrid);
      const yr = summaries.find((s) => s.moduleKey === "youth-republic")!;
      expect(yr.level).toBe("view");
      expect(yr.grantedCount).toBe(0);
      expect(yr.readOnlyCount).toBe(3);
      expect(yr.offCount).toBe(2);

      const tg = summaries.find((s) => s.moduleKey === "team-governance")!;
      expect(tg.level).toBe("view");
      expect(tg.grantedCount).toBe(0);
      expect(tg.readOnlyCount).toBe(1);
      expect(tg.offCount).toBe(4);
    });

    it("accepts permission keys array directly", () => {
      const superAdminPerms = [
        "opportunities:write",
        "opportunities:read",
        "noticeboard:write",
        "applications:update",
        "applications:read",
        "hours:update",
        "hours:read",
        "volunteers:read",
        "chapters:write",
        "chapters:read",
        "members:write",
        "roles:write",
        "admin_action_log:read",
        "inquiries:write",
        "inquiries:read",
      ];

      const summaries = getRoleModuleSummaries(superAdminPerms);
      expect(summaries[0].level).toBe("full");
      expect(summaries[1].level).toBe("full");
    });

    it("supports custom modules config override", () => {
      const customModule: ServiceModuleConfig = {
        key: "custom-ops",
        title: "Custom Ops",
        description: "Custom operational checks",
        capabilities: ["drive", "hours"],
      };

      const grid: CapabilityGrid = {
        ...OFF_GRID,
        drive: "granted",
        hours: "granted",
      };

      const summaries = getRoleModuleSummaries(grid, [customModule]);
      expect(summaries).toHaveLength(1);
      expect(summaries[0].moduleKey).toBe("custom-ops");
      expect(summaries[0].level).toBe("full");
      expect(summaries[0].grantedCount).toBe(2);
      expect(summaries[0].totalCount).toBe(2);
    });
  });
});

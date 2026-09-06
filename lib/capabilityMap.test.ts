import { describe, it, expect } from "vitest";
import {
  gridToPermissionKeys,
  permissionKeysToGrid,
  effectivePermissionTags,
  RESTRICTED_GRID,
  type CapabilityGrid,
} from "./capabilityMap";

describe("capabilityMap", () => {
  it("expands a grid to sorted permission keys", () => {
    const grid: CapabilityGrid = {
      drive: "granted", publish: "restricted", triage: "granted", hours: "read_only", team: "granted",
    };
    expect(gridToPermissionKeys(grid)).toEqual([
      "applications:read", "applications:update", "hours:read", "opportunities:write", "team:write",
    ]);
  });

  it("round-trips grid <-> keys", () => {
    const grid: CapabilityGrid = {
      drive: "granted", publish: "granted", triage: "read_only", hours: "restricted", team: "restricted",
    };
    expect(permissionKeysToGrid(gridToPermissionKeys(grid))).toEqual(grid);
  });

  it("RESTRICTED_GRID is all restricted", () => {
    expect(RESTRICTED_GRID).toEqual({
      drive: "restricted", publish: "restricted", triage: "restricted", hours: "restricted", team: "restricted",
    });
  });

  it("effectivePermissionTags unions across roles and orders the tags", () => {
    const opsLead = ["opportunities:write", "noticeboard:write", "applications:update", "applications:read", "hours:update", "hours:read"];
    const auditor = ["applications:read", "hours:read"];
    expect(effectivePermissionTags([opsLead, auditor])).toEqual([
      "Create Drives", "Publish Noticeboard", "Triage Apps", "Approve Hours",
    ]);
    expect(effectivePermissionTags([auditor])).toEqual([
      "View Apps (Read Only)", "View Hours (Read Only)",
    ]);
  });
});

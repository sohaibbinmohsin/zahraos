import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { gridToPermissionKeys, permissionKeysToGrid, type CapabilityGrid } from "./capabilityMap.ts";

Deno.test("gridToPermissionKeys expands each level", () => {
  const grid: CapabilityGrid = {
    drive: "granted", publish: "restricted", triage: "granted", hours: "read_only", team: "granted",
  };
  assertEquals(gridToPermissionKeys(grid), [
    "applications:read", "applications:update", "hours:read", "opportunities:write", "team:write",
  ]);
});

Deno.test("permissionKeysToGrid is the inverse and defaults missing to restricted", () => {
  assertEquals(permissionKeysToGrid(["applications:read", "hours:read"]), {
    drive: "restricted", publish: "restricted", triage: "read_only", hours: "read_only", team: "restricted",
  });
  assertEquals(permissionKeysToGrid(["opportunities:write", "noticeboard:write", "applications:update", "applications:read", "hours:update", "hours:read", "team:write"]), {
    drive: "granted", publish: "granted", triage: "granted", hours: "granted", team: "granted",
  });
});

Deno.test("round-trips", () => {
  const grid: CapabilityGrid = {
    drive: "granted", publish: "granted", triage: "read_only", hours: "restricted", team: "restricted",
  };
  assertEquals(permissionKeysToGrid(gridToPermissionKeys(grid)), grid);
});

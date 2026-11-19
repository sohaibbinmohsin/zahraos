import { describe, expect, it } from "vitest";
import { requirePermissionKeys } from "./requirePermissionKeys";

describe("requirePermissionKeys", () => {
  it("returns the expanded keys", () => {
    expect(requirePermissionKeys({
      permissionKeys: ["opportunities:read", "opportunities:write", "opportunities:update"],
    })).toEqual(["opportunities:read", "opportunities:write", "opportunities:update"]);
  });

  it("rejects a body that does not carry permissionKeys", () => {
    expect(() => requirePermissionKeys({})).toThrow("permission_keys_required");
  });
});
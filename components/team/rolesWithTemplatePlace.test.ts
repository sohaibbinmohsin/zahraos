import { describe, expect, it } from "vitest";
import { platformCatalog } from "@/registry/platformCatalog";
import { yrCatalogFixture } from "./testCatalogFixtures";
import { rolesWithTemplatePlace } from "./rolesWithTemplatePlace";

describe("rolesWithTemplatePlace", () => {
  const dbRoles = [
    { id: "1", name: "Super Admin", isSystem: true },
    { id: "2", name: "City Lead", isSystem: true, permissionKeys: ["opportunities:read"] },
    { id: "3", name: "Chapter Lead", isSystem: true, permissionKeys: ["opportunities:read"] },
    { id: "4", name: "Auditor", isSystem: true },
  ];

  it("merges place from platform and module catalogs by role name", () => {
    const merged = rolesWithTemplatePlace(dbRoles, [platformCatalog, yrCatalogFixture]);
    expect(merged.find((r) => r.name === "Super Admin")?.place).toBe("none");
    expect(merged.find((r) => r.name === "Auditor")?.place).toBe("none");
    expect(merged.find((r) => r.name === "City Lead")?.place).toBe("city");
    expect(merged.find((r) => r.name === "Chapter Lead")?.place).toBe("chapters");
  });

  it("does not assign place until catalogs have loaded", () => {
    const mergedNull = rolesWithTemplatePlace(dbRoles, null);
    const mergedEmpty = rolesWithTemplatePlace(dbRoles, []);
    for (const merged of [mergedNull, mergedEmpty]) {
      expect(merged.find((r) => r.name === "City Lead")?.place).toBeUndefined();
      expect(merged.find((r) => r.name === "Chapter Lead")?.place).toBeUndefined();
      expect(merged.find((r) => r.name === "Super Admin")?.place).toBeUndefined();
    }
  });
});
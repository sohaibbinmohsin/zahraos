import { describe, it, expect } from "vitest";
import { resolveOrgSwitcherOptions, pickInitialOrgId } from "./selectedOrg";

describe("resolveOrgSwitcherOptions", () => {
  it("returns the union of org_roles and module_access organization ids, de-duplicated", () => {
    const result = resolveOrgSwitcherOptions(
      [{ organizationId: "org-1" }],
      [{ organizationId: "org-1", module: "vms", permissions: [] }, { organizationId: "org-2", module: "vms", permissions: [] }],
    );
    expect(result.sort()).toEqual(["org-1", "org-2"]);
  });

  it("returns an empty array when the staff has no org affiliation at all", () => {
    expect(resolveOrgSwitcherOptions([], [])).toEqual([]);
  });
});

describe("pickInitialOrgId", () => {
  it("prefers a stored org id when it's still in the available list", () => {
    expect(pickInitialOrgId(["org-1", "org-2"], "org-2")).toBe("org-2");
  });

  it("falls back to the first available org when the stored id is no longer valid", () => {
    expect(pickInitialOrgId(["org-1", "org-2"], "org-9")).toBe("org-1");
  });

  it("falls back to the first available org when nothing is stored", () => {
    expect(pickInitialOrgId(["org-1", "org-2"], null)).toBe("org-1");
  });

  it("returns null when there are no available orgs at all", () => {
    expect(pickInitialOrgId([], null)).toBeNull();
  });
});

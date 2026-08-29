import { describe, it, expect } from "vitest";
import { resolveOrgSwitcherOptions, pickInitialOrgId } from "./selectedOrg";

describe("resolveOrgSwitcherOptions", () => {
  it("returns the union of org_roles and module_access organization ids, de-duplicated", () => {
    // Typed as a variable, not passed as an inline literal, so TypeScript's
    // excess-property check (which would otherwise reject `module`/
    // `permissions` against resolveOrgSwitcherOptions's narrower
    // `{ organizationId: string }[]` parameter type) doesn't apply here —
    // matches how real callers (e.g. AppShell.tsx) pass claims.moduleAccess,
    // a variable of the wider StaffTokenClaims shape, not a fresh literal.
    const moduleAccess: { organizationId: string; module: string; permissions: string[] }[] = [
      { organizationId: "org-1", module: "vms", permissions: [] },
      { organizationId: "org-2", module: "vms", permissions: [] },
    ];
    const result = resolveOrgSwitcherOptions([{ organizationId: "org-1" }], moduleAccess);
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

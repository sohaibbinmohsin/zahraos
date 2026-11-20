import { describe, expect, it } from "vitest";
import { expandSwitches, keysFor, moduleBadge, type ModuleCatalog } from "./moduleCatalog";

const catalog: ModuleCatalog = {
  key: "youth-republic",
  title: "Youth Republic",
  description: "areas",
  areas: [
    { key: "drives", label: "Drives", highest: "manage", keysBySwitch: { view: ["opportunities:read"], manage: ["opportunities:read", "opportunities:write", "opportunities:update"] } },
    { key: "noticeboard", label: "Noticeboard", highest: "manage", keysBySwitch: { view: ["noticeboard:read"], manage: ["noticeboard:read", "noticeboard:write"] } },
    { key: "applications", label: "Applications", highest: "manage", keysBySwitch: { view: ["applications:read"], manage: ["applications:read", "applications:update"] } },
    { key: "hours", label: "Hours", highest: "manage", keysBySwitch: { view: ["hours:read"], manage: ["hours:read", "hours:update"] } },
    { key: "volunteers", label: "Volunteer Directory", highest: "view", keysBySwitch: { view: ["volunteers:read"] } },
  ],
  roleTemplates: [],
};

const lead = { drives: "manage", noticeboard: "manage", applications: "manage", hours: "manage", volunteers: "none" } as const;
const auditor = { drives: "none", noticeboard: "none", applications: "view", hours: "view", volunteers: "none" } as const;
const full = { drives: "manage", noticeboard: "manage", applications: "manage", hours: "manage", volunteers: "view" } as const;

describe("area switches", () => {
  it("expands manage to the view key plus the write keys", () => {
    expect(expandSwitches(catalog, lead).sort()).toEqual([
      "applications:read", "applications:update",
      "hours:read", "hours:update",
      "noticeboard:read", "noticeboard:write",
      "opportunities:read", "opportunities:update", "opportunities:write",
    ]);
  });

  it("rejects manage on Volunteer Directory", () => {
    const volunteers = catalog.areas[4];
    expect(() => keysFor(volunteers, "manage")).toThrow("manage_not_available");
  });

  it("badges a lead as limited, an auditor as view only, and a full ceiling as full", () => {
    expect(moduleBadge(catalog, lead)).toBe("limited");
    expect(moduleBadge(catalog, auditor)).toBe("view_only");
    expect(moduleBadge(catalog, full)).toBe("full");
    expect(moduleBadge(catalog, { drives: "none", noticeboard: "none", applications: "none", hours: "none", volunteers: "none" })).toBe("none");
  });
});
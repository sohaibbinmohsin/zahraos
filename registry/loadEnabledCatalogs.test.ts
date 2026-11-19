import { describe, expect, it, vi } from "vitest";
import { loadEnabledCatalogs } from "./loadEnabledCatalogs";
import { moduleBadge } from "./moduleCatalog";
import { platformCatalog, platformRole } from "./platformCatalog";

describe("loadEnabledCatalogs", () => {
  it("returns Team & Governance and does not fetch a disabled module", async () => {
    const fetchCatalog = vi.fn();
    const catalogs = await loadEnabledCatalogs([], fetchCatalog);
    expect(catalogs.map((catalog) => catalog.key)).toEqual(["team-governance"]);
    expect(fetchCatalog).not.toHaveBeenCalled();
  });

  it("fetches youth-republic only when that module is enabled", async () => {
    const fetchCatalog = vi.fn().mockResolvedValue({
      key: "youth-republic",
      title: "Youth Republic",
      description: "areas",
      areas: [],
      roleTemplates: [],
    });
    const catalogs = await loadEnabledCatalogs(["youth-republic"], fetchCatalog);
    expect(fetchCatalog).toHaveBeenCalledTimes(1);
    expect(fetchCatalog).toHaveBeenCalledWith("youth-republic");
    expect(catalogs.map((catalog) => catalog.key)).toEqual(["team-governance", "youth-republic"]);
  });
});

describe("platform roles", () => {
  it("gives Auditor view on Audit Logs and none on the other platform areas", () => {
    const auditor = platformRole("Auditor");
    expect(auditor.place).toBe("none");
    expect(auditor.switches.audit).toBe("view");
    expect(auditor.switches.org_governance).toBe("none");
    expect(moduleBadge(platformCatalog, auditor.switches)).toBe("view_only");
  });

  it("gives Org Admin a limited platform badge and Super Admin a full one", () => {
    expect(moduleBadge(platformCatalog, platformRole("Org Admin").switches)).toBe("limited");
    expect(moduleBadge(platformCatalog, platformRole("Super Admin").switches)).toBe("full");
    expect(platformCatalog.areas.find((area) => area.key === "audit")!.highest).toBe("view");
  });
});
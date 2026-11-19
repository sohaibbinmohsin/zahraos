export type AreaSwitch = "none" | "view" | "manage";
export type PlaceParameter = "none" | "chapters" | "city";
export type ModuleBadge = "full" | "limited" | "view_only" | "none";

export interface CatalogArea {
  key: string;
  label: string;
  highest: "view" | "manage";
  keysBySwitch: { view: string[]; manage?: string[] };
}

export interface ModuleRoleTemplate {
  name: string;
  description: string;
  place: PlaceParameter;
  switches: Record<string, AreaSwitch>;
}

export interface ModuleCatalog {
  key: string;
  title: string;
  description: string;
  areas: CatalogArea[];
  roleTemplates: ModuleRoleTemplate[];
}

export function keysFor(area: CatalogArea, areaSwitch: AreaSwitch): string[] {
  if (areaSwitch === "none") {
    return [];
  }
  if (areaSwitch === "view") {
    return [...area.keysBySwitch.view];
  }
  if (area.highest === "view") {
    throw new Error("manage_not_available");
  }
  return [...(area.keysBySwitch.manage ?? [])];
}

export function expandSwitches(
  catalog: ModuleCatalog,
  switches: Record<string, AreaSwitch>,
): string[] {
  const keys = new Set<string>();
  for (const area of catalog.areas) {
    const areaSwitch = switches[area.key] ?? "none";
    for (const key of keysFor(area, areaSwitch)) {
      keys.add(key);
    }
  }
  return [...keys].sort();
}

function everyKeyPresent(keys: string[], held: Set<string>): boolean {
  return keys.length > 0 && keys.every((key) => held.has(key));
}

export function switchesFromKeys(catalog: ModuleCatalog, keys: string[]): Record<string, AreaSwitch> {
  const held = new Set(keys);
  const result: Record<string, AreaSwitch> = {};

  for (const area of catalog.areas) {
    const manageKeys = area.keysBySwitch.manage;
    if (
      area.highest === "manage" &&
      manageKeys !== undefined &&
      everyKeyPresent(manageKeys, held)
    ) {
      result[area.key] = "manage";
    } else if (everyKeyPresent(area.keysBySwitch.view, held)) {
      result[area.key] = "view";
    } else {
      result[area.key] = "none";
    }
  }

  return result;
}

export function moduleBadge(
  catalog: ModuleCatalog,
  switches: Record<string, AreaSwitch>,
): ModuleBadge {
  let allAtHighest = true;
  let anyManage = false;
  let anyView = false;
  let allNone = true;

  for (const area of catalog.areas) {
    const areaSwitch = switches[area.key] ?? "none";
    if (areaSwitch !== area.highest) {
      allAtHighest = false;
    }
    if (areaSwitch !== "none") {
      allNone = false;
    }
    if (areaSwitch === "manage") {
      anyManage = true;
    }
    if (areaSwitch === "view") {
      anyView = true;
    }
  }

  if (allAtHighest) {
    return "full";
  }
  if (!anyManage && anyView) {
    return "view_only";
  }
  if (allNone) {
    return "none";
  }
  return "limited";
}

export const youthRepublicCatalog: ModuleCatalog = {
  key: "youth-republic",
  title: "Youth Republic",
  description: "Volunteer drives, public noticeboard, applicant screening, and shift hours logging.",
  areas: [
    {
      key: "drives",
      label: "Drives",
      highest: "manage",
      keysBySwitch: {
        view: ["opportunities:read"],
        manage: ["opportunities:read", "opportunities:write", "opportunities:update"],
      },
    },
    {
      key: "noticeboard",
      label: "Noticeboard",
      highest: "manage",
      keysBySwitch: {
        view: ["noticeboard:read"],
        manage: ["noticeboard:read", "noticeboard:write"],
      },
    },
    {
      key: "applications",
      label: "Applications",
      highest: "manage",
      keysBySwitch: {
        view: ["applications:read"],
        manage: ["applications:read", "applications:update"],
      },
    },
    {
      key: "hours",
      label: "Hours",
      highest: "manage",
      keysBySwitch: {
        view: ["hours:read"],
        manage: ["hours:read", "hours:update"],
      },
    },
    {
      key: "volunteers",
      label: "Volunteer Directory",
      highest: "view",
      keysBySwitch: { view: ["volunteers:read"] },
    },
  ],
  roleTemplates: [],
};

export const teamGovernanceCatalog: ModuleCatalog = {
  key: "team-governance",
  title: "Team & Governance",
  description: "Chapter governance, team roster, roles configuration, partner inquiries, and audit logs.",
  areas: [
    {
      key: "org_governance",
      label: "Org Governance",
      highest: "manage",
      keysBySwitch: {
        view: ["chapters:read"],
        manage: ["chapters:read", "chapters:write"],
      },
    },
    {
      key: "team_members",
      label: "Team Members",
      highest: "manage",
      keysBySwitch: {
        view: ["members:read"],
        manage: ["members:read", "members:write", "team:write"],
      },
    },
    {
      key: "roles",
      label: "Roles & Permissions",
      highest: "manage",
      keysBySwitch: {
        view: ["roles:read"],
        manage: ["roles:read", "roles:write"],
      },
    },
    {
      key: "audit",
      label: "Audit Logs",
      highest: "view",
      keysBySwitch: { view: ["admin_action_log:read"] },
    },
    {
      key: "inquiries",
      label: "Partner Inquiries",
      highest: "manage",
      keysBySwitch: {
        view: ["inquiries:read"],
        manage: ["inquiries:read", "inquiries:write"],
      },
    },
  ],
  roleTemplates: [],
};

/** Catalogs currently shown in the role drawer (platform + enabled modules). */
export const drawerCatalogs: readonly ModuleCatalog[] = [
  teamGovernanceCatalog,
  youthRepublicCatalog,
];

export type LegacyDrawerLevel = "granted" | "view" | "off";

const YR_LEGACY_AREA: Record<string, string> = {
  drive: "drives",
  publish: "noticeboard",
  triage: "applications",
  hours: "hours",
  volunteers: "volunteers",
};

const PLATFORM_LEGACY_AREA: Record<string, string> = {
  org_governance: "org_governance",
  members: "team_members",
  roles: "roles",
  audit: "audit",
  inquiries: "inquiries",
  team: "team_members",
};

function legacyLevelToSwitch(area: CatalogArea, level: LegacyDrawerLevel): AreaSwitch {
  if (level === "off") return "none";
  if (level === "view") return "view";
  if (area.highest === "view") return "view";
  return "manage";
}

export function switchesFromLegacyDrawerGrid(
  catalog: ModuleCatalog,
  grid: Record<string, LegacyDrawerLevel | string>,
): Record<string, AreaSwitch> {
  const areaByKey = new Map(catalog.areas.map((area) => [area.key, area]));
  const mapping = catalog.key === "youth-republic" ? YR_LEGACY_AREA : PLATFORM_LEGACY_AREA;
  const result: Record<string, AreaSwitch> = Object.fromEntries(
    catalog.areas.map((area) => [area.key, "none" as AreaSwitch]),
  );

  for (const [legacyKey, rawLevel] of Object.entries(grid)) {
    const areaKey = mapping[legacyKey];
    if (!areaKey) continue;
    const area = areaByKey.get(areaKey);
    if (!area) continue;
    const level = rawLevel as LegacyDrawerLevel;
    if (level === "off") continue;
    const next = legacyLevelToSwitch(area, level);
    const current = result[areaKey];
    if (current === "manage" || next === "manage") {
      result[areaKey] = "manage";
    } else if (current === "view" || next === "view") {
      result[areaKey] = "view";
    }
  }

  return result;
}

/** Sorted union of expanded keys for every catalog from the drawer’s legacy capability grid. */
export function permissionKeysFromDrawerGrid(
  catalogs: readonly ModuleCatalog[],
  grid: Record<string, LegacyDrawerLevel | string>,
): string[] {
  const keys = new Set<string>();
  for (const catalog of catalogs) {
    const switches = switchesFromLegacyDrawerGrid(catalog, grid);
    for (const key of expandSwitches(catalog, switches)) {
      keys.add(key);
    }
  }
  return [...keys].sort();
}

export function moduleBadgeLabel(badge: ModuleBadge): string {
  switch (badge) {
    case "full":
      return "Full Access";
    case "limited":
      return "Limited";
    case "view_only":
      return "View Only";
    case "none":
      return "None";
  }
}

export function moduleBadgeClass(badge: ModuleBadge): string {
  switch (badge) {
    case "full":
      return "badge-pos";
    case "limited":
      return "badge-warn";
    case "view_only":
      return "badge-neu";
    case "none":
      return "badge-neg";
  }
}
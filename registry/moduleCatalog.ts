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
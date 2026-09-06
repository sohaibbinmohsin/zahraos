export type CapabilityKey = "drive" | "publish" | "triage" | "hours" | "team";
export type CapabilityLevel = "granted" | "read_only" | "restricted";
export type CapabilityGrid = Record<CapabilityKey, CapabilityLevel>;

export const CAPABILITY_KEYS: CapabilityKey[] = ["drive", "publish", "triage", "hours", "team"];

export const CAPABILITY_META: Record<CapabilityKey, { column: string; levels: CapabilityLevel[] }> = {
  drive:   { column: "Drive Creation",      levels: ["granted", "restricted"] },
  publish: { column: "Publish Noticeboard", levels: ["granted", "restricted"] },
  triage:  { column: "Triage Apps",         levels: ["granted", "read_only", "restricted"] },
  hours:   { column: "Approve Hours",       levels: ["granted", "read_only", "restricted"] },
  team:    { column: "Team Management",     levels: ["granted", "restricted"] },
};

export const RESTRICTED_GRID: CapabilityGrid = {
  drive: "restricted", publish: "restricted", triage: "restricted", hours: "restricted", team: "restricted",
};

const RULES: Record<CapabilityKey, { granted: string[]; read_only: string[] }> = {
  drive:   { granted: ["opportunities:write"],                     read_only: [] },
  publish: { granted: ["noticeboard:write"],                       read_only: [] },
  triage:  { granted: ["applications:update", "applications:read"], read_only: ["applications:read"] },
  hours:   { granted: ["hours:update", "hours:read"],              read_only: ["hours:read"] },
  team:    { granted: ["team:write"],                              read_only: [] },
};

export function gridToPermissionKeys(grid: CapabilityGrid): string[] {
  const keys = new Set<string>();
  for (const cap of CAPABILITY_KEYS) {
    if (grid[cap] === "granted") RULES[cap].granted.forEach((k) => keys.add(k));
    else if (grid[cap] === "read_only") RULES[cap].read_only.forEach((k) => keys.add(k));
  }
  return [...keys].sort();
}

export function permissionKeysToGrid(keys: string[]): CapabilityGrid {
  const has = (k: string) => keys.includes(k);
  const grid = {} as CapabilityGrid;
  for (const cap of CAPABILITY_KEYS) {
    if (RULES[cap].granted.length > 0 && RULES[cap].granted.every(has)) grid[cap] = "granted";
    else if (RULES[cap].read_only.length > 0 && RULES[cap].read_only.every(has)) grid[cap] = "read_only";
    else grid[cap] = "restricted";
  }
  return grid;
}

export function effectivePermissionTags(permissionKeyGroups: string[][]): string[] {
  const all = new Set(permissionKeyGroups.flat());
  const tags: string[] = [];
  if (all.has("opportunities:write")) tags.push("Create Drives");
  if (all.has("noticeboard:write")) tags.push("Publish Noticeboard");
  if (all.has("applications:update")) tags.push("Triage Apps");
  if (all.has("hours:update")) tags.push("Approve Hours");
  if (all.has("team:write")) tags.push("Manage Team");
  if (!all.has("applications:update") && all.has("applications:read")) tags.push("View Apps (Read Only)");
  if (!all.has("hours:update") && all.has("hours:read")) tags.push("View Hours (Read Only)");
  return tags;
}

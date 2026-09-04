export type CapabilityKey = "drive" | "publish" | "triage" | "hours" | "team";
export type CapabilityLevel = "granted" | "read_only" | "restricted";
export type CapabilityGrid = Record<CapabilityKey, CapabilityLevel>;

export const CAPABILITY_KEYS: CapabilityKey[] = ["drive", "publish", "triage", "hours", "team"];

const RULES: Record<CapabilityKey, { granted: string[]; read_only: string[] }> = {
  drive:   { granted: ["opportunities:write"],                    read_only: [] },
  publish: { granted: ["noticeboard:write"],                      read_only: [] },
  triage:  { granted: ["applications:update", "applications:read"], read_only: ["applications:read"] },
  hours:   { granted: ["hours:update", "hours:read"],             read_only: ["hours:read"] },
  team:    { granted: ["team:write"],                             read_only: [] },
};

export function gridToPermissionKeys(grid: CapabilityGrid): string[] {
  const keys = new Set<string>();
  for (const cap of CAPABILITY_KEYS) {
    const level = grid[cap];
    if (level === "granted") RULES[cap].granted.forEach((k) => keys.add(k));
    else if (level === "read_only") RULES[cap].read_only.forEach((k) => keys.add(k));
  }
  return [...keys].sort();
}

export function permissionKeysToGrid(keys: string[]): CapabilityGrid {
  const has = (k: string) => keys.includes(k);
  const grid = {} as CapabilityGrid;
  for (const cap of CAPABILITY_KEYS) {
    if (RULES[cap].granted.every(has) && RULES[cap].granted.length > 0) grid[cap] = "granted";
    else if (RULES[cap].read_only.every(has) && RULES[cap].read_only.length > 0) grid[cap] = "read_only";
    else grid[cap] = "restricted";
  }
  return grid;
}

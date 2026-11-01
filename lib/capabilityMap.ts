export const MODULE_CAPABILITIES = {
  "youth-republic": ["drive", "publish", "triage", "hours", "volunteers"],
  "team-governance": ["org_governance", "members", "roles", "audit", "inquiries"],
} as const;

export type YouthRepublicCapability = typeof MODULE_CAPABILITIES["youth-republic"][number];
export type TeamGovernanceCapability = typeof MODULE_CAPABILITIES["team-governance"][number];
export type CapabilityKey = YouthRepublicCapability | TeamGovernanceCapability | "team";
export type CapabilityLevel = "granted" | "read_only" | "restricted";
export type CapabilityGrid = Record<CapabilityKey, CapabilityLevel>;

export const CAPABILITY_KEYS: CapabilityKey[] = [
  ...MODULE_CAPABILITIES["youth-republic"],
  ...MODULE_CAPABILITIES["team-governance"],
  "team",
];

export const CAPABILITY_META: Record<CapabilityKey, { column: string; levels: CapabilityLevel[] }> = {
  drive:          { column: "Drive Creation",       levels: ["granted", "read_only", "restricted"] },
  publish:        { column: "Publish Noticeboard",  levels: ["granted", "read_only", "restricted"] },
  triage:         { column: "Triage Apps",          levels: ["granted", "read_only", "restricted"] },
  hours:          { column: "Approve Hours",        levels: ["granted", "read_only", "restricted"] },
  volunteers:     { column: "Volunteer Directory",  levels: ["read_only", "restricted"] },
  org_governance: { column: "Org Governance",       levels: ["granted", "read_only", "restricted"] },
  members:        { column: "Team Members",         levels: ["granted", "read_only", "restricted"] },
  roles:          { column: "Roles & Permissions",  levels: ["granted", "read_only", "restricted"] },
  audit:          { column: "Audit Logs",           levels: ["read_only", "restricted"] },
  inquiries:      { column: "Partner Inquiries",    levels: ["granted", "read_only", "restricted"] },
  team:           { column: "Team Management",      levels: ["granted", "restricted"] },
};

export const RESTRICTED_GRID: CapabilityGrid = {
  drive: "restricted",
  publish: "restricted",
  triage: "restricted",
  hours: "restricted",
  volunteers: "restricted",
  org_governance: "restricted",
  members: "restricted",
  roles: "restricted",
  audit: "restricted",
  inquiries: "restricted",
  team: "restricted",
};

const RULES: Record<CapabilityKey, { granted: string[]; read_only: string[] }> = {
  drive:          { granted: ["opportunities:write", "opportunities:read"], read_only: ["opportunities:read"] },
  publish:        { granted: ["noticeboard:write"],                        read_only: ["noticeboard:read"] },
  triage:         { granted: ["applications:update", "applications:read"],  read_only: ["applications:read"] },
  hours:          { granted: ["hours:update", "hours:read"],               read_only: ["hours:read"] },
  volunteers:     { granted: ["volunteers:read"],                          read_only: ["volunteers:read"] },
  org_governance: { granted: ["chapters:write", "chapters:read"],          read_only: ["chapters:read"] },
  members:        { granted: ["members:write", "members:read"],             read_only: ["members:read"] },
  roles:          { granted: ["roles:write", "roles:read"],                 read_only: ["roles:read"] },
  audit:          { granted: ["admin_action_log:read"],                     read_only: ["admin_action_log:read"] },
  inquiries:      { granted: ["inquiries:write", "inquiries:read"],         read_only: ["inquiries:read"] },
  team:           { granted: ["team:write"],                               read_only: [] },
};

export function gridToPermissionKeys(grid: CapabilityGrid): string[] {
  const keys = new Set<string>();
  const allKeys: CapabilityKey[] = [...CAPABILITY_KEYS, "team"];
  for (const cap of allKeys) {
    if (grid[cap] === "granted") {
      RULES[cap].granted.forEach((k) => keys.add(k));
    } else if (grid[cap] === "read_only") {
      RULES[cap].read_only.forEach((k) => keys.add(k));
    }
  }
  return [...keys].sort();
}

export function permissionKeysToGrid(keys: string[]): CapabilityGrid {
  const has = (k: string) => keys.includes(k);
  const grid = { ...RESTRICTED_GRID };

  // Youth Republic capabilities
  if (has("opportunities:write")) grid.drive = "granted";
  else if (has("opportunities:read")) grid.drive = "read_only";

  if (has("noticeboard:write")) grid.publish = "granted";
  else if (has("noticeboard:read")) grid.publish = "read_only";

  if (has("applications:update")) grid.triage = "granted";
  else if (has("applications:read")) grid.triage = "read_only";

  if (has("hours:update")) grid.hours = "granted";
  else if (has("hours:read")) grid.hours = "read_only";

  if (has("volunteers:read") || has("volunteers:update")) grid.volunteers = "read_only";

  // Team & Governance capabilities
  if (has("chapters:write") || has("org_governance:write")) grid.org_governance = "granted";
  else if (has("chapters:read") || has("org_governance:read")) grid.org_governance = "read_only";

  if (has("members:write") || has("team:write")) grid.members = "granted";
  else if (has("members:read")) grid.members = "read_only";

  if (has("roles:write")) grid.roles = "granted";
  else if (has("roles:read")) grid.roles = "read_only";

  if (has("admin_action_log:read") || has("audit:read")) grid.audit = "read_only";

  if (has("inquiries:write")) grid.inquiries = "granted";
  else if (has("inquiries:read")) grid.inquiries = "read_only";

  // Backwards compatibility for legacy 'team' capability key
  if (has("team:write")) grid.team = "granted";

  return grid;
}

export function effectivePermissionTags(permissionKeyGroups: string[][]): string[] {
  const all = new Set(permissionKeyGroups.flat());
  const tags: string[] = [];
  if (all.has("opportunities:write")) tags.push("Create Drives");
  if (all.has("noticeboard:write")) tags.push("Publish Noticeboard");
  if (all.has("applications:update")) tags.push("Triage Apps");
  if (all.has("hours:update")) tags.push("Approve Hours");
  if (all.has("team:write") || all.has("members:write")) tags.push("Manage Team");
  if (all.has("inquiries:write") || all.has("inquiries:read")) tags.push("Partner Inquiries");
  if (!all.has("applications:update") && all.has("applications:read")) tags.push("View Apps (Read Only)");
  if (!all.has("hours:update") && all.has("hours:read")) tags.push("View Hours (Read Only)");
  return tags;
}

export function deriveRoleTitleFromPermissions(
  permissions: string[],
  isChapterScoped = false,
  chapterCount = 1,
): string | null {
  const grid = permissionKeysToGrid(permissions);
  const hasFullOps =
    grid.drive === "granted" &&
    grid.publish === "granted" &&
    grid.triage === "granted" &&
    grid.hours === "granted";

  const hasChapterGovernance = grid.org_governance === "granted";
  const hasTeamManagement = grid.team === "granted" || grid.members === "granted";

  if (hasFullOps && hasTeamManagement) {
    if (isChapterScoped) {
      return "Chapter Admin";
    }
    // Org-wide admin: distinguish Super Admin by broad platform permissions
    if (
      permissions.includes("volunteers:read") ||
      permissions.includes("admin_action_log:read") ||
      permissions.includes("roles:write") ||
      permissions.includes("export:read")
    ) {
      return "Super Admin";
    }
    return "Org Admin";
  }

  if (hasFullOps && hasChapterGovernance) {
    if (isChapterScoped && chapterCount > 1) return "City Lead";
    if (isChapterScoped) return "Chapter Lead";
    return "City Lead";
  }

  if (hasFullOps) {
    return isChapterScoped ? "Chapter Lead" : "City Lead";
  }

  if (grid.drive === "granted" && grid.triage === "granted" && grid.hours === "granted") {
    return isChapterScoped ? "Chapter Coordinator" : "Drive Coordinator";
  }

  if (grid.drive === "granted") {
    return isChapterScoped ? "Chapter Coordinator" : "Drive Coordinator";
  }

  if (grid.triage === "granted") {
    return "Application Reviewer";
  }

  if (grid.triage === "read_only" || grid.hours === "read_only") {
    return "Auditor";
  }

  return null;
}

export type ModuleAccessLevel = "full" | "limited" | "read_only" | "restricted";

export interface ServiceModuleConfig {
  key: string;
  title: string;
  description: string;
  capabilities: readonly CapabilityKey[];
}

export interface RoleModuleSummary {
  moduleKey: string;
  title: string;
  description: string;
  level: ModuleAccessLevel;
  grantedCount: number;
  readOnlyCount: number;
  restrictedCount: number;
  totalCount: number;
}

export const SERVICE_MODULES: readonly ServiceModuleConfig[] = [
  {
    key: "youth-republic",
    title: "Youth Republic",
    description: "Volunteer drives, public noticeboard, applicant screening, and shift hours logging.",
    capabilities: MODULE_CAPABILITIES["youth-republic"],
  },
  {
    key: "team-governance",
    title: "Team & Governance",
    description: "Chapter governance, team roster, roles configuration, partner inquiries, and audit logs.",
    capabilities: MODULE_CAPABILITIES["team-governance"],
  },
] as const;

export function getRoleModuleSummaries(
  gridOrKeys: CapabilityGrid | string[],
  modules: readonly ServiceModuleConfig[] = SERVICE_MODULES,
): RoleModuleSummary[] {
  const grid = Array.isArray(gridOrKeys)
    ? permissionKeysToGrid(gridOrKeys)
    : gridOrKeys;

  return modules.map((mod) => {
    let grantedCount = 0;
    let readOnlyCount = 0;
    let restrictedCount = 0;

    for (const cap of mod.capabilities) {
      const level = grid[cap] ?? "restricted";
      if (level === "granted") {
        grantedCount++;
      } else if (level === "read_only") {
        readOnlyCount++;
      } else {
        restrictedCount++;
      }
    }

    const totalCount = mod.capabilities.length;

    let level: ModuleAccessLevel;
    const grantableCaps = mod.capabilities.filter(
      (cap) => CAPABILITY_META[cap]?.levels?.includes("granted"),
    );

    const isAllGrantableGranted =
      grantableCaps.length > 0 &&
      grantableCaps.every((cap) => grid[cap] === "granted");

    const isStrictFull =
      restrictedCount === 0 &&
      totalCount > 0 &&
      mod.capabilities.every((cap) => {
        const meta = CAPABILITY_META[cap];
        const maxLevel = meta?.levels?.includes("granted") ? "granted" : "read_only";
        return grid[cap] === maxLevel;
      });

    if (totalCount === 0 || restrictedCount === totalCount) {
      level = "restricted";
    } else if (isAllGrantableGranted || isStrictFull) {
      level = "full";
    } else if (grantedCount === 0 && readOnlyCount > 0) {
      level = "read_only";
    } else {
      level = "limited";
    }

    return {
      moduleKey: mod.key,
      title: mod.title,
      description: mod.description,
      level,
      grantedCount,
      readOnlyCount,
      restrictedCount,
      totalCount,
    };
  });
}


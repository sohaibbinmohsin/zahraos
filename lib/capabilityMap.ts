export const MODULE_CAPABILITIES = {
  "youth-republic": ["drive", "publish", "triage", "hours", "volunteers"],
  "team-governance": ["org_governance", "members", "roles", "audit", "inquiries"],
} as const;

export type YouthRepublicCapability = typeof MODULE_CAPABILITIES["youth-republic"][number];
export type TeamGovernanceCapability = typeof MODULE_CAPABILITIES["team-governance"][number];
export type CapabilityKey = YouthRepublicCapability | TeamGovernanceCapability | "team";
export type CapabilityLevel = "granted" | "view" | "off";
export type CapabilityGrid = Record<CapabilityKey, CapabilityLevel>;

export const CAPABILITY_KEYS: CapabilityKey[] = [
  ...MODULE_CAPABILITIES["youth-republic"],
  ...MODULE_CAPABILITIES["team-governance"],
  "team",
];

export const CAPABILITY_META: Record<CapabilityKey, { column: string; levels: CapabilityLevel[] }> = {
  drive:          { column: "Drive Creation",       levels: ["granted", "view", "off"] },
  publish:        { column: "Publish Noticeboard",  levels: ["granted", "view", "off"] },
  triage:         { column: "Triage Apps",          levels: ["granted", "view", "off"] },
  hours:          { column: "Approve Hours",        levels: ["granted", "view", "off"] },
  volunteers:     { column: "Volunteer Directory",  levels: ["view", "off"] },
  org_governance: { column: "Org Governance",       levels: ["granted", "view", "off"] },
  members:        { column: "Team Members",         levels: ["granted", "view", "off"] },
  roles:          { column: "Roles & Permissions",  levels: ["granted", "view", "off"] },
  audit:          { column: "Audit Logs",           levels: ["view", "off"] },
  inquiries:      { column: "Partner Inquiries",    levels: ["granted", "view", "off"] },
  team:           { column: "Team Management",      levels: ["granted", "off"] },
};

export const OFF_GRID: CapabilityGrid = {
  drive: "off",
  publish: "off",
  triage: "off",
  hours: "off",
  volunteers: "off",
  org_governance: "off",
  members: "off",
  roles: "off",
  audit: "off",
  inquiries: "off",
  team: "off",
};

export function permissionKeysToGrid(keys: string[]): CapabilityGrid {
  const has = (k: string) => keys.includes(k);
  const grid = { ...OFF_GRID };

  // Youth Republic capabilities
  if (has("opportunities:write")) grid.drive = "granted";
  else if (has("opportunities:read")) grid.drive = "view";

  if (has("noticeboard:write")) grid.publish = "granted";
  else if (has("noticeboard:read")) grid.publish = "view";

  if (has("applications:update")) grid.triage = "granted";
  else if (has("applications:read")) grid.triage = "view";

  if (has("hours:update")) grid.hours = "granted";
  else if (has("hours:read")) grid.hours = "view";

  if (has("volunteers:read") || has("volunteers:update")) grid.volunteers = "view";

  // Team & Governance capabilities
  if (has("chapters:write") || has("org_governance:write")) grid.org_governance = "granted";
  else if (has("chapters:read") || has("org_governance:read")) grid.org_governance = "view";

  if (has("members:write") || has("team:write")) grid.members = "granted";
  else if (has("members:read")) grid.members = "view";

  if (has("roles:write")) grid.roles = "granted";
  else if (has("roles:read")) grid.roles = "view";

  if (has("admin_action_log:read") || has("audit:read")) grid.audit = "view";

  if (has("inquiries:write")) grid.inquiries = "granted";
  else if (has("inquiries:read")) grid.inquiries = "view";

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

  if (grid.triage === "view" || grid.hours === "view") {
    return "Auditor";
  }

  return null;
}

export type ModuleAccessLevel = "full" | "limited" | "view" | "off";

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
  offCount: number;
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
    let offCount = 0;

    for (const cap of mod.capabilities) {
      const level = grid[cap] ?? "off";
      if (level === "granted") {
        grantedCount++;
      } else if (level === "view") {
        readOnlyCount++;
      } else {
        offCount++;
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
      offCount === 0 &&
      totalCount > 0 &&
      mod.capabilities.every((cap) => {
        const meta = CAPABILITY_META[cap];
        const maxLevel = meta?.levels?.includes("granted") ? "granted" : "view";
        return grid[cap] === maxLevel;
      });

    if (totalCount === 0 || offCount === totalCount) {
      level = "off";
    } else if (isAllGrantableGranted || isStrictFull) {
      level = "full";
    } else if (grantedCount === 0 && readOnlyCount > 0) {
      level = "view";
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
      offCount,
      totalCount,
    };
  });
}


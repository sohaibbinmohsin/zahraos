import type { ModuleCatalog, ModuleRoleTemplate } from "./moduleCatalog";

export const platformCatalog: ModuleCatalog = {
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
  roleTemplates: [
    {
      name: "Super Admin",
      description: "Full platform control and unconstrained administrative privileges across all operational modules.",
      place: "none",
      switches: {
        org_governance: "manage",
        team_members: "manage",
        roles: "manage",
        audit: "view",
        inquiries: "manage",
      },
    },
    {
      name: "Org Admin",
      description: "Organization-wide administration with view-only access to sensitive governance areas.",
      place: "none",
      switches: {
        org_governance: "manage",
        team_members: "manage",
        roles: "view",
        audit: "view",
        inquiries: "view",
      },
    },
    {
      name: "Auditor",
      description: "Read-only visibility into audit logs and selected operational records.",
      place: "none",
      switches: {
        org_governance: "none",
        team_members: "none",
        roles: "none",
        audit: "view",
        inquiries: "none",
      },
    },
  ],
};

const PLATFORM_ROLE_BY_NAME: Record<string, ModuleRoleTemplate> = Object.fromEntries(
  platformCatalog.roleTemplates.map((role) => [role.name, role]),
);

export type PlatformRoleName = "Super Admin" | "Org Admin" | "Auditor";

export function platformRole(name: PlatformRoleName): ModuleRoleTemplate {
  const role = PLATFORM_ROLE_BY_NAME[name];
  if (!role) {
    throw new Error("unknown_platform_role");
  }
  return role;
}
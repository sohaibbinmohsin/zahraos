/**
 * The one landing rule for sign-in, `/`, the logo, and a Youth Republic URL
 * the person cannot open.
 *
 * Youth Republic sections come first, in sidebar order. Anyone who can open
 * one of those still lands on the dashboard, because dashboard access is the
 * combination of those section permissions. Governance follows the same
 * sidebar order. No match means there is no page to open.
 */
export interface LandingAccess {
  canAccessDashboard: boolean;
  canViewDrives: boolean;
  canViewApplications: boolean;
  canViewHours: boolean;
  canViewVolunteers: boolean;
  canViewOrganization: boolean;
  canViewInquiries: boolean;
  canManageTeam: boolean;
}

export interface LandingDestination {
  href: string;
  label: string;
}

const DESTINATIONS: { href: string; label: string; allow: (access: LandingAccess) => boolean }[] = [
  { href: "/youth-republic/dashboard", label: "Dashboard", allow: (a) => a.canAccessDashboard },
  { href: "/youth-republic/drives", label: "Drives", allow: (a) => a.canViewDrives },
  { href: "/youth-republic/applications", label: "Applications", allow: (a) => a.canViewApplications },
  { href: "/youth-republic/hours", label: "Hours", allow: (a) => a.canViewHours },
  { href: "/youth-republic/volunteers", label: "Volunteers", allow: (a) => a.canViewVolunteers },
  { href: "/team/organization", label: "Organization", allow: (a) => a.canViewOrganization },
  { href: "/team/organization/inquiries", label: "Partner Inquiries", allow: (a) => a.canViewInquiries },
  { href: "/team/members", label: "Team Members", allow: (a) => a.canManageTeam },
  { href: "/team/roles", label: "Roles", allow: (a) => a.canManageTeam },
  { href: "/team/audit", label: "Audit", allow: (a) => a.canManageTeam },
];

export function firstAllowedDestination(access: LandingAccess): LandingDestination | null {
  const match = DESTINATIONS.find((destination) => destination.allow(access));
  return match ? { href: match.href, label: match.label } : null;
}

/** Role titles the shell treats as an organization admin when the token tier is missing. */
export const ORG_ADMIN_ROLE_TITLES = ["super admin", "admin", "org admin", "organization admin"];

export function isNamedOrgAdmin(titles: string[]): boolean {
  return titles.some((title) => ORG_ADMIN_ROLE_TITLES.includes(title.toLowerCase()));
}

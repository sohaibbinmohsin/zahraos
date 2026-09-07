import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchStaffToken, decodeStaffTokenClaims, type StaffTokenClaims } from "./staffToken";
import { resolveOrgSwitcherOptions } from "./selectedOrg";

export interface OrgBrand {
  logoUrl: string | null;
  brandColor: string | null;
}

/**
 * Everything the app shell needs to paint itself: identity, claims, the org
 * switcher's options and each org's branding. Resolved on the server during
 * SSR so the first byte of HTML already has the real sidebar and header —
 * and re-resolved in the browser when the session changes.
 */
export interface ShellData {
  claims: StaffTokenClaims;
  staffToken: string;
  fullName: string | null;
  email: string | null;
  platformOwner: boolean;
  orgTiers: Record<string, string>;
  assignedRolesByOrg: Record<string, string[]>;
  availableOrgIds: string[];
  orgNames: Record<string, string>;
  orgBrands: Record<string, OrgBrand>;
}

export interface ShellSession {
  access_token: string;
  user?: { id?: string; email?: string | null } | null;
}

function indexOrgs(rows: Array<Record<string, unknown>> | null) {
  const names: Record<string, string> = {};
  const brands: Record<string, OrgBrand> = {};
  for (const org of rows ?? []) {
    const id = org.id as string;
    names[id] = org.name as string;
    brands[id] = {
      logoUrl: (org.logo_url as string) ?? null,
      brandColor: (org.brand_color as string) ?? null,
    };
  }
  return { names, brands };
}

/**
 * Mints the staff token, then fans out the four independent lookups in
 * parallel. Previously these ran as five sequential awaits in an effect,
 * which is what made the shell visibly blank on every reload.
 */
export async function loadShellData(
  supabase: SupabaseClient,
  session: ShellSession,
): Promise<ShellData> {
  const authUserId = session.user?.id;
  const userEmail = session.user?.email ?? null;

  const staffToken = await fetchStaffToken(session.access_token);
  const claims = decodeStaffTokenClaims(staffToken);

  // Platform owners see every org; everyone else sees the orgs on their
  // claims, so that list is known without another round-trip.
  const scopedOrgIds = claims.platformOwner
    ? null
    : resolveOrgSwitcherOptions(claims.orgRoles, claims.moduleAccess);

  const [staffResult, tierResult, assignmentResult, orgResult] = await Promise.all([
    supabase.from("staff").select("full_name, platform_owner, email").eq("auth_user_id", authUserId).single(),
    supabase.from("staff_org_roles").select("organization_id, org_tier").eq("staff_id", claims.staffId),
    supabase.from("staff_role_assignments").select("organization_id, roles(name)").eq("staff_id", claims.staffId),
    scopedOrgIds === null
      ? supabase.from("organizations").select("id, name, logo_url, brand_color")
      : scopedOrgIds.length > 0
        ? supabase.from("organizations").select("id, name, logo_url, brand_color").in("id", scopedOrgIds)
        : Promise.resolve({ data: [], error: null }),
  ]);

  if (staffResult.error) throw staffResult.error;
  if (tierResult.error) throw tierResult.error;
  if (orgResult.error) throw orgResult.error;

  const orgTiers: Record<string, string> = {};
  for (const row of tierResult.data ?? []) {
    orgTiers[row.organization_id as string] = row.org_tier as string;
  }

  // Role assignments are best-effort: a missing join must not blank the shell.
  const assignedRolesByOrg: Record<string, string[]> = {};
  if (!assignmentResult.error) {
    for (const a of (assignmentResult.data ?? []) as Array<Record<string, unknown>>) {
      const roles = a.roles as { name?: string } | Array<{ name?: string }> | null;
      const roleName = Array.isArray(roles) ? roles[0]?.name : roles?.name;
      const orgId = a.organization_id as string | undefined;
      if (!roleName || !orgId) continue;
      const list = assignedRolesByOrg[orgId] ?? [];
      if (!list.includes(roleName)) list.push(roleName);
      assignedRolesByOrg[orgId] = list;
    }
  }

  const { names, brands } = indexOrgs(orgResult.data as Array<Record<string, unknown>> | null);
  const availableOrgIds = scopedOrgIds ?? Object.keys(names);

  return {
    claims,
    staffToken,
    fullName: (staffResult.data?.full_name as string) ?? null,
    email: (staffResult.data?.email as string) ?? userEmail,
    platformOwner: claims.platformOwner,
    orgTiers,
    assignedRolesByOrg,
    availableOrgIds,
    orgNames: names,
    orgBrands: brands,
  };
}

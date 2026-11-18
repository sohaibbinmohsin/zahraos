import { SupabaseClient } from "@supabase/supabase-js";

// Every organization the target staff member is affiliated with, mapped to
// their org_tier there (null if the only affiliation is a module-role grant,
// not a staff_org_roles row). This is deliberately the union of both tables —
// a regular staff member created via createStaff (Task 13) but never granted
// an org_tier row is still "affiliated" with an org once they hold a module
// role in it, and must remain deactivatable by that org's admin.
export async function targetOrgAffiliations(
  supabase: SupabaseClient,
  targetStaffId: string,
): Promise<Map<string, string | null>> {
  const affiliations = new Map<string, string | null>();

  const { data: orgRoles } = await supabase
    .from("staff_org_roles")
    .select("organization_id, org_tier")
    .eq("staff_id", targetStaffId);
  for (const row of orgRoles ?? []) {
    affiliations.set(row.organization_id as string, row.org_tier as string);
  }

  const { data: moduleRoles } = await supabase
    .from("staff_role_assignments")
    .select("organization_id")
    .eq("staff_id", targetStaffId);
  for (const row of moduleRoles ?? []) {
    if (!affiliations.has(row.organization_id as string)) {
      affiliations.set(row.organization_id as string, null);
    }
  }

  return affiliations;
}

export async function callerMayDeactivate(
  supabase: SupabaseClient,
  callerStaffId: string,
  targetStaffId: string,
): Promise<boolean> {
  const { data: targetStaff } = await supabase
    .from("staff")
    .select("platform_owner")
    .eq("id", targetStaffId)
    .single();
  if (!targetStaff) throw new Error("not_found");
  // org_tier is a platform-internal concept unrelated to the platform_owner
  // flag (spec §3) — no amount of org authority reaches a platform-owner
  // account. Only another platform_owner (the callerPlatformOwner bypass
  // above) may deactivate one.
  if (targetStaff.platform_owner) {
    return false;
  }

  const targetAffiliations = await targetOrgAffiliations(supabase, targetStaffId);

  // Caller admin authority: staff_org_roles tiers plus Super Admin /
  // org-wide Org Admin assignments (same sources as is_org_admin_or_above).
  const callerAdminByOrg = new Map<string, "super_admin" | "admin">();

  const { data: callerOrgRoles } = await supabase
    .from("staff_org_roles")
    .select("organization_id, org_tier")
    .eq("staff_id", callerStaffId)
    .in("org_tier", ["admin", "super_admin"]);

  for (const callerRole of callerOrgRoles ?? []) {
    const organizationId = callerRole.organization_id as string;
    const tier = callerRole.org_tier as "super_admin" | "admin";
    if (tier === "super_admin" || !callerAdminByOrg.has(organizationId)) {
      callerAdminByOrg.set(organizationId, tier);
    }
  }

  const { data: callerAssignments } = await supabase
    .from("staff_role_assignments")
    .select("organization_id, scope_kind, roles(name)")
    .eq("staff_id", callerStaffId);

  for (const row of callerAssignments ?? []) {
    const roles = row.roles as { name?: string } | { name?: string }[] | null;
    const roleName = Array.isArray(roles) ? roles[0]?.name : roles?.name;
    const organizationId = row.organization_id as string;
    if (roleName === "Super Admin") {
      callerAdminByOrg.set(organizationId, "super_admin");
    } else if (
      roleName === "Org Admin" &&
      row.scope_kind === "org_wide" &&
      callerAdminByOrg.get(organizationId) !== "super_admin"
    ) {
      callerAdminByOrg.set(organizationId, "admin");
    }
  }

  for (const [organizationId, callerTier] of callerAdminByOrg) {
    // The caller's admin/super_admin authority in *some* org is never
    // sufficient on its own — the target must actually be affiliated with
    // that same org, or this is a cross-org authorization bypass.
    if (!targetAffiliations.has(organizationId)) continue;

    const targetTierHere = targetAffiliations.get(organizationId);
    const targetIsAdminOrAbove = targetTierHere === "admin" || targetTierHere === "super_admin";

    if (callerTier === "super_admin") return true;
    if (callerTier === "admin" && !targetIsAdminOrAbove) return true;
  }

  return false;
}

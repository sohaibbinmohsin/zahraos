import { SupabaseClient } from "@supabase/supabase-js";

/**
 * True when the caller is a platform owner, holds staff_org_roles admin/super_admin
 * for the org, or holds a Super Admin / org-wide Org Admin role assignment.
 * Mirrors mint-staff-token + is_org_admin_or_above (0019).
 */
export async function isCallerOrgAdminOrAbove(
  supabase: SupabaseClient,
  callerStaffId: string,
  callerPlatformOwner: boolean,
  organizationId: string,
): Promise<boolean> {
  if (callerPlatformOwner) return true;

  const { data: orgRole } = await supabase
    .from("staff_org_roles")
    .select("org_tier")
    .eq("staff_id", callerStaffId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (orgRole && ["admin", "super_admin"].includes(orgRole.org_tier as string)) {
    return true;
  }

  const { data: assignments } = await supabase
    .from("staff_role_assignments")
    .select("role_id, scope_kind, roles(name)")
    .eq("staff_id", callerStaffId)
    .eq("organization_id", organizationId);

  for (const row of assignments ?? []) {
    const roles = row.roles as { name?: string } | { name?: string }[] | null;
    const roleName = Array.isArray(roles) ? roles[0]?.name : roles?.name;
    if (
      roleName === "Super Admin" ||
      (roleName === "Org Admin" && row.scope_kind === "org_wide")
    ) {
      return true;
    }
  }

  return false;
}

export async function assertCallerIsOrgAdminOrAbove(
  supabase: SupabaseClient,
  callerStaffId: string,
  callerPlatformOwner: boolean,
  organizationId: string,
): Promise<void> {
  const ok = await isCallerOrgAdminOrAbove(
    supabase,
    callerStaffId,
    callerPlatformOwner,
    organizationId,
  );
  if (!ok) throw new Error("forbidden");
}

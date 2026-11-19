import type { SupabaseClient } from "@supabase/supabase-js";

/** Whether the staff member may access org-scoped team APIs (matches list-chapters). */
export async function callerBelongsToOrganization(
  supabaseAdmin: SupabaseClient,
  staffId: string,
  organizationId: string,
  platformOwner: boolean,
): Promise<boolean> {
  if (platformOwner) {
    return true;
  }

  const { data: orgRole } = await supabaseAdmin
    .from("staff_org_roles")
    .select("org_tier")
    .eq("staff_id", staffId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (orgRole && ["admin", "super_admin"].includes(orgRole.org_tier)) {
    return true;
  }

  const { data: assignments } = await supabaseAdmin
    .from("staff_role_assignments")
    .select("id")
    .eq("staff_id", staffId)
    .eq("organization_id", organizationId)
    .limit(1);

  return Boolean(assignments && assignments.length > 0);
}
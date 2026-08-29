import { SupabaseClient } from "@supabase/supabase-js";

export interface AssignStaffOrgRoleInput {
  staffId: string;
  organizationId: string;
  orgTier: "admin" | "super_admin";
}

const VALID_ORG_TIERS = ["admin", "super_admin"];

export async function assignStaffOrgRole(
  supabase: SupabaseClient,
  callerStaffId: string,
  callerPlatformOwner: boolean,
  input: AssignStaffOrgRoleInput,
): Promise<{ staffId: string }> {
  if (!VALID_ORG_TIERS.includes(input.orgTier)) {
    throw new Error("invalid_org_tier");
  }

  if (!callerPlatformOwner) {
    // Granting org-level authority is reserved for super_admin/platform_owner
    // — a plain admin manages module-level access only (same tiering
    // deactivateStaff and assignStaffModuleRole already draw the line at,
    // except assignStaffModuleRole allows admin too since a module role is
    // strictly less powerful than org_tier itself). Allowing "admin" to grant
    // org_tier would let it hand out super_admin and escalate past its own
    // authority.
    const { data: callerRole } = await supabase
      .from("staff_org_roles")
      .select("org_tier")
      .eq("staff_id", callerStaffId)
      .eq("organization_id", input.organizationId)
      .single();
    if (!callerRole || callerRole.org_tier !== "super_admin") {
      throw new Error("forbidden");
    }
  }

  const { error } = await supabase
    .from("staff_org_roles")
    .upsert({ staff_id: input.staffId, organization_id: input.organizationId, org_tier: input.orgTier });
  if (error) throw error;

  return { staffId: input.staffId };
}

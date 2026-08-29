import { SupabaseClient } from "@supabase/supabase-js";

export interface AssignStaffModuleRoleInput {
  staffId: string;
  organizationId: string;
  moduleId: string;
  roleId: string;
}

export async function assignStaffModuleRole(
  supabase: SupabaseClient,
  callerStaffId: string,
  callerPlatformOwner: boolean,
  input: AssignStaffModuleRoleInput,
): Promise<{ staffId: string }> {
  if (!callerPlatformOwner) {
    const { data: callerRole } = await supabase
      .from("staff_org_roles")
      .select("org_tier")
      .eq("staff_id", callerStaffId)
      .eq("organization_id", input.organizationId)
      .single();
    if (!callerRole || !["admin", "super_admin"].includes(callerRole.org_tier)) {
      throw new Error("forbidden");
    }
  }

  const { data: orgModule } = await supabase
    .from("org_modules")
    .select("module_id")
    .eq("organization_id", input.organizationId)
    .eq("module_id", input.moduleId)
    .single();
  if (!orgModule) throw new Error("module_not_enabled");

  const { error } = await supabase
    .from("staff_module_roles")
    .upsert({
      staff_id: input.staffId,
      organization_id: input.organizationId,
      module_id: input.moduleId,
      role_id: input.roleId,
    });
  if (error) throw error;

  return { staffId: input.staffId };
}

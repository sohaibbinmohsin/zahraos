import { SupabaseClient } from "@supabase/supabase-js";

export interface CreateCustomRoleInput {
  organizationId: string;
  moduleId: string;
  name: string;
  permissionIds: string[];
}

export async function createCustomRole(
  supabase: SupabaseClient,
  callerStaffId: string,
  callerPlatformOwner: boolean,
  input: CreateCustomRoleInput,
): Promise<{ roleId: string }> {
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
    .maybeSingle();
  if (!orgModule) {
    throw new Error("module_not_enabled");
  }

  const { data: validPermissions } = await supabase
    .from("permissions")
    .select("id")
    .eq("module_id", input.moduleId)
    .in("id", input.permissionIds);

  if ((validPermissions ?? []).length !== input.permissionIds.length) {
    throw new Error("permission_not_available");
  }

  const { data: role, error: roleError } = await supabase
    .from("roles")
    .insert({ organization_id: input.organizationId, module_id: input.moduleId, name: input.name, is_system: false })
    .select("id")
    .single();
  if (roleError) throw roleError;

  const { error: rolePermsError } = await supabase
    .from("role_permissions")
    .insert(input.permissionIds.map((permissionId) => ({ role_id: role.id, permission_id: permissionId })));
  if (rolePermsError) throw rolePermsError;

  return { roleId: role.id };
}

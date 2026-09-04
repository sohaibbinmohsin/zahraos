import { SupabaseClient } from "@supabase/supabase-js";
import { type CapabilityGrid, gridToPermissionKeys } from "../_shared/capabilityMap.ts";
import { actorName, writeAuditLog } from "../_shared/auditLog.ts";

export interface UpdateCustomRoleInput {
  roleId: string;
  name: string;
  description: string;
  capabilities: CapabilityGrid;
}

export async function updateCustomRole(
  supabase: SupabaseClient,
  callerStaffId: string,
  callerPlatformOwner: boolean,
  input: UpdateCustomRoleInput,
): Promise<{ roleId: string }> {
  const { data: role } = await supabase.from("roles")
    .select("id, organization_id, module_id, is_system").eq("id", input.roleId).single();
  if (!role) throw new Error("not_found");
  if (role.is_system) throw new Error("system_role_immutable");

  if (!callerPlatformOwner) {
    const { data } = await supabase.from("staff_org_roles").select("org_tier")
      .eq("staff_id", callerStaffId).eq("organization_id", role.organization_id).single();
    if (!data || !["admin", "super_admin"].includes(data.org_tier)) throw new Error("forbidden");
  }
  if (!input.name?.trim()) throw new Error("missing_name");

  const keys = gridToPermissionKeys(input.capabilities);
  const { data: perms } = await supabase.from("permissions").select("id, resource, action")
    .eq("module_id", role.module_id);
  const byKey = new Map((perms ?? []).map((p) => [`${p.resource}:${p.action}`, p.id as string]));
  const permissionIds = keys.map((k) => byKey.get(k));
  if (permissionIds.some((id) => !id)) throw new Error("permission_not_available");

  await supabase.from("roles").update({
    name: input.name.trim(), description: input.description || null,
  }).eq("id", input.roleId);

  await supabase.from("role_permissions").delete().eq("role_id", input.roleId);
  if (permissionIds.length > 0) {
    const { error } = await supabase.from("role_permissions")
      .insert((permissionIds as string[]).map((permission_id) => ({ role_id: input.roleId, permission_id })));
    if (error) throw error;
  }

  await writeAuditLog(supabase, {
    organizationId: role.organization_id,
    actorStaffId: callerStaffId,
    actorName: await actorName(supabase, callerStaffId),
    action: "Role Modified",
    entityType: "role",
    entityId: input.roleId,
    summary: `Updated custom role permissions for '${input.name.trim()}'`,
  });

  return { roleId: input.roleId };
}

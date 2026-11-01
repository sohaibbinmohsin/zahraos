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
    let isAuthorized = false;
    const { data: orgRole } = await supabase.from("staff_org_roles").select("org_tier")
      .eq("staff_id", callerStaffId).eq("organization_id", role.organization_id).maybeSingle();
    if (orgRole && orgRole.org_tier === "super_admin") {
      isAuthorized = true;
    } else {
      const { data: assignments } = await supabase
        .from("staff_role_assignments")
        .select("role_id, scope_kind")
        .eq("staff_id", callerStaffId)
        .eq("organization_id", role.organization_id);

      if (assignments && assignments.length > 0) {
        const roleIds = [...new Set(assignments.map((a) => a.role_id))];
        const { data: roles } = await supabase
          .from("roles")
          .select("id, name, role_permissions(permissions(resource, action))")
          .in("id", roleIds);

        for (const r of roles ?? []) {
          if (r.name === "Super Admin") {
            isAuthorized = true;
            break;
          }
          const hasRoleWrite = (r.role_permissions ?? []).some(
            (rp: any) => rp.permissions?.resource === "roles" && rp.permissions?.action === "write",
          );
          if (hasRoleWrite) {
            isAuthorized = true;
            break;
          }
        }
      }
    }
    if (!isAuthorized) throw new Error("forbidden");
  }
  if (!input.name?.trim()) throw new Error("missing_name");

  const keys = gridToPermissionKeys(input.capabilities);
  const { data: perms } = await supabase.from("permissions").select("id, resource, action")
    .eq("module_id", role.module_id);
  const byKey = new Map((perms ?? []).map((p) => [`${p.resource}:${p.action}`, p.id as string]));
  const permissionIds = keys.map((k) => byKey.get(k));
  if (permissionIds.some((id) => !id)) throw new Error("permission_not_available");

  const { error: updateError } = await supabase.from("roles").update({
    name: input.name.trim(), description: input.description || null,
  }).eq("id", input.roleId);
  if (updateError) {
    if (updateError.code === "23505") throw new Error("role_name_taken");
    throw updateError;
  }

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

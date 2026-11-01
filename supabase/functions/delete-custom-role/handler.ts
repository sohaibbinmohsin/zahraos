import { SupabaseClient } from "@supabase/supabase-js";
import { actorName, writeAuditLog } from "../_shared/auditLog.ts";

export interface DeleteCustomRoleInput {
  roleId: string;
}

export async function deleteCustomRole(
  supabase: SupabaseClient,
  callerStaffId: string,
  callerPlatformOwner: boolean,
  input: DeleteCustomRoleInput,
): Promise<{ roleId: string }> {
  const { data: role } = await supabase.from("roles")
    .select("id, organization_id, name, is_system").eq("id", input.roleId).single();
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

  const { count } = await supabase.from("staff_role_assignments")
    .select("*", { count: "exact", head: true }).eq("role_id", input.roleId);
  if ((count ?? 0) > 0) throw new Error("role_in_use");

  await supabase.from("role_permissions").delete().eq("role_id", input.roleId);
  await supabase.from("roles").delete().eq("id", input.roleId);

  await writeAuditLog(supabase, {
    organizationId: role.organization_id,
    actorStaffId: callerStaffId,
    actorName: await actorName(supabase, callerStaffId),
    action: "Role Modified",
    entityType: "role",
    entityId: input.roleId,
    summary: `Deleted custom role '${role.name}'`,
  });

  return { roleId: input.roleId };
}

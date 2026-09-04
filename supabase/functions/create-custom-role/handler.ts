import { SupabaseClient } from "@supabase/supabase-js";
import { type CapabilityGrid, gridToPermissionKeys } from "../_shared/capabilityMap.ts";
import { actorName, writeAuditLog } from "../_shared/auditLog.ts";

export interface CreateCustomRoleInput {
  organizationId: string;
  moduleId: string;
  name: string;
  description: string;
  capabilities: CapabilityGrid;
}

async function assertCallerIsOrgAdmin(
  supabase: SupabaseClient, callerStaffId: string, callerPlatformOwner: boolean, organizationId: string,
): Promise<void> {
  if (callerPlatformOwner) return;
  const { data } = await supabase.from("staff_org_roles").select("org_tier")
    .eq("staff_id", callerStaffId).eq("organization_id", organizationId).single();
  if (!data || !["admin", "super_admin"].includes(data.org_tier)) throw new Error("forbidden");
}

async function permissionIdsForKeys(
  supabase: SupabaseClient, moduleId: string, keys: string[],
): Promise<string[]> {
  if (keys.length === 0) return [];
  const { data } = await supabase.from("permissions").select("id, resource, action").eq("module_id", moduleId);
  const byKey = new Map((data ?? []).map((p) => [`${p.resource}:${p.action}`, p.id as string]));
  const ids = keys.map((k) => byKey.get(k));
  if (ids.some((id) => !id)) throw new Error("permission_not_available");
  return ids as string[];
}

export async function createCustomRole(
  supabase: SupabaseClient,
  callerStaffId: string,
  callerPlatformOwner: boolean,
  input: CreateCustomRoleInput,
): Promise<{ roleId: string }> {
  await assertCallerIsOrgAdmin(supabase, callerStaffId, callerPlatformOwner, input.organizationId);
  if (!input.name?.trim()) throw new Error("missing_name");

  const { data: orgModule } = await supabase.from("org_modules").select("module_id")
    .eq("organization_id", input.organizationId).eq("module_id", input.moduleId).maybeSingle();
  if (!orgModule) throw new Error("module_not_enabled");

  const permissionIds = await permissionIdsForKeys(
    supabase, input.moduleId, gridToPermissionKeys(input.capabilities),
  );

  const { data: role, error: roleError } = await supabase.from("roles")
    .insert({
      organization_id: input.organizationId, module_id: input.moduleId,
      name: input.name.trim(), description: input.description || null, is_system: false,
    })
    .select("id").single();
  if (roleError) throw roleError;

  if (permissionIds.length > 0) {
    const { error } = await supabase.from("role_permissions")
      .insert(permissionIds.map((permission_id) => ({ role_id: role.id, permission_id })));
    if (error) throw error;
  }

  await writeAuditLog(supabase, {
    organizationId: input.organizationId,
    actorStaffId: callerStaffId,
    actorName: await actorName(supabase, callerStaffId),
    action: "Role Created",
    entityType: "role",
    entityId: role.id,
    summary: `Created custom role '${input.name.trim()}'`,
  });

  return { roleId: role.id };
}

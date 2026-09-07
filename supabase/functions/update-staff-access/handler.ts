import { SupabaseClient } from "@supabase/supabase-js";
import { actorName, writeAuditLog } from "../_shared/auditLog.ts";
import { callerMayDeactivate } from "../_shared/staffAuthz.ts";
import type { RoleAssignmentInput } from "../invite-staff-member/handler.ts";

export interface UpdateStaffAccessInput {
  staffId: string;
  organizationId: string;
  roles: RoleAssignmentInput[];
  status: "active" | "invited" | "deactivated";
  expiresAt?: string | null;
}

export async function updateStaffAccess(
  supabase: SupabaseClient,
  callerStaffId: string,
  callerPlatformOwner: boolean,
  input: UpdateStaffAccessInput,
): Promise<{ staffId: string }> {
  if (callerStaffId === input.staffId) throw new Error("forbidden");
  if (!callerPlatformOwner) {
    const authorized = await callerMayDeactivate(supabase, callerStaffId, input.staffId);
    if (!authorized) throw new Error("forbidden");
  }
  if (!input.roles?.length) throw new Error("no_roles");

  const { data: mod } = await supabase.from("modules").select("id").eq("key", "youth-republic").single();
  const modId = mod!.id as string;

  const roleIds = [...new Set(input.roles.map((r) => r.roleId))];
  const { data: validRoles } = await supabase.from("roles").select("id")
    .eq("organization_id", input.organizationId).eq("module_id", modId).in("id", roleIds);
  if ((validRoles ?? []).length !== roleIds.length) throw new Error("role_not_available");

  await supabase.from("staff_role_assignments").delete()
    .eq("staff_id", input.staffId).eq("organization_id", input.organizationId).eq("module_id", modId);

  const { error: insertError } = await supabase.from("staff_role_assignments").insert(
    input.roles.map((r) => ({
      staff_id: input.staffId, organization_id: input.organizationId, module_id: modId, role_id: r.roleId,
      scope_kind: r.scopeKind, chapter_id: r.scopeKind === "chapter" ? r.chapterId : null,
      scope_label: r.scopeLabel, created_by: callerStaffId,
    })),
  );
  if (insertError) throw insertError;

  const { error: statusError } = await supabase.from("staff")
    .update({ status: input.status, expires_at: input.expiresAt ?? null }).eq("id", input.staffId);
  if (statusError) throw statusError;

  const { data: target } = await supabase.from("staff").select("full_name").eq("id", input.staffId).single();
  await writeAuditLog(supabase, {
    organizationId: input.organizationId,
    actorStaffId: callerStaffId,
    actorName: await actorName(supabase, callerStaffId),
    action: "Access Changed",
    entityType: "staff",
    entityId: input.staffId,
    summary: `Updated access for ${target?.full_name ?? "member"} — ${input.roles.length} role assignment(s), status ${input.status}`,
    scopeLabel: input.roles.map((r) => r.scopeLabel).join(", "),
  });

  return { staffId: input.staffId };
}

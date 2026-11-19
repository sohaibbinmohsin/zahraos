import { SupabaseClient } from "@supabase/supabase-js";
import { actorName, writeAuditLog } from "../_shared/auditLog.ts";
import { assertCallerIsOrgAdminOrAbove } from "../_shared/orgAdminAuthz.ts";
import { temporaryPassword } from "../_shared/temporaryPassword.ts";

export interface IssueStaffTemporaryPasswordInput {
  staffId: string;
  organizationId: string;
}

export async function issueStaffTemporaryPassword(
  supabase: SupabaseClient,
  callerStaffId: string,
  callerPlatformOwner: boolean,
  input: IssueStaffTemporaryPasswordInput,
): Promise<{ staffId: string; temporaryPassword: string }> {
  if (!input.staffId || !input.organizationId) throw new Error("missing_fields");
  if (callerStaffId === input.staffId) throw new Error("forbidden");

  await assertCallerIsOrgAdminOrAbove(
    supabase,
    callerStaffId,
    callerPlatformOwner,
    input.organizationId,
  );

  const { data: staff, error: staffError } = await supabase
    .from("staff")
    .select("id, full_name, status, auth_user_id, platform_owner")
    .eq("id", input.staffId)
    .single();
  if (staffError || !staff) throw new Error("not_found");
  if (staff.platform_owner && !callerPlatformOwner) throw new Error("forbidden");
  if (staff.status === "deactivated") throw new Error("member_deactivated");
  if (!staff.auth_user_id) throw new Error("member_has_no_sign_in");

  const { data: assignment } = await supabase
    .from("staff_role_assignments")
    .select("id")
    .eq("staff_id", input.staffId)
    .eq("organization_id", input.organizationId)
    .limit(1);
  if (!(assignment ?? []).length) {
    const { data: orgRole } = await supabase
      .from("staff_org_roles")
      .select("staff_id")
      .eq("staff_id", input.staffId)
      .eq("organization_id", input.organizationId)
      .maybeSingle();
    if (!orgRole) throw new Error("forbidden");
  }

  const password = temporaryPassword();
  const { error: authError } = await supabase.auth.admin.updateUserById(
    staff.auth_user_id as string,
    { password },
  );
  if (authError) throw authError;

  const { error: flagError } = await supabase
    .from("staff")
    .update({ must_change_password: true })
    .eq("id", input.staffId);
  if (flagError) throw flagError;

  await writeAuditLog(supabase, {
    organizationId: input.organizationId,
    actorStaffId: callerStaffId,
    actorName: await actorName(supabase, callerStaffId),
    action: "Temporary Password Issued",
    entityType: "staff",
    entityId: input.staffId,
    summary: `Issued a new temporary password for ${staff.full_name}`,
  });

  return { staffId: input.staffId, temporaryPassword: password };
}

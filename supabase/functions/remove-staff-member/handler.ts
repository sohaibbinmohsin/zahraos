import { SupabaseClient } from "@supabase/supabase-js";
import { actorName, writeAuditLog } from "../_shared/auditLog.ts";
import { prepareEmailForNewStaffAccount } from "../_shared/staffIdentity.ts";
import { callerMayDeactivate } from "../_shared/staffAuthz.ts";

export interface RemoveStaffMemberInput {
  staffId: string;
  organizationId: string;
}

export async function removeStaffMember(
  supabase: SupabaseClient,
  callerStaffId: string,
  callerPlatformOwner: boolean,
  input: RemoveStaffMemberInput,
): Promise<{ staffId: string }> {
  if (callerStaffId === input.staffId) throw new Error("forbidden");
  if (!callerPlatformOwner) {
    if (!(await callerMayDeactivate(supabase, callerStaffId, input.staffId))) throw new Error("forbidden");
  }

  const { data: target } = await supabase.from("staff")
    .select("full_name, platform_owner, auth_user_id, email")
    .eq("id", input.staffId).single();
  if (!target) throw new Error("not_found");
  if (target.platform_owner) throw new Error("forbidden");

  await supabase.from("staff_role_assignments").delete()
    .eq("staff_id", input.staffId).eq("organization_id", input.organizationId);
  const { error: deactivateError } = await supabase.from("staff")
    .update({ status: "deactivated", deactivated_at: new Date().toISOString() })
    .eq("id", input.staffId);
  if (deactivateError) throw deactivateError;

  // The staff row stays, with its email, for the audit history. Release the
  // Supabase Auth user so the same address can be added again as a new account.
  // If that fails, ban the old login so access is still revoked.
  const authUserId = target.auth_user_id as string | null;
  try {
    await prepareEmailForNewStaffAccount(supabase, target.email as string);
  } catch (err) {
    if (authUserId) {
      const { error: banError } = await supabase.auth.admin.updateUserById(
        authUserId,
        { ban_duration: "876000h" },
      );
      if (banError) {
        console.error(
          `removeStaffMember: staff ${input.staffId} was removed but revoking their Supabase Auth session failed`,
          banError,
        );
      }
    }
    console.error(
      `removeStaffMember: staff ${input.staffId} was removed but releasing their sign-in email failed`,
      err,
    );
  }

  await writeAuditLog(supabase, {
    organizationId: input.organizationId,
    actorStaffId: callerStaffId,
    actorName: await actorName(supabase, callerStaffId),
    action: "Member Removed",
    entityType: "staff",
    entityId: input.staffId,
    summary: `Removed ${target.full_name} from the team`,
  });

  return { staffId: input.staffId };
}

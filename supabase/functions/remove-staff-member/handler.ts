import { SupabaseClient } from "@supabase/supabase-js";
import { actorName, writeAuditLog } from "../_shared/auditLog.ts";

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
    const { data } = await supabase.from("staff_org_roles").select("org_tier")
      .eq("staff_id", callerStaffId).eq("organization_id", input.organizationId).single();
    if (!data || !["admin", "super_admin"].includes(data.org_tier)) throw new Error("forbidden");
  }

  const { data: target } = await supabase.from("staff").select("full_name, platform_owner")
    .eq("id", input.staffId).single();
  if (!target) throw new Error("not_found");
  if (target.platform_owner) throw new Error("forbidden");

  await supabase.from("staff_role_assignments").delete()
    .eq("staff_id", input.staffId).eq("organization_id", input.organizationId);
  await supabase.from("staff").update({ status: "deactivated", deactivated_at: new Date().toISOString() })
    .eq("id", input.staffId);

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

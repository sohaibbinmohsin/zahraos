import { SupabaseClient } from "@supabase/supabase-js";
import { actorName, writeAuditLog } from "../_shared/auditLog.ts";

export interface RoleAssignmentInput {
  roleId: string;
  scopeKind: "org_wide" | "chapter";
  chapterId?: string | null;
  scopeLabel: string;
}

export interface InviteStaffMemberInput {
  organizationId: string;
  fullName: string;
  email: string;
  phone?: string;
  roles: RoleAssignmentInput[];
  sendActivationEmail: boolean;
  enforce2fa: boolean;
}

async function assertCallerIsOrgAdmin(
  supabase: SupabaseClient, callerStaffId: string, callerPlatformOwner: boolean, organizationId: string,
): Promise<void> {
  if (callerPlatformOwner) return;
  const { data } = await supabase.from("staff_org_roles").select("org_tier")
    .eq("staff_id", callerStaffId).eq("organization_id", organizationId).single();
  if (!data || !["admin", "super_admin"].includes(data.org_tier)) throw new Error("forbidden");
}

function randomPassword(): string {
  return crypto.randomUUID().replace(/-/g, "") + "A1!";
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function inviteStaffMember(
  supabase: SupabaseClient,
  callerStaffId: string,
  callerPlatformOwner: boolean,
  input: InviteStaffMemberInput,
): Promise<{ staffId: string; invitationId: string }> {
  await assertCallerIsOrgAdmin(supabase, callerStaffId, callerPlatformOwner, input.organizationId);

  if (!input.fullName?.trim() || !input.email?.trim()) throw new Error("missing_fields");
  if (!input.roles?.length) throw new Error("no_roles");

  const { data: orgModule } = await supabase.from("org_modules")
    .select("module_id").eq("organization_id", input.organizationId)
    .eq("module_id", (await moduleId(supabase))).maybeSingle();
  if (!orgModule) throw new Error("module_not_enabled");
  const modId = orgModule.module_id as string;

  const roleIds = [...new Set(input.roles.map((r) => r.roleId))];
  const { data: validRoles } = await supabase.from("roles").select("id")
    .eq("organization_id", input.organizationId).eq("module_id", modId).in("id", roleIds);
  if ((validRoles ?? []).length !== roleIds.length) throw new Error("role_not_available");

  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: input.email, password: randomPassword(), email_confirm: true,
  });
  if (authError || !authUser.user) throw authError ?? new Error("failed_to_create_auth_user");

  const { data: staff, error: staffError } = await supabase.from("staff").insert({
    auth_user_id: authUser.user.id, full_name: input.fullName, email: input.email,
    status: "invited", must_change_password: true,
  }).select("id").single();
  if (staffError) throw staffError;

  const { error: assignError } = await supabase.from("staff_role_assignments").insert(
    input.roles.map((r) => ({
      staff_id: staff.id, organization_id: input.organizationId, module_id: modId, role_id: r.roleId,
      scope_kind: r.scopeKind, chapter_id: r.scopeKind === "chapter" ? r.chapterId : null,
      scope_label: r.scopeLabel, created_by: callerStaffId,
    })),
  );
  if (assignError) throw assignError;

  const token = crypto.randomUUID();
  const { data: invite, error: inviteError } = await supabase.from("staff_invitations").insert({
    organization_id: input.organizationId, staff_id: staff.id, email: input.email,
    full_name: input.fullName, phone: input.phone ?? null, enforce_2fa: input.enforce2fa,
    send_activation_email: input.sendActivationEmail, token_hash: await sha256Hex(token),
    invited_by: callerStaffId,
  }).select("id").single();
  if (inviteError) throw inviteError;

  if (input.sendActivationEmail) {
    // Phase 1 stub: platform has no email infra. The activation-email/accept
    // flow is a follow-up (spec §1 out-of-scope). Log the link so it is
    // usable in dev.
    console.log(`[invite-staff-member] activation link for ${input.email}: /set-password?invite=${token}`);
  }

  await writeAuditLog(supabase, {
    organizationId: input.organizationId,
    actorStaffId: callerStaffId,
    actorName: await actorName(supabase, callerStaffId),
    action: "Member Invited",
    entityType: "staff",
    entityId: staff.id,
    summary: `Invited ${input.fullName} (${input.roles.map((r) => `${r.scopeLabel}`).join(", ")})`,
    scopeLabel: input.roles.map((r) => r.scopeLabel).join(", "),
  });

  return { staffId: staff.id, invitationId: invite.id };
}

async function moduleId(supabase: SupabaseClient): Promise<string> {
  const { data } = await supabase.from("modules").select("id").eq("key", "youth-republic").single();
  return data!.id as string;
}

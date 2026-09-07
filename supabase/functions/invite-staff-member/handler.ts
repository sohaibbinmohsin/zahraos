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
  expiresAt?: string | null;
  /** @deprecated no email/2FA flow — accepted for backward compatibility, ignored. */
  sendActivationEmail?: boolean;
  /** @deprecated ignored. */
  enforce2fa?: boolean;
}

async function assertCallerIsOrgAdmin(
  supabase: SupabaseClient, callerStaffId: string, callerPlatformOwner: boolean, organizationId: string,
): Promise<void> {
  if (callerPlatformOwner) return;
  const { data } = await supabase.from("staff_org_roles").select("org_tier")
    .eq("staff_id", callerStaffId).eq("organization_id", organizationId).single();
  if (!data || !["admin", "super_admin"].includes(data.org_tier)) throw new Error("forbidden");
}

// A short, readable one-time password the admin hands to the new member.
// Meets Supabase complexity (lower + upper + digit + symbol, >= 8 chars); the
// member is forced to replace it on first login (staff.must_change_password).
function temporaryPassword(): string {
  const lower = "abcdefghijkmnpqrstuvwxyz"; // no l/o
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I/O
  const digits = "23456789"; // no 0/1
  const pick = (set: string, n: number) =>
    Array.from({ length: n }, () => set[Math.floor(Math.random() * set.length)]).join("");
  return `Rizq-${pick(upper, 1)}${pick(lower, 3)}-${pick(digits, 4)}!`;
}

export async function inviteStaffMember(
  supabase: SupabaseClient,
  callerStaffId: string,
  callerPlatformOwner: boolean,
  input: InviteStaffMemberInput,
): Promise<{ staffId: string; invitationId: string; temporaryPassword: string }> {
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

  const tempPassword = temporaryPassword();
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: input.email, password: tempPassword, email_confirm: true,
  });
  if (authError || !authUser.user) throw authError ?? new Error("failed_to_create_auth_user");

  // Active straight away — the member signs in with the temporary password and
  // is forced to set their own on first login (must_change_password → the
  // /set-password redirect in middleware).
  const { data: staff, error: staffError } = await supabase.from("staff").insert({
    auth_user_id: authUser.user.id, full_name: input.fullName, email: input.email,
    status: "active", must_change_password: true, expires_at: input.expiresAt ?? null,
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

  // Kept as an audit trail of who added whom. No email/token flow any more.
  const { data: invite, error: inviteError } = await supabase.from("staff_invitations").insert({
    organization_id: input.organizationId, staff_id: staff.id, email: input.email,
    full_name: input.fullName, phone: input.phone ?? null, enforce_2fa: false,
    send_activation_email: false, token_hash: null, invited_by: callerStaffId,
    status: "accepted", accepted_at: new Date().toISOString(),
  }).select("id").single();
  if (inviteError) throw inviteError;

  await writeAuditLog(supabase, {
    organizationId: input.organizationId,
    actorStaffId: callerStaffId,
    actorName: await actorName(supabase, callerStaffId),
    action: "Member Added",
    entityType: "staff",
    entityId: staff.id,
    summary: `Added ${input.fullName} (${input.roles.map((r) => `${r.scopeLabel}`).join(", ")})`,
    scopeLabel: input.roles.map((r) => r.scopeLabel).join(", "),
  });

  return { staffId: staff.id, invitationId: invite.id, temporaryPassword: tempPassword };
}

async function moduleId(supabase: SupabaseClient): Promise<string> {
  const { data } = await supabase.from("modules").select("id").eq("key", "youth-republic").single();
  return data!.id as string;
}

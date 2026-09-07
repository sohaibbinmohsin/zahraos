import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { inviteStaffMember } from "./handler.ts";

function testClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

async function setup() {
  const supabase = testClient();
  const { data: org } = await supabase.from("organizations").insert({
    name: "Invite Test Org", slug: `invite-${crypto.randomUUID()}`,
  }).select("id").single();
  const { data: mod } = await supabase.from("modules").select("id").eq("key", "youth-republic").single();
  await supabase.from("org_modules").insert({ organization_id: org!.id, module_id: mod!.id });
  await supabase.rpc("seed_youth_republic_system_roles", { p_org_id: org!.id, p_module_id: mod!.id });
  const { data: role } = await supabase.from("roles").select("id")
    .eq("organization_id", org!.id).eq("name", "Operations Lead").single();

  const adminEmail = `invite-admin-${crypto.randomUUID()}@example.com`;
  const { data: adminAuth } = await supabase.auth.admin.createUser({ email: adminEmail, email_confirm: true });
  const { data: admin } = await supabase.from("staff").insert({
    auth_user_id: adminAuth!.user!.id, full_name: "Inviter Admin", email: adminEmail,
  }).select("id").single();
  await supabase.from("staff_org_roles").insert({ staff_id: admin!.id, organization_id: org!.id, org_tier: "admin" });

  return { supabase, orgId: org!.id as string, moduleId: mod!.id as string, roleId: role!.id as string, adminId: admin!.id as string };
}

Deno.test("inviteStaffMember creates an active staff row with a temp password, assignments, and an audit entry", async () => {
  const { supabase, orgId, roleId, adminId } = await setup();
  const email = `invitee-${crypto.randomUUID()}@example.com`;
  const { data: chapter } = await supabase.from("chapters").insert({
    organization_id: orgId, name: `LUMS-${crypto.randomUUID()}`,
  }).select("id").single();

  const result = await inviteStaffMember(supabase, adminId, false, {
    organizationId: orgId, fullName: "Newly Added", email, phone: "0300-1234567",
    roles: [
      { roleId, scopeKind: "org_wide", scopeLabel: "National / All Chapters" },
      { roleId, scopeKind: "chapter", chapterId: chapter!.id, scopeLabel: "Lahore Chapter" },
    ],
  });

  // A readable one-time password is returned for the admin to hand over.
  assertEquals(result.temporaryPassword.startsWith("Rizq-"), true);
  assertEquals(result.temporaryPassword.length >= 8, true);

  const { data: staff } = await supabase
    .from("staff")
    .select("status, must_change_password")
    .eq("id", result.staffId)
    .single();
  // Active immediately, but forced to rotate the password on first login.
  assertEquals(staff!.status, "active");
  assertEquals(staff!.must_change_password, true);

  const { data: assigns } = await supabase.from("staff_role_assignments").select("scope_kind")
    .eq("staff_id", result.staffId);
  assertEquals(assigns!.length, 2);

  const { data: audit } = await supabase.from("admin_audit_log").select("action, summary")
    .eq("organization_id", orgId).eq("entity_id", result.staffId).single();
  assertEquals(audit!.action, "Member Added");
});

Deno.test("inviteStaffMember persists expiresAt to staff.expires_at", async () => {
  const { supabase, orgId, roleId, adminId } = await setup();
  const when = new Date(Date.now() + 30 * 24 * 3600_000).toISOString();
  const result = await inviteStaffMember(supabase, adminId, false, {
    organizationId: orgId, fullName: "Timed", email: `timed-${crypto.randomUUID()}@example.com`,
    roles: [{ roleId, scopeKind: "org_wide", scopeLabel: "National / All Chapters" }],
    expiresAt: when,
  });
  const { data: staff } = await supabase.from("staff").select("expires_at").eq("id", result.staffId).single();
  assertEquals(new Date(staff!.expires_at as string).getTime(), new Date(when).getTime());
});

Deno.test("inviteStaffMember rejects a non-admin caller", async () => {
  const { supabase, orgId, roleId } = await setup();
  const outsiderEmail = `outsider-${crypto.randomUUID()}@example.com`;
  const { data: outAuth } = await supabase.auth.admin.createUser({ email: outsiderEmail, email_confirm: true });
  const { data: outsider } = await supabase.from("staff").insert({
    auth_user_id: outAuth!.user!.id, full_name: "Outsider", email: outsiderEmail,
  }).select("id").single();

  await assertRejects(
    () => inviteStaffMember(supabase, outsider!.id, false, {
      organizationId: orgId, fullName: "X", email: `x-${crypto.randomUUID()}@example.com`,
      roles: [{ roleId, scopeKind: "org_wide", scopeLabel: "National / All Chapters" }],
    }),
    Error, "forbidden",
  );
});

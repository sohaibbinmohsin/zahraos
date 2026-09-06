import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { updateStaffAccess } from "./handler.ts";

function testClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

async function setup() {
  const supabase = testClient();
  const { data: org } = await supabase.from("organizations").insert({
    name: "UpdAccess Org", slug: `upd-${crypto.randomUUID()}`,
  }).select("id").single();
  const { data: mod } = await supabase.from("modules").select("id").eq("key", "youth-republic").single();
  await supabase.from("org_modules").insert({ organization_id: org!.id, module_id: mod!.id });
  await supabase.rpc("seed_youth_republic_system_roles", { p_org_id: org!.id, p_module_id: mod!.id });
  const roleByName = async (n: string) =>
    (await supabase.from("roles").select("id").eq("organization_id", org!.id).eq("name", n).single()).data!.id as string;

  const adminEmail = `upd-admin-${crypto.randomUUID()}@example.com`;
  const { data: aAuth } = await supabase.auth.admin.createUser({ email: adminEmail, email_confirm: true });
  const { data: admin } = await supabase.from("staff").insert({
    auth_user_id: aAuth!.user!.id, full_name: "Upd Admin", email: adminEmail,
  }).select("id").single();
  await supabase.from("staff_org_roles").insert({ staff_id: admin!.id, organization_id: org!.id, org_tier: "admin" });

  const memEmail = `upd-mem-${crypto.randomUUID()}@example.com`;
  const { data: mAuth } = await supabase.auth.admin.createUser({ email: memEmail, email_confirm: true });
  const { data: member } = await supabase.from("staff").insert({
    auth_user_id: mAuth!.user!.id, full_name: "Upd Member", email: memEmail, status: "active",
  }).select("id").single();
  const opsLead = await roleByName("Operations Lead");
  await supabase.from("staff_role_assignments").insert({
    staff_id: member!.id, organization_id: org!.id, module_id: mod!.id, role_id: opsLead,
    scope_kind: "org_wide", scope_label: "National / All Chapters",
  });

  return { supabase, orgId: org!.id as string, adminId: admin!.id as string, memberId: member!.id as string, roleByName };
}

Deno.test("updateStaffAccess replaces the assignment set and updates status", async () => {
  const { supabase, orgId, adminId, memberId, roleByName } = await setup();
  const reviewer = await roleByName("Application Reviewer");
  const auditor = await roleByName("Auditor");

  await updateStaffAccess(supabase, adminId, false, {
    staffId: memberId, organizationId: orgId, status: "active",
    roles: [
      { roleId: reviewer, scopeKind: "chapter", chapterId: crypto.randomUUID(), scopeLabel: "Karachi Chapter" },
      { roleId: auditor, scopeKind: "org_wide", scopeLabel: "National / All Chapters" },
    ],
  });

  const { data: rows } = await supabase.from("staff_role_assignments")
    .select("role_id, scope_kind").eq("staff_id", memberId).eq("organization_id", orgId);
  assertEquals(rows!.length, 2);
  assertEquals(new Set(rows!.map((r) => r.role_id)), new Set([reviewer, auditor]));

  const { data: audit } = await supabase.from("admin_audit_log").select("action")
    .eq("organization_id", orgId).eq("entity_id", memberId).eq("action", "Access Changed").single();
  assertEquals(audit!.action, "Access Changed");
});

Deno.test("updateStaffAccess rejects a non-admin caller", async () => {
  const { supabase, orgId, memberId, roleByName } = await setup();
  await assertRejects(
    async () => updateStaffAccess(supabase, memberId, false, {
      staffId: memberId, organizationId: orgId, status: "active",
      roles: [{ roleId: await roleByName("Auditor"), scopeKind: "org_wide", scopeLabel: "National / All Chapters" }],
    }),
    Error, "forbidden",
  );
});

Deno.test("updateStaffAccess rejects a caller changing their own access", async () => {
  const { supabase, orgId, adminId, roleByName } = await setup();
  await assertRejects(
    async () => updateStaffAccess(supabase, adminId, false, {
      staffId: adminId, organizationId: orgId, status: "active",
      roles: [{ roleId: await roleByName("Auditor"), scopeKind: "org_wide", scopeLabel: "National / All Chapters" }],
    }),
    Error, "forbidden",
  );
});

Deno.test("updateStaffAccess rejects an admin of org A acting on a staff member only affiliated with org B", async () => {
  const { adminId: adminIdA } = await setup();
  const { supabase, orgId: orgIdB, memberId: memberIdB, roleByName: roleByNameB } = await setup();

  await assertRejects(
    async () => updateStaffAccess(supabase, adminIdA, false, {
      staffId: memberIdB, organizationId: orgIdB, status: "active",
      roles: [{ roleId: await roleByNameB("Auditor"), scopeKind: "org_wide", scopeLabel: "National / All Chapters" }],
    }),
    Error, "forbidden",
  );
});

import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { removeStaffMember } from "./handler.ts";

function testClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

Deno.test("removeStaffMember deletes assignments, deactivates, and audits", async () => {
  const supabase = testClient();
  const { data: org } = await supabase.from("organizations").insert({
    name: "Remove Org", slug: `rm-${crypto.randomUUID()}`,
  }).select("id").single();
  const { data: mod } = await supabase.from("modules").select("id").eq("key", "youth-republic").single();
  await supabase.from("org_modules").insert({ organization_id: org!.id, module_id: mod!.id });
  await supabase.rpc("seed_youth_republic_system_roles", { p_org_id: org!.id, p_module_id: mod!.id });
  const { data: role } = await supabase.from("roles").select("id")
    .eq("organization_id", org!.id).eq("name", "Auditor").single();

  const adminEmail = `rm-admin-${crypto.randomUUID()}@example.com`;
  const { data: aAuth } = await supabase.auth.admin.createUser({ email: adminEmail, email_confirm: true });
  const { data: admin } = await supabase.from("staff").insert({
    auth_user_id: aAuth!.user!.id, full_name: "Rm Admin", email: adminEmail,
  }).select("id").single();
  await supabase.from("staff_org_roles").insert({ staff_id: admin!.id, organization_id: org!.id, org_tier: "admin" });

  const memEmail = `rm-mem-${crypto.randomUUID()}@example.com`;
  const { data: mAuth } = await supabase.auth.admin.createUser({ email: memEmail, email_confirm: true });
  const { data: member } = await supabase.from("staff").insert({
    auth_user_id: mAuth!.user!.id, full_name: "Rm Member", email: memEmail, status: "active",
  }).select("id").single();
  await supabase.from("staff_role_assignments").insert({
    staff_id: member!.id, organization_id: org!.id, module_id: mod!.id, role_id: role!.id,
    scope_kind: "org_wide", scope_label: "National / All Chapters",
  });

  await removeStaffMember(supabase, admin!.id, false, { staffId: member!.id, organizationId: org!.id });

  const { data: rows } = await supabase.from("staff_role_assignments").select("id").eq("staff_id", member!.id);
  assertEquals(rows!.length, 0);
  const { data: s } = await supabase.from("staff").select("status").eq("id", member!.id).single();
  assertEquals(s!.status, "deactivated");
  const { data: audit } = await supabase.from("admin_audit_log").select("action")
    .eq("entity_id", member!.id).eq("action", "Member Removed").single();
  assertEquals(audit!.action, "Member Removed");

  await assertRejects(
    () => removeStaffMember(supabase, member!.id, false, { staffId: admin!.id, organizationId: org!.id }),
    Error, "forbidden",
  );
});

async function setupOrgWithAdmin(namePrefix: string) {
  const supabase = testClient();
  const { data: org } = await supabase.from("organizations").insert({
    name: `${namePrefix} Org`, slug: `${namePrefix}-${crypto.randomUUID()}`,
  }).select("id").single();
  const { data: mod } = await supabase.from("modules").select("id").eq("key", "youth-republic").single();
  await supabase.from("org_modules").insert({ organization_id: org!.id, module_id: mod!.id });
  await supabase.rpc("seed_youth_republic_system_roles", { p_org_id: org!.id, p_module_id: mod!.id });

  const adminEmail = `${namePrefix}-admin-${crypto.randomUUID()}@example.com`;
  const { data: aAuth } = await supabase.auth.admin.createUser({ email: adminEmail, email_confirm: true });
  const { data: admin } = await supabase.from("staff").insert({
    auth_user_id: aAuth!.user!.id, full_name: `${namePrefix} Admin`, email: adminEmail,
  }).select("id").single();
  await supabase.from("staff_org_roles").insert({ staff_id: admin!.id, organization_id: org!.id, org_tier: "admin" });

  return { supabase, orgId: org!.id as string, moduleId: mod!.id as string, adminId: admin!.id as string };
}

Deno.test("removeStaffMember rejects an admin of org A removing a member only affiliated with org B", async () => {
  const { adminId: adminIdA } = await setupOrgWithAdmin("rmA");
  const { supabase, orgId: orgIdB, moduleId: moduleIdB } = await setupOrgWithAdmin("rmB");

  const { data: role } = await supabase.from("roles").select("id")
    .eq("organization_id", orgIdB).eq("name", "Auditor").single();
  const memEmail = `rmB-mem-${crypto.randomUUID()}@example.com`;
  const { data: mAuth } = await supabase.auth.admin.createUser({ email: memEmail, email_confirm: true });
  const { data: member } = await supabase.from("staff").insert({
    auth_user_id: mAuth!.user!.id, full_name: "RmB Member", email: memEmail, status: "active",
  }).select("id").single();
  await supabase.from("staff_role_assignments").insert({
    staff_id: member!.id, organization_id: orgIdB, module_id: moduleIdB, role_id: role!.id,
    scope_kind: "org_wide", scope_label: "National / All Chapters",
  });

  await assertRejects(
    () => removeStaffMember(supabase, adminIdA, false, { staffId: member!.id, organizationId: orgIdB }),
    Error, "forbidden",
  );
});

Deno.test("removeStaffMember rejects an admin removing that org's super_admin", async () => {
  const { supabase, orgId, adminId } = await setupOrgWithAdmin("rmSuper");

  const superEmail = `rmSuper-super-${crypto.randomUUID()}@example.com`;
  const { data: sAuth } = await supabase.auth.admin.createUser({ email: superEmail, email_confirm: true });
  const { data: superAdmin } = await supabase.from("staff").insert({
    auth_user_id: sAuth!.user!.id, full_name: "RmSuper SuperAdmin", email: superEmail, status: "active",
  }).select("id").single();
  await supabase.from("staff_org_roles").insert({ staff_id: superAdmin!.id, organization_id: orgId, org_tier: "super_admin" });

  await assertRejects(
    () => removeStaffMember(supabase, adminId, false, { staffId: superAdmin!.id, organizationId: orgId }),
    Error, "forbidden",
  );
});

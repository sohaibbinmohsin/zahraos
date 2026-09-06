import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { createCustomRole } from "../create-custom-role/handler.ts";
import { deleteCustomRole } from "./handler.ts";

function testClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

Deno.test("deleteCustomRole removes an unassigned custom role but blocks an assigned one and system roles", async () => {
  const supabase = testClient();
  const { data: org } = await supabase.from("organizations").insert({
    name: "DCR Org", slug: `dcr-${crypto.randomUUID()}`,
  }).select("id").single();
  const { data: mod } = await supabase.from("modules").select("id").eq("key", "youth-republic").single();
  await supabase.from("org_modules").insert({ organization_id: org!.id, module_id: mod!.id });
  await supabase.rpc("seed_youth_republic_system_roles", { p_org_id: org!.id, p_module_id: mod!.id });
  const adminEmail = `dcr-admin-${crypto.randomUUID()}@example.com`;
  const { data: aAuth } = await supabase.auth.admin.createUser({ email: adminEmail, email_confirm: true });
  const { data: admin } = await supabase.from("staff").insert({
    auth_user_id: aAuth!.user!.id, full_name: "DCR Admin", email: adminEmail,
  }).select("id").single();
  await supabase.from("staff_org_roles").insert({ staff_id: admin!.id, organization_id: org!.id, org_tier: "admin" });

  const { roleId } = await createCustomRole(supabase, admin!.id, false, {
    organizationId: org!.id, moduleId: mod!.id, name: "Disposable", description: "",
    capabilities: { drive: "restricted", publish: "restricted", triage: "restricted", hours: "restricted", team: "restricted" },
  });
  const res = await deleteCustomRole(supabase, admin!.id, false, { roleId });
  assertEquals(res.roleId, roleId);
  const { data: gone } = await supabase.from("roles").select("id").eq("id", roleId).maybeSingle();
  assertEquals(gone, null);

  const { data: sysRole } = await supabase.from("roles").select("id")
    .eq("organization_id", org!.id).eq("name", "Auditor").single();
  await assertRejects(() => deleteCustomRole(supabase, admin!.id, false, { roleId: sysRole!.id }), Error, "system_role_immutable");

  const { roleId: assignedRoleId } = await createCustomRole(supabase, admin!.id, false, {
    organizationId: org!.id, moduleId: mod!.id, name: "InUse", description: "",
    capabilities: { drive: "granted", publish: "restricted", triage: "restricted", hours: "restricted", team: "restricted" },
  });
  const memEmail = `dcr-mem-${crypto.randomUUID()}@example.com`;
  const { data: mAuth } = await supabase.auth.admin.createUser({ email: memEmail, email_confirm: true });
  const { data: member } = await supabase.from("staff").insert({
    auth_user_id: mAuth!.user!.id, full_name: "Mem", email: memEmail,
  }).select("id").single();
  await supabase.from("staff_role_assignments").insert({
    staff_id: member!.id, organization_id: org!.id, module_id: mod!.id, role_id: assignedRoleId,
    scope_kind: "org_wide", scope_label: "National / All Chapters",
  });
  await assertRejects(() => deleteCustomRole(supabase, admin!.id, false, { roleId: assignedRoleId }), Error, "role_in_use");
});

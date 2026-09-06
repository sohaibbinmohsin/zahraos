import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { createCustomRole } from "../create-custom-role/handler.ts";
import { updateCustomRole } from "./handler.ts";

function testClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}
async function setup() {
  const supabase = testClient();
  const { data: org } = await supabase.from("organizations").insert({
    name: "UCR Org", slug: `ucr-${crypto.randomUUID()}`,
  }).select("id").single();
  const { data: mod } = await supabase.from("modules").select("id").eq("key", "youth-republic").single();
  await supabase.from("org_modules").insert({ organization_id: org!.id, module_id: mod!.id });
  await supabase.rpc("seed_youth_republic_system_roles", { p_org_id: org!.id, p_module_id: mod!.id });
  const adminEmail = `ucr-admin-${crypto.randomUUID()}@example.com`;
  const { data: aAuth } = await supabase.auth.admin.createUser({ email: adminEmail, email_confirm: true });
  const { data: admin } = await supabase.from("staff").insert({
    auth_user_id: aAuth!.user!.id, full_name: "UCR Admin", email: adminEmail,
  }).select("id").single();
  await supabase.from("staff_org_roles").insert({ staff_id: admin!.id, organization_id: org!.id, org_tier: "admin" });
  return { supabase, orgId: org!.id as string, moduleId: mod!.id as string, adminId: admin!.id as string };
}

Deno.test("updateCustomRole rewrites permissions and rejects system roles", async () => {
  const { supabase, orgId, moduleId, adminId } = await setup();
  const { roleId } = await createCustomRole(supabase, adminId, false, {
    organizationId: orgId, moduleId, name: "Editable", description: "v1",
    capabilities: { drive: "granted", publish: "restricted", triage: "restricted", hours: "restricted", team: "restricted" },
  });

  await updateCustomRole(supabase, adminId, false, {
    roleId, name: "Editable v2", description: "v2",
    capabilities: { drive: "restricted", publish: "restricted", triage: "granted", hours: "read_only", team: "restricted" },
  });

  const { data: role } = await supabase.from("roles").select("name, description").eq("id", roleId).single();
  assertEquals(role!.name, "Editable v2");
  const { data: perms } = await supabase.from("role_permissions")
    .select("permissions(resource, action)").eq("role_id", roleId);
  const keys = (perms ?? []).map((p) => {
    const perm = p.permissions as unknown as { resource: string; action: string };
    return `${perm.resource}:${perm.action}`;
  }).sort();
  assertEquals(keys, ["applications:read", "applications:update", "hours:read"]);

  const { data: sysRole } = await supabase.from("roles").select("id")
    .eq("organization_id", orgId).eq("name", "Auditor").single();
  await assertRejects(
    () => updateCustomRole(supabase, adminId, false, {
      roleId: sysRole!.id, name: "Hacked", description: "",
      capabilities: { drive: "granted", publish: "granted", triage: "granted", hours: "granted", team: "granted" },
    }),
    Error, "system_role_immutable",
  );
});

Deno.test("updateCustomRole rejects renaming onto another role's name and leaves its permissions untouched", async () => {
  const { supabase, orgId, moduleId, adminId } = await setup();
  const { roleId: firstRoleId } = await createCustomRole(supabase, adminId, false, {
    organizationId: orgId, moduleId, name: "First Role", description: "v1",
    capabilities: { drive: "granted", publish: "restricted", triage: "restricted", hours: "restricted", team: "restricted" },
  });
  const { roleId: secondRoleId } = await createCustomRole(supabase, adminId, false, {
    organizationId: orgId, moduleId, name: "Second Role", description: "v1",
    capabilities: { drive: "restricted", publish: "restricted", triage: "granted", hours: "restricted", team: "restricted" },
  });

  const { data: beforePerms } = await supabase.from("role_permissions")
    .select("permissions(resource, action)").eq("role_id", secondRoleId);
  const beforeKeys = (beforePerms ?? []).map((p) => {
    const perm = p.permissions as unknown as { resource: string; action: string };
    return `${perm.resource}:${perm.action}`;
  }).sort();

  await assertRejects(
    () => updateCustomRole(supabase, adminId, false, {
      roleId: secondRoleId, name: "First Role", description: "renamed onto first",
      capabilities: { drive: "granted", publish: "granted", triage: "granted", hours: "granted", team: "granted" },
    }),
    Error, "role_name_taken",
  );

  const { data: secondRoleAfter } = await supabase.from("roles").select("name, description").eq("id", secondRoleId).single();
  assertEquals(secondRoleAfter!.name, "Second Role");
  assertEquals(secondRoleAfter!.description, "v1");

  const { data: afterPerms } = await supabase.from("role_permissions")
    .select("permissions(resource, action)").eq("role_id", secondRoleId);
  const afterKeys = (afterPerms ?? []).map((p) => {
    const perm = p.permissions as unknown as { resource: string; action: string };
    return `${perm.resource}:${perm.action}`;
  }).sort();
  assertEquals(afterKeys, beforeKeys);

  // sanity: firstRoleId still holds the name it started with
  const { data: firstRole } = await supabase.from("roles").select("name").eq("id", firstRoleId).single();
  assertEquals(firstRole!.name, "First Role");
});

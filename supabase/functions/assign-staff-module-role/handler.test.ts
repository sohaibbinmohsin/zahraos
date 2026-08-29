import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { assignStaffModuleRole } from "./handler.ts";

function testClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

async function createAuthUser(supabase: ReturnType<typeof testClient>, email: string) {
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (authError || !authUser.user) {
    throw new Error(`failed to create auth user: ${authError?.message}`);
  }
  return authUser.user.id;
}

async function setupOrgWithVms(supabase: ReturnType<typeof testClient>) {
  const { data: org } = await supabase.from("organizations").insert({
    name: "Assign Role Test Org",
    slug: `assign-role-${crypto.randomUUID()}`,
  }).select("id").single();
  const { data: vmsModule } = await supabase.from("modules").select("id").eq("key", "vms").single();
  await supabase.from("org_modules").insert({ organization_id: org!.id, module_id: vmsModule!.id });
  await supabase.rpc("seed_system_roles_for_module", { p_org_id: org!.id, p_module_id: vmsModule!.id });
  const { data: editorRole } = await supabase.from("roles").select("id").eq("organization_id", org!.id).eq("name", "Editor").single();
  return { orgId: org!.id as string, moduleId: vmsModule!.id as string, editorRoleId: editorRole!.id as string };
}

Deno.test("assignStaffModuleRole grants a role when the caller is admin", async () => {
  const supabase = testClient();
  const { orgId, moduleId, editorRoleId } = await setupOrgWithVms(supabase);

  const adminEmail = `assign-admin-${crypto.randomUUID()}@example.com`;
  const adminAuthUserId = await createAuthUser(supabase, adminEmail);
  const { data: admin } = await supabase.from("staff").insert({
    auth_user_id: adminAuthUserId, full_name: "Admin", email: adminEmail,
  }).select("id").single();
  await supabase.from("staff_org_roles").insert({ staff_id: admin!.id, organization_id: orgId, org_tier: "admin" });

  const targetEmail = `assign-target-${crypto.randomUUID()}@example.com`;
  const targetAuthUserId = await createAuthUser(supabase, targetEmail);
  const { data: target } = await supabase.from("staff").insert({
    auth_user_id: targetAuthUserId, full_name: "Target", email: targetEmail,
  }).select("id").single();

  const result = await assignStaffModuleRole(supabase, admin!.id, false, {
    staffId: target!.id, organizationId: orgId, moduleId, roleId: editorRoleId,
  });

  assertEquals(result.staffId, target!.id);
});

Deno.test("assignStaffModuleRole rejects assigning a role for a module the org hasn't enabled", async () => {
  const supabase = testClient();
  const { data: org } = await supabase.from("organizations").insert({
    name: "No Module Test Org",
    slug: `no-module-${crypto.randomUUID()}`,
  }).select("id").single();

  const targetEmail = `no-module-target-${crypto.randomUUID()}@example.com`;
  const targetAuthUserId = await createAuthUser(supabase, targetEmail);
  const { data: target } = await supabase.from("staff").insert({
    auth_user_id: targetAuthUserId, full_name: "Target", email: targetEmail,
  }).select("id").single();

  const { data: vmsModule } = await supabase.from("modules").select("id").eq("key", "vms").single();

  await assertRejects(
    () => assignStaffModuleRole(supabase, target!.id, true, {
      staffId: target!.id, organizationId: org!.id, moduleId: vmsModule!.id, roleId: crypto.randomUUID(),
    }),
    Error,
    "module_not_enabled",
  );
});

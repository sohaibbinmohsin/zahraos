import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { createCustomRole } from "./handler.ts";

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

Deno.test("createCustomRole builds a role from the module's own permissions", async () => {
  const supabase = testClient();
  const { data: org } = await supabase.from("organizations").insert({
    name: "Custom Role Test Org",
    slug: `custom-role-${crypto.randomUUID()}`,
  }).select("id").single();
  const { data: youthRepublicModule } = await supabase.from("modules").select("id").eq("key", "youth-republic").single();
  await supabase.from("org_modules").insert({ organization_id: org!.id, module_id: youthRepublicModule!.id });

  const adminEmail = `custom-role-admin-${crypto.randomUUID()}@example.com`;
  const adminAuthUserId = await createAuthUser(supabase, adminEmail);
  const { data: admin } = await supabase.from("staff").insert({
    auth_user_id: adminAuthUserId, full_name: "Custom Role Admin", email: adminEmail,
  }).select("id").single();
  await supabase.from("staff_org_roles").insert({ staff_id: admin!.id, organization_id: org!.id, org_tier: "super_admin" });

  const { data: perms } = await supabase.from("permissions").select("id").eq("module_id", youthRepublicModule!.id).in("resource", ["hours"]).eq("action", "update");

  const result = await createCustomRole(supabase, admin!.id, false, {
    organizationId: org!.id,
    moduleId: youthRepublicModule!.id,
    name: "Hours Verifier",
    permissionIds: perms!.map((p) => p.id),
  });

  assertEquals(typeof result.roleId, "string");
  const { data: rolePerms } = await supabase.from("role_permissions").select("permission_id").eq("role_id", result.roleId);
  assertEquals(rolePerms!.length, perms!.length);
});

Deno.test("createCustomRole rejects a permission from a different module", async () => {
  const supabase = testClient();
  const { data: org } = await supabase.from("organizations").insert({
    name: "Custom Role Reject Test Org",
    slug: `custom-role-reject-${crypto.randomUUID()}`,
  }).select("id").single();

  const { data: youthRepublicModule } = await supabase.from("modules").select("id").eq("key", "youth-republic").single();
  const { data: otherModule } = await supabase.from("modules").insert({ key: `other-${crypto.randomUUID()}`, display_name: "Other" }).select("id").single();
  const { data: otherPerm } = await supabase.from("permissions").insert({ module_id: otherModule!.id, resource: "widgets", action: "read" }).select("id").single();

  await supabase.from("org_modules").insert({ organization_id: org!.id, module_id: youthRepublicModule!.id });

  await assertRejects(
    () => createCustomRole(supabase, crypto.randomUUID(), true, {
      organizationId: org!.id,
      moduleId: youthRepublicModule!.id,
      name: "Bad Role",
      permissionIds: [otherPerm!.id],
    }),
    Error,
    "permission_not_available",
  );
});

Deno.test("createCustomRole rejects building a role for a module the org hasn't enabled", async () => {
  const supabase = testClient();
  const { data: org } = await supabase.from("organizations").insert({
    name: "Custom Role Unenabled Module Test Org",
    slug: `custom-role-unenabled-${crypto.randomUUID()}`,
  }).select("id").single();
  // Deliberately no org_modules row for this org — youth-republic is a real, globally-readable
  // module/permission catalog, but this org was never sold/enabled for it.
  const { data: youthRepublicModule } = await supabase.from("modules").select("id").eq("key", "youth-republic").single();
  const { data: perms } = await supabase.from("permissions").select("id").eq("module_id", youthRepublicModule!.id).limit(1);

  await assertRejects(
    () => createCustomRole(supabase, crypto.randomUUID(), true, {
      organizationId: org!.id,
      moduleId: youthRepublicModule!.id,
      name: "Should Not Exist",
      permissionIds: perms!.map((p) => p.id),
    }),
    Error,
    "module_not_enabled",
  );
});

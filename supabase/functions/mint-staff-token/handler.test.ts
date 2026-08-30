import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { verify } from "https://deno.land/x/djwt@v3.0.2/mod.ts";
import { mintStaffToken } from "./handler.ts";

function testClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

async function verifyKey() {
  return await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(Deno.env.get("STAFF_JWT_SECRET")!),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
}

Deno.test("mintStaffToken resolves full permissions for an org_super_admin", async () => {
  Deno.env.set("STAFF_JWT_SECRET", "test-shared-secret-32-characters!");
  const supabase = testClient();

  const email = `super-${crypto.randomUUID()}@example.com`;
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (authError || !authUser.user) {
    throw new Error(`failed to create auth user: ${authError?.message}`);
  }

  const { data: staff } = await supabase.from("staff").insert({
    auth_user_id: authUser.user.id,
    full_name: "Super Admin Test",
    email,
  }).select("id").single();

  const { data: org } = await supabase.from("organizations").insert({
    name: "Mint Test Org",
    slug: `mint-test-${crypto.randomUUID()}`,
  }).select("id").single();

  const { data: youthRepublicModule } = await supabase.from("modules").select("id").eq("key", "youth-republic").single();
  await supabase.from("org_modules").insert({ organization_id: org!.id, module_id: youthRepublicModule!.id });
  await supabase.from("staff_org_roles").insert({ staff_id: staff!.id, organization_id: org!.id, org_tier: "super_admin" });

  const token = await mintStaffToken(supabase, staff!.id, false);
  const payload = await verify(token, await verifyKey());

  const moduleAccess = payload.module_access as Array<{ organization_id: string; module: string; permissions: string[] }>;
  const youthRepublicAccess = moduleAccess.find((m) => m.organization_id === org!.id && m.module === "youth-republic");

  assertEquals(payload.platform_owner, false);
  assertEquals(payload.staff_id, staff!.id);
  assertEquals(youthRepublicAccess!.permissions.includes("applications:read"), true);
  assertEquals(youthRepublicAccess!.permissions.includes("opportunities:delete"), true);
});

Deno.test("mintStaffToken sets can_verify_identity for a staff row flagged as an identity verifier", async () => {
  Deno.env.set("STAFF_JWT_SECRET", "test-shared-secret-32-characters!");
  const supabase = testClient();

  const email = `verifier-${crypto.randomUUID()}@example.com`;
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (authError || !authUser.user) {
    throw new Error(`failed to create auth user: ${authError?.message}`);
  }

  const { data: staff } = await supabase.from("staff").insert({
    auth_user_id: authUser.user.id,
    full_name: "Identity Verifier Test",
    email,
    can_verify_identity: true,
  }).select("id").single();

  const token = await mintStaffToken(supabase, staff!.id, false);
  const payload = await verify(token, await verifyKey());

  assertEquals(payload.can_verify_identity, true);
});

Deno.test("mintStaffToken leaves can_verify_identity false for an ordinary staff row", async () => {
  Deno.env.set("STAFF_JWT_SECRET", "test-shared-secret-32-characters!");
  const supabase = testClient();

  const email = `plain-${crypto.randomUUID()}@example.com`;
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (authError || !authUser.user) {
    throw new Error(`failed to create auth user: ${authError?.message}`);
  }

  const { data: staff } = await supabase.from("staff").insert({
    auth_user_id: authUser.user.id,
    full_name: "Plain Staff Test",
    email,
  }).select("id").single();

  const token = await mintStaffToken(supabase, staff!.id, false);
  const payload = await verify(token, await verifyKey());

  assertEquals(payload.can_verify_identity, false);
});

Deno.test("mintStaffToken resolves only the granted role's permissions for a regular staff member", async () => {
  Deno.env.set("STAFF_JWT_SECRET", "test-shared-secret-32-characters!");
  const supabase = testClient();

  const email = `regular-${crypto.randomUUID()}@example.com`;
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (authError || !authUser.user) {
    throw new Error(`failed to create auth user: ${authError?.message}`);
  }

  const { data: staff } = await supabase.from("staff").insert({
    auth_user_id: authUser.user.id,
    full_name: "Regular Staff Test",
    email,
  }).select("id").single();

  const { data: org } = await supabase.from("organizations").insert({
    name: "Mint Test Org 2",
    slug: `mint-test-2-${crypto.randomUUID()}`,
  }).select("id").single();

  const { data: youthRepublicModule } = await supabase.from("modules").select("id").eq("key", "youth-republic").single();
  await supabase.from("org_modules").insert({ organization_id: org!.id, module_id: youthRepublicModule!.id });
  await supabase.rpc("seed_system_roles_for_module", { p_org_id: org!.id, p_module_id: youthRepublicModule!.id });
  const { data: viewerRole } = await supabase.from("roles").select("id").eq("organization_id", org!.id).eq("name", "Viewer").single();
  await supabase.from("staff_module_roles").insert({
    staff_id: staff!.id,
    organization_id: org!.id,
    module_id: youthRepublicModule!.id,
    role_id: viewerRole!.id,
  });

  const token = await mintStaffToken(supabase, staff!.id, false);
  const payload = await verify(token, await verifyKey());

  const moduleAccess = payload.module_access as Array<{ organization_id: string; module: string; permissions: string[] }>;
  const youthRepublicAccess = moduleAccess.find((m) => m.organization_id === org!.id && m.module === "youth-republic");

  assertEquals(payload.staff_id, staff!.id);
  assertEquals(youthRepublicAccess!.permissions.includes("applications:read"), true);
  assertEquals(youthRepublicAccess!.permissions.includes("applications:write"), false);
});

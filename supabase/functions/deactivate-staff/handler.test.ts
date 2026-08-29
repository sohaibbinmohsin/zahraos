import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { deactivateStaff } from "./handler.ts";

function testClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

async function makeOrg(supabase: ReturnType<typeof testClient>) {
  const { data: org } = await supabase.from("organizations").insert({
    name: "Deactivate Test Org",
    slug: `deactivate-${crypto.randomUUID()}`,
  }).select("id").single();
  return org!.id as string;
}

async function makeStaff(supabase: ReturnType<typeof testClient>, platformOwner = false) {
  const email = `tier-${crypto.randomUUID()}@example.com`;
  // FK fixture fix (Tasks 12/13/15/16/17 pattern): staff.auth_user_id has a
  // real FK to auth.users(id), so a random UUID here would violate it. Create
  // a real auth.users row via the admin API first and use its id.
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (authError || !authUser.user) {
    throw new Error(`failed to create auth user: ${authError?.message}`);
  }
  const { data: staff } = await supabase.from("staff").insert({
    auth_user_id: authUser.user.id,
    full_name: "Tier Test",
    email,
    platform_owner: platformOwner,
  }).select("id").single();
  return staff!.id as string;
}

async function grantOrgTier(supabase: ReturnType<typeof testClient>, staffId: string, orgId: string, orgTier: "admin" | "super_admin") {
  await supabase.from("staff_org_roles").insert({ staff_id: staffId, organization_id: orgId, org_tier: orgTier });
}

// A "regular" staff member has no staff_org_roles row at all — their only
// affiliation with an org is a module-role grant, matching the spec: "regular
// staff hold no org-management tier at all — only whatever module role(s)
// they've been granted." This is what deactivateStaff must recognize as
// "belongs to this org" for its shared-org check to mean anything.
async function grantModuleAffiliation(supabase: ReturnType<typeof testClient>, staffId: string, orgId: string) {
  const { data: vmsModule } = await supabase.from("modules").select("id").eq("key", "vms").single();
  await supabase.from("org_modules").upsert({ organization_id: orgId, module_id: vmsModule!.id });
  await supabase.rpc("seed_system_roles_for_module", { p_org_id: orgId, p_module_id: vmsModule!.id });
  const { data: viewerRole } = await supabase.from("roles").select("id").eq("organization_id", orgId).eq("name", "Viewer").single();
  await supabase.from("staff_module_roles").insert({ staff_id: staffId, organization_id: orgId, module_id: vmsModule!.id, role_id: viewerRole!.id });
}

Deno.test("deactivateStaff lets an admin deactivate a regular staff member in the same org", async () => {
  const supabase = testClient();
  const orgId = await makeOrg(supabase);
  const adminId = await makeStaff(supabase);
  await grantOrgTier(supabase, adminId, orgId, "admin");
  const regularId = await makeStaff(supabase);
  await grantModuleAffiliation(supabase, regularId, orgId);

  const result = await deactivateStaff(supabase, adminId, false, regularId);
  assertEquals(result.staffId, regularId);

  const { data } = await supabase.from("staff").select("status").eq("id", regularId).single();
  assertEquals(data!.status, "deactivated");
});

Deno.test("deactivateStaff rejects an admin deactivating another admin in the same org", async () => {
  const supabase = testClient();
  const orgId = await makeOrg(supabase);
  const adminId = await makeStaff(supabase);
  await grantOrgTier(supabase, adminId, orgId, "admin");
  const otherAdminId = await makeStaff(supabase);
  await grantOrgTier(supabase, otherAdminId, orgId, "admin");

  await assertRejects(() => deactivateStaff(supabase, adminId, false, otherAdminId), Error, "forbidden");
});

Deno.test("deactivateStaff lets a super_admin deactivate another admin in the same org", async () => {
  const supabase = testClient();
  const orgId = await makeOrg(supabase);
  const superAdminId = await makeStaff(supabase);
  await grantOrgTier(supabase, superAdminId, orgId, "super_admin");
  const adminId = await makeStaff(supabase);
  await grantOrgTier(supabase, adminId, orgId, "admin");

  const result = await deactivateStaff(supabase, superAdminId, false, adminId);
  assertEquals(result.staffId, adminId);
});

Deno.test("deactivateStaff rejects an admin deactivating a staff member who shares no organization with them", async () => {
  const supabase = testClient();
  const callerOrgId = await makeOrg(supabase);
  const targetOrgId = await makeOrg(supabase);
  const adminId = await makeStaff(supabase);
  await grantOrgTier(supabase, adminId, callerOrgId, "admin");
  const unrelatedId = await makeStaff(supabase);
  await grantModuleAffiliation(supabase, unrelatedId, targetOrgId);

  // Regression test for the bug where the handler picked the caller's first
  // staff_org_roles row and treated a target with no row *in that org* as an
  // ordinary staff member fair game for deactivation — even when the target
  // was never affiliated with that org (or any org the caller has authority
  // over) at all.
  await assertRejects(() => deactivateStaff(supabase, adminId, false, unrelatedId), Error, "forbidden");
});

Deno.test("deactivateStaff rejects an admin deactivating a platform_owner account", async () => {
  const supabase = testClient();
  const orgId = await makeOrg(supabase);
  const adminId = await makeStaff(supabase);
  await grantOrgTier(supabase, adminId, orgId, "admin");
  const ownerId = await makeStaff(supabase, true);
  await grantModuleAffiliation(supabase, ownerId, orgId);

  await assertRejects(() => deactivateStaff(supabase, adminId, false, ownerId), Error, "forbidden");
});

// Regression test for the "no session revocation on staff deactivation"
// finding: flipping staff.status alone left the target's existing Supabase
// Auth session (and any already-issued access token) fully usable until it
// naturally expired/refreshed — including for reading/writing tables the
// target's RLS policies allow directly, outside of any Edge Function gate.
// deactivateStaff must kill that session immediately.
Deno.test("deactivateStaff revokes the target's Supabase Auth session so their old access token stops working", async () => {
  const supabase = testClient();
  const orgId = await makeOrg(supabase);
  const adminId = await makeStaff(supabase);
  await grantOrgTier(supabase, adminId, orgId, "admin");

  const email = `deactivate-session-${crypto.randomUUID()}@example.com`;
  const password = "Deactivate-Session-Test-1!";
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (authError || !authUser.user) {
    throw new Error(`failed to create auth user: ${authError?.message}`);
  }
  const { data: targetRow } = await supabase.from("staff").insert({
    auth_user_id: authUser.user.id,
    full_name: "Session Kill Test",
    email,
  }).select("id").single();
  const targetId = targetRow!.id as string;
  await grantModuleAffiliation(supabase, targetId, orgId);

  const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
  const { data: signIn, error: signInError } = await anon.auth.signInWithPassword({ email, password });
  if (signInError || !signIn.session) {
    throw new Error(`failed to sign in test staff member: ${signInError?.message}`);
  }
  const oldAccessToken = signIn.session.access_token;

  // Sanity check: the token genuinely works before deactivation, so a
  // rejection afterward is meaningful rather than a fluke of a bad token.
  const { error: beforeError } = await supabase.auth.getUser(oldAccessToken);
  assertEquals(beforeError, null);

  await deactivateStaff(supabase, adminId, false, targetId);

  const { error: afterError } = await supabase.auth.getUser(oldAccessToken);
  assertEquals(afterError !== null, true);
});

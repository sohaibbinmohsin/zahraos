import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { assignStaffOrgRole } from "./handler.ts";

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

async function makeOrg(supabase: ReturnType<typeof testClient>) {
  const { data: org } = await supabase.from("organizations").insert({
    name: "Assign Org Role Test Org",
    slug: `assign-org-role-${crypto.randomUUID()}`,
  }).select("id").single();
  return org!.id as string;
}

async function makeStaff(supabase: ReturnType<typeof testClient>) {
  const email = `assign-org-role-${crypto.randomUUID()}@example.com`;
  const authUserId = await createAuthUser(supabase, email);
  const { data: staff } = await supabase.from("staff").insert({
    auth_user_id: authUserId, full_name: "Assign Org Role Test Staff", email,
  }).select("id").single();
  return staff!.id as string;
}

Deno.test("assignStaffOrgRole lets a platform_owner grant super_admin to a staff member with no prior org affiliation", async () => {
  const supabase = testClient();
  const orgId = await makeOrg(supabase);
  const callerId = await makeStaff(supabase);
  const targetId = await makeStaff(supabase);

  const result = await assignStaffOrgRole(supabase, callerId, true, {
    staffId: targetId,
    organizationId: orgId,
    orgTier: "super_admin",
  });

  assertEquals(result.staffId, targetId);
  const { data } = await supabase.from("staff_org_roles").select("org_tier").eq("staff_id", targetId).eq(
    "organization_id",
    orgId,
  ).single();
  assertEquals(data!.org_tier, "super_admin");
});

Deno.test("assignStaffOrgRole lets an existing super_admin grant admin to another staff member in the same org", async () => {
  const supabase = testClient();
  const orgId = await makeOrg(supabase);
  const superAdminId = await makeStaff(supabase);
  await supabase.from("staff_org_roles").insert({ staff_id: superAdminId, organization_id: orgId, org_tier: "super_admin" });
  const targetId = await makeStaff(supabase);

  const result = await assignStaffOrgRole(supabase, superAdminId, false, {
    staffId: targetId,
    organizationId: orgId,
    orgTier: "admin",
  });

  assertEquals(result.staffId, targetId);
});

Deno.test("assignStaffOrgRole rejects a caller who only holds admin tier — org authority is super_admin/platform_owner only", async () => {
  const supabase = testClient();
  const orgId = await makeOrg(supabase);
  const adminId = await makeStaff(supabase);
  await supabase.from("staff_org_roles").insert({ staff_id: adminId, organization_id: orgId, org_tier: "admin" });
  const targetId = await makeStaff(supabase);

  await assertRejects(
    () => assignStaffOrgRole(supabase, adminId, false, { staffId: targetId, organizationId: orgId, orgTier: "admin" }),
    Error,
    "forbidden",
  );
});

Deno.test("assignStaffOrgRole rejects a caller with no affiliation to the org at all", async () => {
  const supabase = testClient();
  const orgId = await makeOrg(supabase);
  const strangerId = await makeStaff(supabase);
  const targetId = await makeStaff(supabase);

  await assertRejects(
    () => assignStaffOrgRole(supabase, strangerId, false, { staffId: targetId, organizationId: orgId, orgTier: "super_admin" }),
    Error,
    "forbidden",
  );
});

Deno.test("assignStaffOrgRole rejects an invalid orgTier value rather than trusting client input", async () => {
  const supabase = testClient();
  const orgId = await makeOrg(supabase);
  const targetId = await makeStaff(supabase);

  await assertRejects(
    // deno-lint-ignore no-explicit-any
    () => assignStaffOrgRole(supabase, "caller", true, { staffId: targetId, organizationId: orgId, orgTier: "owner" as any }),
    Error,
    "invalid_org_tier",
  );
});

Deno.test("assignStaffOrgRole upserts — calling it again for the same staff/org changes the tier instead of erroring", async () => {
  const supabase = testClient();
  const orgId = await makeOrg(supabase);
  const targetId = await makeStaff(supabase);

  await assignStaffOrgRole(supabase, "caller", true, { staffId: targetId, organizationId: orgId, orgTier: "admin" });
  await assignStaffOrgRole(supabase, "caller", true, { staffId: targetId, organizationId: orgId, orgTier: "super_admin" });

  const { data } = await supabase.from("staff_org_roles").select("org_tier").eq("staff_id", targetId).eq(
    "organization_id",
    orgId,
  ).single();
  assertEquals(data!.org_tier, "super_admin");
});

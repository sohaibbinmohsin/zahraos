import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { createStaff } from "./handler.ts";

function testClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

async function makeOrgAdmin(supabase: ReturnType<typeof testClient>) {
  const email = `org-admin-${crypto.randomUUID()}@example.com`;
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (authError || !authUser.user) {
    throw new Error(`failed to create auth user: ${authError?.message}`);
  }

  const { data: staff } = await supabase.from("staff").insert({
    auth_user_id: authUser.user.id,
    full_name: "Org Admin Test",
    email,
  }).select("id").single();

  const { data: org } = await supabase.from("organizations").insert({
    name: "Create Staff Test Org",
    slug: `create-staff-${crypto.randomUUID()}`,
  }).select("id").single();

  await supabase.from("staff_org_roles").insert({ staff_id: staff!.id, organization_id: org!.id, org_tier: "admin" });

  return { adminStaffId: staff!.id as string, orgId: org!.id as string };
}

Deno.test("createStaff creates a staff account with must_change_password set", async () => {
  const supabase = testClient();
  const { adminStaffId, orgId } = await makeOrgAdmin(supabase);

  const result = await createStaff(supabase, adminStaffId, false, {
    fullName: "New Staff",
    email: `new-staff-${crypto.randomUUID()}@example.com`,
    organizationId: orgId,
  });

  assertEquals(typeof result.staffId, "string");
  assertEquals(typeof result.temporaryPassword, "string");

  const { data: staffRow } = await supabase.from("staff").select("must_change_password").eq("id", result.staffId).single();
  assertEquals(staffRow!.must_change_password, true);
});

Deno.test("createStaff rejects a caller who is not admin/super_admin for the org", async () => {
  const supabase = testClient();
  const noAuthorityEmail = `no-authority-${crypto.randomUUID()}@example.com`;
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: noAuthorityEmail,
    email_confirm: true,
  });
  if (authError || !authUser.user) {
    throw new Error(`failed to create auth user: ${authError?.message}`);
  }

  const { data: staff } = await supabase.from("staff").insert({
    auth_user_id: authUser.user.id,
    full_name: "No Authority",
    email: noAuthorityEmail,
  }).select("id").single();

  const { data: org } = await supabase.from("organizations").insert({
    name: "Forbidden Test Org",
    slug: `forbidden-${crypto.randomUUID()}`,
  }).select("id").single();

  await assertRejects(
    () =>
      createStaff(supabase, staff!.id, false, {
        fullName: "New Staff",
        email: `blocked-${crypto.randomUUID()}@example.com`,
        organizationId: org!.id,
      }),
    Error,
    "forbidden",
  );
});

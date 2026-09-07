import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { updateOrganization } from "./handler.ts";

function testClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

async function setup() {
  const supabase = testClient();
  const { data: org } = await supabase.from("organizations").insert({
    name: "UO Org", slug: `uo-${crypto.randomUUID()}`,
  }).select("id").single();
  const email = `uo-admin-${crypto.randomUUID()}@example.com`;
  const { data: aAuth } = await supabase.auth.admin.createUser({ email, email_confirm: true });
  const { data: admin } = await supabase.from("staff").insert({
    auth_user_id: aAuth!.user!.id, full_name: "UO Admin", email,
  }).select("id").single();
  await supabase.from("staff_org_roles").insert({ staff_id: admin!.id, organization_id: org!.id, org_tier: "admin" });
  return { supabase, orgId: org!.id as string, adminId: admin!.id as string };
}

Deno.test("updateOrganization persists branding for an org admin", async () => {
  const { supabase, orgId, adminId } = await setup();
  await updateOrganization(supabase, adminId, false, {
    organizationId: orgId, name: "UO Org Renamed",
    brandColor: "#123ABC", logoUrl: "https://x/logo.png", about: "We help.",
  });
  const { data: org } = await supabase.from("organizations")
    .select("name, brand_color, logo_url, about").eq("id", orgId).single();
  assertEquals(org!.name, "UO Org Renamed");
  assertEquals(org!.brand_color, "#123ABC");
  assertEquals(org!.logo_url, "https://x/logo.png");
  assertEquals(org!.about, "We help.");
});

Deno.test("updateOrganization rejects a non-admin caller", async () => {
  const { supabase, orgId } = await setup();
  const outEmail = `uo-out-${crypto.randomUUID()}@example.com`;
  const { data: oAuth } = await supabase.auth.admin.createUser({ email: outEmail, email_confirm: true });
  const { data: outsider } = await supabase.from("staff").insert({
    auth_user_id: oAuth!.user!.id, full_name: "Out", email: outEmail,
  }).select("id").single();
  await assertRejects(
    () => updateOrganization(supabase, outsider!.id, false, { organizationId: orgId, name: "X" }),
    Error, "forbidden",
  );
});

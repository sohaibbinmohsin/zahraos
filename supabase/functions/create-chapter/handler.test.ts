import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { createChapter } from "./handler.ts";

function testClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

async function setup() {
  const supabase = testClient();
  const { data: org } = await supabase.from("organizations").insert({
    name: "CreateChap Org", slug: `cc-${crypto.randomUUID()}`,
  }).select("id").single();

  const adminEmail = `cc-admin-${crypto.randomUUID()}@example.com`;
  const { data: aAuth } = await supabase.auth.admin.createUser({ email: adminEmail, email_confirm: true });
  const { data: admin } = await supabase.from("staff").insert({
    auth_user_id: aAuth!.user!.id, full_name: "CC Admin", email: adminEmail,
  }).select("id").single();
  await supabase.from("staff_org_roles").insert({ staff_id: admin!.id, organization_id: org!.id, org_tier: "admin" });
  return { supabase, orgId: org!.id as string, adminId: admin!.id as string };
}

Deno.test("createChapter inserts a chapter and writes an audit row", async () => {
  const { supabase, orgId, adminId } = await setup();
  const result = await createChapter(supabase, adminId, false, { organizationId: orgId, name: "Rizq LUMS", city: "Lahore" });

  const { data: chapter } = await supabase.from("chapters").select("name, city, status").eq("id", result.chapterId).single();
  assertEquals(chapter!.name, "Rizq LUMS");
  assertEquals(chapter!.city, "Lahore");
  assertEquals(chapter!.status, "active");

  const { data: audit } = await supabase.from("admin_audit_log").select("action")
    .eq("organization_id", orgId).eq("entity_id", result.chapterId).single();
  assertEquals(audit!.action, "Chapter Created");
});

Deno.test("createChapter rejects a duplicate name for the same org", async () => {
  const { supabase, orgId, adminId } = await setup();
  await createChapter(supabase, adminId, false, { organizationId: orgId, name: "Rizq LUMS" });
  await assertRejects(
    () => createChapter(supabase, adminId, false, { organizationId: orgId, name: "Rizq LUMS" }),
    Error, "chapter_name_taken",
  );
});

Deno.test("createChapter rejects a non-admin caller", async () => {
  const { supabase, orgId } = await setup();
  const outEmail = `cc-out-${crypto.randomUUID()}@example.com`;
  const { data: oAuth } = await supabase.auth.admin.createUser({ email: outEmail, email_confirm: true });
  const { data: outsider } = await supabase.from("staff").insert({
    auth_user_id: oAuth!.user!.id, full_name: "Out", email: outEmail,
  }).select("id").single();
  await assertRejects(
    () => createChapter(supabase, outsider!.id, false, { organizationId: orgId, name: "X" }),
    Error, "forbidden",
  );
});

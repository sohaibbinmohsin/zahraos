import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { updateChapter } from "./handler.ts";
import { createChapter } from "../create-chapter/handler.ts";

function testClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

async function setup() {
  const supabase = testClient();
  const { data: org } = await supabase.from("organizations").insert({
    name: "UpdChap Org", slug: `uc-${crypto.randomUUID()}`,
  }).select("id").single();
  const email = `uc-admin-${crypto.randomUUID()}@example.com`;
  const { data: aAuth } = await supabase.auth.admin.createUser({ email, email_confirm: true });
  const { data: admin } = await supabase.from("staff").insert({
    auth_user_id: aAuth!.user!.id, full_name: "UC Admin", email,
  }).select("id").single();
  await supabase.from("staff_org_roles").insert({ staff_id: admin!.id, organization_id: org!.id, org_tier: "admin" });
  const { chapterId } = await createChapter(supabase, admin!.id, false, { organizationId: org!.id, name: "Old Name" });
  return { supabase, orgId: org!.id as string, adminId: admin!.id as string, chapterId };
}

Deno.test("updateChapter renames the chapter, rewrites assignment scope_label, and audits", async () => {
  const { supabase, orgId, adminId, chapterId } = await setup();

  // an assignment scoped to this chapter with the stale label
  const { data: mod } = await supabase.from("modules").select("id").eq("key", "youth-republic").single();
  await supabase.from("org_modules").upsert({ organization_id: orgId, module_id: mod!.id });
  await supabase.rpc("seed_youth_republic_system_roles", { p_org_id: orgId, p_module_id: mod!.id });
  const { data: role } = await supabase.from("roles").select("id")
    .eq("organization_id", orgId).eq("name", "Operations Lead").single();
  const memEmail = `uc-mem-${crypto.randomUUID()}@example.com`;
  const { data: mAuth } = await supabase.auth.admin.createUser({ email: memEmail, email_confirm: true });
  const { data: member } = await supabase.from("staff").insert({
    auth_user_id: mAuth!.user!.id, full_name: "Mem", email: memEmail,
  }).select("id").single();
  await supabase.from("staff_role_assignments").insert({
    staff_id: member!.id, organization_id: orgId, module_id: mod!.id, role_id: role!.id,
    scope_kind: "chapter", chapter_id: chapterId, scope_label: "Old Name",
  });

  await updateChapter(supabase, adminId, false, { chapterId, name: "New Name", status: "inactive" });

  const { data: chapter } = await supabase.from("chapters").select("name, status").eq("id", chapterId).single();
  assertEquals(chapter!.name, "New Name");
  assertEquals(chapter!.status, "inactive");

  const { data: assign } = await supabase.from("staff_role_assignments").select("scope_label")
    .eq("chapter_id", chapterId).single();
  assertEquals(assign!.scope_label, "New Name");

  const { data: audit } = await supabase.from("admin_audit_log").select("action")
    .eq("entity_id", chapterId).eq("action", "Chapter Updated").single();
  assertEquals(audit!.action, "Chapter Updated");
});

Deno.test("updateChapter authorizes against the chapter's stored org (cross-org admin rejected)", async () => {
  const { supabase, chapterId } = await setup();
  const otherEmail = `uc-other-${crypto.randomUUID()}@example.com`;
  const { data: oAuth } = await supabase.auth.admin.createUser({ email: otherEmail, email_confirm: true });
  const { data: other } = await supabase.from("staff").insert({
    auth_user_id: oAuth!.user!.id, full_name: "Other", email: otherEmail,
  }).select("id").single();
  const { data: otherOrg } = await supabase.from("organizations").insert({
    name: "Other Org", slug: `oo-${crypto.randomUUID()}`,
  }).select("id").single();
  await supabase.from("staff_org_roles").insert({ staff_id: other!.id, organization_id: otherOrg!.id, org_tier: "admin" });
  await assertRejects(
    () => updateChapter(supabase, other!.id, false, { chapterId, name: "Hax" }),
    Error, "forbidden",
  );
});

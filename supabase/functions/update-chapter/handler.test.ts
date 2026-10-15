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

Deno.test("updateChapter allows Chapter Admin to update their assigned chapter, updates logo and roster", async () => {
  const { supabase, orgId, chapterId } = await setup();
  const cAdminEmail = `uc-cadmin-${crypto.randomUUID()}@example.com`;
  const { data: caAuth } = await supabase.auth.admin.createUser({ email: cAdminEmail, email_confirm: true });
  const { data: cAdmin } = await supabase.from("staff").insert({
    auth_user_id: caAuth!.user!.id, full_name: "Chapter Admin", email: cAdminEmail,
  }).select("id").single();

  const { data: mod } = await supabase.from("modules").select("id").eq("key", "youth-republic").single();
  await supabase.from("org_modules").upsert({ organization_id: orgId, module_id: mod!.id });
  await supabase.rpc("seed_youth_republic_system_roles", { p_org_id: orgId, p_module_id: mod!.id });
  const { data: orgAdminRole } = await supabase.from("roles").select("id")
    .eq("organization_id", orgId).eq("name", "Org Admin").single();

  // Assign Chapter Admin to this chapter
  await supabase.from("staff_role_assignments").insert({
    staff_id: cAdmin!.id, organization_id: orgId, module_id: mod!.id, role_id: orgAdminRole!.id,
    scope_kind: "chapter", chapter_id: chapterId, scope_label: "Old Name",
  });

  await updateChapter(supabase, cAdmin!.id, false, {
    chapterId,
    logoUrl: "https://example.com/chapter-logo.png",
    about: "About this chapter",
    teamMembers: [
      {
        volunteerCode: "YR-2026-000100",
        fullName: "Test Member",
        designation: "Lead",
        term: "2025–2026",
        status: "active",
      },
    ],
  });

  const { data: chapter } = await supabase.from("chapters").select("logo_url, about").eq("id", chapterId).single();
  assertEquals(chapter!.logo_url, "https://example.com/chapter-logo.png");
  assertEquals(chapter!.about, "About this chapter");

  const { data: members } = await supabase.from("chapter_team_members").select("volunteer_code, full_name, designation")
    .eq("chapter_id", chapterId);
  assertEquals(members!.length, 1);
  assertEquals(members![0].volunteer_code, "YR-2026-000100");
});

Deno.test("updateChapter: allows Chapter Lead to update details and roster of assigned chapter", async () => {
  const { supabase, orgId, chapterId } = await setup();
  const clEmail = `uc-cl-${crypto.randomUUID()}@example.com`;
  const { data: clAuth } = await supabase.auth.admin.createUser({ email: clEmail, email_confirm: true });
  const { data: clStaff } = await supabase.from("staff").insert({
    auth_user_id: clAuth!.user!.id, full_name: "Chapter Lead", email: clEmail,
  }).select("id").single();

  const { data: mod } = await supabase.from("modules").select("id").eq("key", "youth-republic").single();
  await supabase.from("org_modules").upsert({ organization_id: orgId, module_id: mod!.id });
  await supabase.rpc("seed_youth_republic_system_roles", { p_org_id: orgId, p_module_id: mod!.id });
  const { data: clRole } = await supabase.from("roles").select("id")
    .eq("organization_id", orgId).eq("name", "Chapter Lead").single();

  await supabase.from("staff_role_assignments").insert({
    staff_id: clStaff!.id, organization_id: orgId, module_id: mod!.id, role_id: clRole!.id,
    scope_kind: "chapter", chapter_id: chapterId, scope_label: "Old Name",
  });

  await updateChapter(supabase, clStaff!.id, false, {
    chapterId,
    about: "Chapter Lead description",
    teamMembers: [
      {
        volunteerCode: "YR-2026-000200",
        fullName: "Roster Member",
        designation: "Member",
        term: "2025–2026",
        status: "active",
      },
    ],
  });

  const { data: chapter } = await supabase.from("chapters").select("about").eq("id", chapterId).single();
  assertEquals(chapter!.about, "Chapter Lead description");
});

Deno.test("updateChapter: allows City Lead to update any of their assigned chapters", async () => {
  const { supabase, orgId, adminId, chapterId } = await setup();
  const { chapterId: chapterId2 } = await createChapter(supabase, adminId, false, { organizationId: orgId, name: "Chapter 2" });

  const cityEmail = `uc-city-${crypto.randomUUID()}@example.com`;
  const { data: cAuth } = await supabase.auth.admin.createUser({ email: cityEmail, email_confirm: true });
  const { data: cityStaff } = await supabase.from("staff").insert({
    auth_user_id: cAuth!.user!.id, full_name: "City Lead", email: cityEmail,
  }).select("id").single();

  const { data: mod } = await supabase.from("modules").select("id").eq("key", "youth-republic").single();
  await supabase.from("org_modules").upsert({ organization_id: orgId, module_id: mod!.id });
  await supabase.rpc("seed_youth_republic_system_roles", { p_org_id: orgId, p_module_id: mod!.id });
  const { data: cityRole } = await supabase.from("roles").select("id")
    .eq("organization_id", orgId).eq("name", "City Lead").single();

  await supabase.from("staff_role_assignments").insert([
    {
      staff_id: cityStaff!.id, organization_id: orgId, module_id: mod!.id, role_id: cityRole!.id,
      scope_kind: "chapter", chapter_id: chapterId, scope_label: "Old Name",
    },
    {
      staff_id: cityStaff!.id, organization_id: orgId, module_id: mod!.id, role_id: cityRole!.id,
      scope_kind: "chapter", chapter_id: chapterId2, scope_label: "Chapter 2",
    },
  ]);

  await updateChapter(supabase, cityStaff!.id, false, { chapterId, about: "Updated Chapter 1" });
  await updateChapter(supabase, cityStaff!.id, false, { chapterId: chapterId2, about: "Updated Chapter 2" });

  const { data: ch1 } = await supabase.from("chapters").select("about").eq("id", chapterId).single();
  const { data: ch2 } = await supabase.from("chapters").select("about").eq("id", chapterId2).single();
  assertEquals(ch1!.about, "Updated Chapter 1");
  assertEquals(ch2!.about, "Updated Chapter 2");
});

Deno.test("updateChapter: forbids Chapter Lead/City Lead from updating an unassigned chapter", async () => {
  const { supabase, orgId, adminId, chapterId } = await setup();
  const { chapterId: unassignedChapterId } = await createChapter(supabase, adminId, false, { organizationId: orgId, name: "Unassigned Chapter" });

  const clEmail = `uc-cl-unass-${crypto.randomUUID()}@example.com`;
  const { data: clAuth } = await supabase.auth.admin.createUser({ email: clEmail, email_confirm: true });
  const { data: clStaff } = await supabase.from("staff").insert({
    auth_user_id: clAuth!.user!.id, full_name: "Chapter Lead", email: clEmail,
  }).select("id").single();

  const { data: mod } = await supabase.from("modules").select("id").eq("key", "youth-republic").single();
  await supabase.from("org_modules").upsert({ organization_id: orgId, module_id: mod!.id });
  await supabase.rpc("seed_youth_republic_system_roles", { p_org_id: orgId, p_module_id: mod!.id });
  const { data: clRole } = await supabase.from("roles").select("id")
    .eq("organization_id", orgId).eq("name", "Chapter Lead").single();

  await supabase.from("staff_role_assignments").insert({
    staff_id: clStaff!.id, organization_id: orgId, module_id: mod!.id, role_id: clRole!.id,
    scope_kind: "chapter", chapter_id: chapterId, scope_label: "Assigned Chapter",
  });

  await assertRejects(
    () => updateChapter(supabase, clStaff!.id, false, { chapterId: unassignedChapterId, about: "Hacker" }),
    Error, "forbidden",
  );
});

Deno.test("updateChapter: forbids Chapter Lead/City Lead from deactivating a chapter", async () => {
  const { supabase, orgId, chapterId } = await setup();
  const clEmail = `uc-cl-deact-${crypto.randomUUID()}@example.com`;
  const { data: clAuth } = await supabase.auth.admin.createUser({ email: clEmail, email_confirm: true });
  const { data: clStaff } = await supabase.from("staff").insert({
    auth_user_id: clAuth!.user!.id, full_name: "Chapter Lead", email: clEmail,
  }).select("id").single();

  const { data: mod } = await supabase.from("modules").select("id").eq("key", "youth-republic").single();
  await supabase.from("org_modules").upsert({ organization_id: orgId, module_id: mod!.id });
  await supabase.rpc("seed_youth_republic_system_roles", { p_org_id: orgId, p_module_id: mod!.id });
  const { data: clRole } = await supabase.from("roles").select("id")
    .eq("organization_id", orgId).eq("name", "Chapter Lead").single();

  await supabase.from("staff_role_assignments").insert({
    staff_id: clStaff!.id, organization_id: orgId, module_id: mod!.id, role_id: clRole!.id,
    scope_kind: "chapter", chapter_id: chapterId, scope_label: "Assigned Chapter",
  });

  await assertRejects(
    () => updateChapter(supabase, clStaff!.id, false, { chapterId, status: "inactive" }),
    Error, "forbidden_status_change",
  );
});


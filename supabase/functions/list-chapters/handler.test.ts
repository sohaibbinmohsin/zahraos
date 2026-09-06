import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { listChapters } from "./handler.ts";
import { createChapter } from "../create-chapter/handler.ts";

function testClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

Deno.test("listChapters returns the org's chapters ordered by name", async () => {
  const supabase = testClient();
  const { data: org } = await supabase.from("organizations").insert({
    name: "ListChap Org", slug: `lc-${crypto.randomUUID()}`,
  }).select("id").single();
  const email = `lc-admin-${crypto.randomUUID()}@example.com`;
  const { data: aAuth } = await supabase.auth.admin.createUser({ email, email_confirm: true });
  const { data: admin } = await supabase.from("staff").insert({
    auth_user_id: aAuth!.user!.id, full_name: "LC Admin", email,
  }).select("id").single();
  await supabase.from("staff_org_roles").insert({ staff_id: admin!.id, organization_id: org!.id, org_tier: "admin" });

  await createChapter(supabase, admin!.id, false, { organizationId: org!.id, name: "Rizq NUST" });
  await createChapter(supabase, admin!.id, false, { organizationId: org!.id, name: "Rizq LUMS" });

  const result = await listChapters(supabase, admin!.id, false, { organizationId: org!.id });
  assertEquals(result.chapters.map((c) => c.name), ["Rizq LUMS", "Rizq NUST"]);

  const outEmail = `lc-out-${crypto.randomUUID()}@example.com`;
  const { data: oAuth } = await supabase.auth.admin.createUser({ email: outEmail, email_confirm: true });
  const { data: outsider } = await supabase.from("staff").insert({
    auth_user_id: oAuth!.user!.id, full_name: "Out", email: outEmail,
  }).select("id").single();
  await assertRejects(
    () => listChapters(supabase, outsider!.id, false, { organizationId: org!.id }),
    Error, "forbidden",
  );
});

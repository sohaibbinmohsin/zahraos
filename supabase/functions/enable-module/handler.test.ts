import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { enableModule } from "./handler.ts";

function testClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

Deno.test("enableModule enables the module and seeds system roles", async () => {
  const supabase = testClient();
  const { data: org } = await supabase.from("organizations").insert({
    name: "Enable Module Test",
    slug: `enable-module-${crypto.randomUUID()}`,
  }).select("id").single();

  const result = await enableModule(supabase, true, { organizationId: org!.id, moduleKey: "vms" });

  assertEquals(result.moduleKey, "vms");

  const { data: roles } = await supabase.from("roles").select("name").eq("organization_id", org!.id);
  assertEquals((roles ?? []).map((r) => r.name).sort(), ["Editor", "Viewer"]);
});

Deno.test("enableModule rejects a non-platform_owner caller", async () => {
  const supabase = testClient();
  const { data: org } = await supabase.from("organizations").insert({
    name: "Enable Module Forbidden Test",
    slug: `enable-module-forbidden-${crypto.randomUUID()}`,
  }).select("id").single();

  await assertRejects(
    () => enableModule(supabase, false, { organizationId: org!.id, moduleKey: "vms" }),
    Error,
    "forbidden",
  );
});

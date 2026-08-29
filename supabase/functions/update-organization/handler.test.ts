import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { updateOrganization } from "./handler.ts";

function testClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

Deno.test("updateOrganization renames the org and reports which modules need a re-sync", async () => {
  const supabase = testClient();
  const { data: org } = await supabase.from("organizations").insert({
    name: "Old Name",
    slug: `update-test-${crypto.randomUUID()}`,
  }).select("id").single();

  const { data: vmsModule } = await supabase.from("modules").select("id").eq("key", "vms").single();
  await supabase.from("org_modules").insert({ organization_id: org!.id, module_id: vmsModule!.id });

  const result = await updateOrganization(supabase, true, { organizationId: org!.id, name: "New Name" });

  assertEquals(result.enabledModuleKeys, ["vms"]);
  const { data: updated } = await supabase.from("organizations").select("name").eq("id", org!.id).single();
  assertEquals(updated!.name, "New Name");
});

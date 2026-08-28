import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { createOrganization } from "./handler.ts";

function testClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

Deno.test("createOrganization creates an org when the caller is platform_owner", async () => {
  const supabase = testClient();
  const result = await createOrganization(supabase, true, { name: "Rizq", slug: `rizq-${crypto.randomUUID()}` });
  assertEquals(typeof result.organizationId, "string");
});

Deno.test("createOrganization rejects a non-platform_owner caller", async () => {
  const supabase = testClient();
  await assertRejects(
    () => createOrganization(supabase, false, { name: "Blocked Org", slug: `blocked-${crypto.randomUUID()}` }),
    Error,
    "forbidden",
  );
});

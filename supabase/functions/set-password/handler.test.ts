import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { setPassword } from "./handler.ts";

function testClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

Deno.test("setPassword clears must_change_password", async () => {
  const supabase = testClient();
  const { data: authUser } = await supabase.auth.admin.createUser({
    email: `set-password-${crypto.randomUUID()}@example.com`,
    password: "Temporary-Password-1!",
    email_confirm: true,
  });

  const { data: staff } = await supabase.from("staff").insert({
    auth_user_id: authUser!.user!.id,
    full_name: "Set Password Test",
    email: authUser!.user!.email,
    must_change_password: true,
  }).select("id").single();

  const result = await setPassword(supabase, staff!.id, authUser!.user!.id, "Brand-New-Password-2!");

  assertEquals(result.staffId, staff!.id);

  const { data: updated } = await supabase.from("staff").select("must_change_password").eq("id", staff!.id).single();
  assertEquals(updated!.must_change_password, false);
});

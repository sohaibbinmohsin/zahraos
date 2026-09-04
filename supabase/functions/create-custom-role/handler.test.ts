import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { createCustomRole } from "./handler.ts";
import { permissionKeysToGrid } from "../_shared/capabilityMap.ts";

function testClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

async function setup() {
  const supabase = testClient();
  const { data: org } = await supabase.from("organizations").insert({
    name: "CCR Org", slug: `ccr-${crypto.randomUUID()}`,
  }).select("id").single();
  const { data: mod } = await supabase.from("modules").select("id").eq("key", "youth-republic").single();
  await supabase.from("org_modules").insert({ organization_id: org!.id, module_id: mod!.id });
  await supabase.rpc("seed_youth_republic_system_roles", { p_org_id: org!.id, p_module_id: mod!.id });

  const adminEmail = `ccr-admin-${crypto.randomUUID()}@example.com`;
  const { data: aAuth } = await supabase.auth.admin.createUser({ email: adminEmail, email_confirm: true });
  const { data: admin } = await supabase.from("staff").insert({
    auth_user_id: aAuth!.user!.id, full_name: "CCR Admin", email: adminEmail,
  }).select("id").single();
  await supabase.from("staff_org_roles").insert({ staff_id: admin!.id, organization_id: org!.id, org_tier: "admin" });
  return { supabase, orgId: org!.id as string, moduleId: mod!.id as string, adminId: admin!.id as string };
}

Deno.test("createCustomRole stores the capability grid as role_permissions rows", async () => {
  const { supabase, orgId, moduleId, adminId } = await setup();
  const result = await createCustomRole(supabase, adminId, false, {
    organizationId: orgId, moduleId, name: "Regional Logistics Lead",
    description: "Coordinates warehouse inventory and regional dispatch.",
    capabilities: { drive: "granted", publish: "restricted", triage: "restricted", hours: "granted", team: "restricted" },
  });

  const { data: role } = await supabase.from("roles")
    .select("is_system, description").eq("id", result.roleId).single();
  assertEquals(role!.is_system, false);
  assertEquals(role!.description, "Coordinates warehouse inventory and regional dispatch.");

  const { data: perms } = await supabase.from("role_permissions")
    .select("permissions(resource, action)").eq("role_id", result.roleId);
  const keys = (perms ?? []).map((p) => {
    const perm = p.permissions as unknown as { resource: string; action: string };
    return `${perm.resource}:${perm.action}`;
  }).sort();
  assertEquals(keys, ["hours:read", "hours:update", "opportunities:write"]);
  assertEquals(permissionKeysToGrid(keys).hours, "granted");
});

Deno.test("createCustomRole rejects a non-admin caller", async () => {
  const { supabase, orgId, moduleId } = await setup();
  const outEmail = `ccr-out-${crypto.randomUUID()}@example.com`;
  const { data: oAuth } = await supabase.auth.admin.createUser({ email: outEmail, email_confirm: true });
  const { data: outsider } = await supabase.from("staff").insert({
    auth_user_id: oAuth!.user!.id, full_name: "Out", email: outEmail,
  }).select("id").single();
  await assertRejects(
    () => createCustomRole(supabase, outsider!.id, false, {
      organizationId: orgId, moduleId, name: "X", description: "",
      capabilities: { drive: "restricted", publish: "restricted", triage: "restricted", hours: "restricted", team: "restricted" },
    }),
    Error, "forbidden",
  );
});

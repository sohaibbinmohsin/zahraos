// Shared fixtures for the index.ts wrapper-layer tests added alongside the
// "no CORS handling" fix. Not a test file itself (no *.test.ts / *_test.ts
// suffix), so `deno task test` never picks it up as a suite on its own —
// it only exists to keep the 9 index.test.ts files from each re-deriving
// the same real-Supabase fixture boilerplate that handler.test.ts files in
// this repo already duplicate per file.
import { createClient, SupabaseClient } from "@supabase/supabase-js";

export function adminTestClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

export async function createOrg(supabase: SupabaseClient): Promise<string> {
  const { data } = await supabase.from("organizations").insert({
    name: "CORS Test Org",
    slug: `cors-org-${crypto.randomUUID()}`,
  }).select("id").single();
  return data!.id as string;
}

export interface TestStaffSession {
  staffId: string;
  authUserId: string;
  accessToken: string;
  email: string;
}

// Creates a real auth.users row with a password, a matching staff row, and
// signs in as that user to get a genuinely live access token — the same
// live-probe pattern used for deactivate-staff's session-revocation test —
// so the index.ts wrapper's real verifyPlatformStaffSession call has a real
// session to authenticate, not a mock.
export async function createStaffSession(
  supabase: SupabaseClient,
  options: { platformOwner?: boolean } = {},
): Promise<TestStaffSession> {
  const email = `cors-${crypto.randomUUID()}@example.com`;
  const password = "Cors-Test-Password-1!";
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (authError || !authUser.user) {
    throw new Error(`failed to create auth user: ${authError?.message}`);
  }
  const { data: staff } = await supabase.from("staff").insert({
    auth_user_id: authUser.user.id,
    full_name: "CORS Test Staff",
    email,
    platform_owner: options.platformOwner ?? false,
  }).select("id").single();

  const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
  const { data: signIn, error: signInError } = await anon.auth.signInWithPassword({ email, password });
  if (signInError || !signIn.session) {
    throw new Error(`failed to sign in test staff member: ${signInError?.message}`);
  }

  return {
    staffId: staff!.id as string,
    authUserId: authUser.user.id,
    accessToken: signIn.session.access_token,
    email,
  };
}

export async function grantOrgTier(
  supabase: SupabaseClient,
  staffId: string,
  organizationId: string,
  orgTier: "admin" | "super_admin",
): Promise<void> {
  await supabase.from("staff_org_roles").insert({ staff_id: staffId, organization_id: organizationId, org_tier: orgTier });
}

// Enables the vms module for an org and seeds its system roles, returning
// the module's id — the precondition assign-staff-module-role,
// create-custom-role, and deactivate-staff's affiliation check all need.
export async function enableVmsModule(supabase: SupabaseClient, organizationId: string): Promise<string> {
  const { data: vmsModule } = await supabase.from("modules").select("id").eq("key", "vms").single();
  await supabase.from("org_modules").upsert({ organization_id: organizationId, module_id: vmsModule!.id });
  await supabase.rpc("seed_system_roles_for_module", { p_org_id: organizationId, p_module_id: vmsModule!.id });
  return vmsModule!.id as string;
}

export async function grantModuleAffiliation(
  supabase: SupabaseClient,
  staffId: string,
  organizationId: string,
): Promise<void> {
  const moduleId = await enableVmsModule(supabase, organizationId);
  const { data: viewerRole } = await supabase.from("roles").select("id").eq("organization_id", organizationId).eq(
    "name",
    "Viewer",
  ).single();
  await supabase.from("staff_module_roles").insert({
    staff_id: staffId,
    organization_id: organizationId,
    module_id: moduleId,
    role_id: viewerRole!.id,
  });
}

export function jsonRequest(body: unknown, accessToken?: string, method = "POST"): Request {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
  return new Request("https://example.com/fn", {
    method,
    headers,
    body: JSON.stringify(body),
  });
}

export function optionsRequest(): Request {
  return new Request("https://example.com/fn", { method: "OPTIONS" });
}

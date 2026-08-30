import { SupabaseClient } from "@supabase/supabase-js";
import { create, getNumericDate } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

interface ModuleAccessEntry {
  organization_id: string;
  module: string;
  permissions: string[];
}

async function signingKey(): Promise<CryptoKey> {
  const secret = Deno.env.get("STAFF_JWT_SECRET");
  if (!secret) throw new Error("STAFF_JWT_SECRET must be set");
  return await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

export async function mintStaffToken(
  supabase: SupabaseClient,
  staffId: string,
  platformOwner: boolean,
): Promise<string> {
  const { data: staffRow } = await supabase
    .from("staff")
    .select("can_verify_identity, platform_owner")
    .eq("id", staffId)
    .single();

  const { data: orgRoleRows } = await supabase
    .from("staff_org_roles")
    .select("organization_id, org_tier")
    .eq("staff_id", staffId);

  const superAdminOrgIds = (orgRoleRows ?? [])
    .filter((r) => r.org_tier === "super_admin")
    .map((r) => r.organization_id as string);

  const { data: moduleRoleRows } = await supabase
    .from("staff_module_roles")
    .select("organization_id, module_id, role_id")
    .eq("staff_id", staffId);

  const orgIds = new Set<string>([
    ...(orgRoleRows ?? []).map((r) => r.organization_id as string),
    ...(moduleRoleRows ?? []).map((r) => r.organization_id as string),
  ]);

  const moduleAccessMap = new Map<string, ModuleAccessEntry>();

  async function moduleKeyFor(moduleId: string): Promise<string> {
    const { data } = await supabase.from("modules").select("key").eq("id", moduleId).single();
    return data!.key as string;
  }

  function addPermissions(organizationId: string, moduleKey: string, permissions: string[]) {
    const key = `${organizationId}:${moduleKey}`;
    const existing = moduleAccessMap.get(key);
    if (existing) {
      existing.permissions = Array.from(new Set([...existing.permissions, ...permissions]));
    } else {
      moduleAccessMap.set(key, { organization_id: organizationId, module: moduleKey, permissions: [...new Set(permissions)] });
    }
  }

  for (const orgId of superAdminOrgIds) {
    const { data: enabledModules } = await supabase.from("org_modules").select("module_id").eq("organization_id", orgId);
    for (const row of enabledModules ?? []) {
      const moduleKey = await moduleKeyFor(row.module_id as string);
      const { data: perms } = await supabase
        .from("permissions")
        .select("resource, action")
        .eq("module_id", row.module_id);
      addPermissions(orgId, moduleKey, (perms ?? []).map((p) => `${p.resource}:${p.action}`));
    }
  }

  for (const row of moduleRoleRows ?? []) {
    const moduleKey = await moduleKeyFor(row.module_id as string);
    const { data: rolePerms } = await supabase
      .from("role_permissions")
      .select("permissions(resource, action)")
      .eq("role_id", row.role_id);
    const permissions = (rolePerms ?? []).map((rp) => {
      const p = rp.permissions as unknown as { resource: string; action: string };
      return `${p.resource}:${p.action}`;
    });
    addPermissions(row.organization_id as string, moduleKey, permissions);
  }

  const key = await signingKey();
  return await create(
    { alg: "HS256", typ: "JWT" },
    {
      exp: getNumericDate(60 * 60),
      actor_type: "staff",
      staff_id: staffId,
      platform_owner: platformOwner,
      can_verify_identity: Boolean(staffRow?.can_verify_identity || staffRow?.platform_owner),
      org_roles: Array.from(orgIds).map((organizationId) => ({ organization_id: organizationId })),
      module_access: Array.from(moduleAccessMap.values()),
    },
    key,
  );
}

import { SupabaseClient } from "@supabase/supabase-js";
import { create, getNumericDate } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

interface ModuleAccessEntry {
  organization_id: string;
  module: string;
  permissions: string[];
  chapter_scopes?: Record<string, string[]>;
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
    .select("can_verify_identity, platform_owner, status, expires_at")
    .eq("id", staffId)
    .single();
  if (
    !staffRow ||
    staffRow.status !== "active" ||
    (staffRow.expires_at && new Date(staffRow.expires_at as string).getTime() < Date.now())
  ) {
    throw new Error("unauthorized");
  }

  const { data: orgRoleRows } = await supabase
    .from("staff_org_roles")
    .select("organization_id, org_tier")
    .eq("staff_id", staffId);

  const superAdminOrgIds = (orgRoleRows ?? [])
    .filter((r) => r.org_tier === "super_admin")
    .map((r) => r.organization_id as string);

  const { data: assignmentRows } = await supabase
    .from("staff_role_assignments")
    .select("organization_id, module_id, role_id, scope_kind, chapter_id")
    .eq("staff_id", staffId);

  const orgIds = new Set<string>([
    ...(orgRoleRows ?? []).map((r) => r.organization_id as string),
    ...(assignmentRows ?? []).map((r) => r.organization_id as string),
  ]);

  const moduleAccessMap = new Map<string, ModuleAccessEntry>();

  // `${orgId}:${moduleKey}` -> Map<permissionKey, { anyOrgWide: boolean; chapters: Set<string> }>
  const keyScopes = new Map<string, Map<string, { anyOrgWide: boolean; chapters: Set<string> }>>();
  function notePermScope(
    orgId: string,
    moduleKey: string,
    permKey: string,
    row: { scope_kind: string; chapter_id: string | null },
  ) {
    const mapKey = `${orgId}:${moduleKey}`;
    let perKey = keyScopes.get(mapKey);
    if (!perKey) {
      perKey = new Map();
      keyScopes.set(mapKey, perKey);
    }
    let cur = perKey.get(permKey);
    if (!cur) {
      cur = { anyOrgWide: false, chapters: new Set<string>() };
      perKey.set(permKey, cur);
    }
    if (row.scope_kind === "org_wide") cur.anyOrgWide = true;
    else if (row.chapter_id) cur.chapters.add(row.chapter_id);
  }

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
      // super_admin: no notePermScope call -> keyScopes has no entry -> unrestricted.
    }
  }

  for (const row of assignmentRows ?? []) {
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
    for (const permKey of permissions) {
      notePermScope(
        row.organization_id as string,
        moduleKey,
        permKey,
        row as { scope_kind: string; chapter_id: string | null },
      );
    }
  }

  const moduleAccess = Array.from(moduleAccessMap.values()).map((entry) => {
    const perKey = keyScopes.get(`${entry.organization_id}:${entry.module}`);
    if (!perKey) return entry;
    const chapter_scopes: Record<string, string[]> = {};
    for (const [permKey, scope] of perKey) {
      if (!scope.anyOrgWide && scope.chapters.size > 0) {
        chapter_scopes[permKey] = Array.from(scope.chapters);
      }
    }
    return Object.keys(chapter_scopes).length > 0 ? { ...entry, chapter_scopes } : entry;
  });

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
      module_access: moduleAccess,
    },
    key,
  );
}

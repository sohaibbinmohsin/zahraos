import { NextRequest, NextResponse } from "next/server";
import { loadEnabledCatalogs } from "@/registry/loadEnabledCatalogs";
import { MODULE_REGISTRY } from "@/registry/modules";
import type { ModuleCatalog } from "@/registry/moduleCatalog";
import { callerBelongsToOrganization } from "@/lib/callerOrgAccess";
import { createPlatformAdminClient, resolvePlatformCaller } from "@/lib/resolvePlatformCaller";

async function fetchModuleCatalog(moduleKey: string, authHeader: string): Promise<ModuleCatalog> {
  const entry = MODULE_REGISTRY.find((row) => row.key === moduleKey);
  if (!entry?.functionsEnv) {
    throw new Error("module_catalog_unavailable");
  }

  const envValue =
    process.env[entry.functionsEnv] ??
  (moduleKey === "youth-republic"
      ? process.env.NEXT_PUBLIC_YOUTH_REPUBLIC_FUNCTIONS_URL
      : undefined);

  if (!envValue) {
    throw new Error("module_catalog_unavailable");
  }

  const response = await fetch(`${envValue}/get-module-catalog`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
    },
    body: "{}",
  });

  if (!response.ok) {
    throw new Error("module_catalog_unavailable");
  }

  return (await response.json()) as ModuleCatalog;
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "missing_authorization" }, { status: 401 });
  }
  const token = authHeader.slice("Bearer ".length).trim();

  const organizationId = request.nextUrl.searchParams.get("organizationId");
  if (!organizationId) {
    return NextResponse.json({ error: "missing_organization_id" }, { status: 400 });
  }

  const supabaseAdmin = createPlatformAdminClient();
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }

  const caller = await resolvePlatformCaller(supabaseAdmin, token);
  if (!caller) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const belongs = await callerBelongsToOrganization(
    supabaseAdmin,
    caller.staffId,
    organizationId,
    caller.platformOwner,
  );
  if (!belongs) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { data: orgModules, error: orgModulesError } = await supabaseAdmin
    .from("org_modules")
    .select("modules!inner(key)")
    .eq("organization_id", organizationId);

  if (orgModulesError) {
    return NextResponse.json({ error: "org_modules_lookup_failed" }, { status: 500 });
  }

  const enabledModuleKeys = (orgModules ?? []).map(
    (row) => (row as { modules: { key: string } }).modules.key,
  );

  try {
    const catalogs = await loadEnabledCatalogs(enabledModuleKeys, async (key) =>
      fetchModuleCatalog(key, authHeader),
    );
    return NextResponse.json({ catalogs });
  } catch {
    return NextResponse.json({ error: "module_catalog_unavailable" }, { status: 502 });
  }
}
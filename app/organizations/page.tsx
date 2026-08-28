"use client";

import { useCallback, useEffect, useState } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { OrganizationsList, type OrganizationSummary } from "@/components/OrganizationsList";
import { CreateOrganizationForm } from "@/components/CreateOrganizationForm";
import { ModuleEnablementPanel, type ModuleSummary } from "@/components/ModuleEnablementPanel";

export default function OrganizationsPage() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationSummary[]>([]);
  const [allModules, setAllModules] = useState<ModuleSummary[]>([]);
  const [enabledByOrg, setEnabledByOrg] = useState<Record<string, string[]>>({});
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = getBrowserSupabaseClient();
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) return;
    setAccessToken(sessionData.session.access_token);

    const { data: orgs } = await supabase.from("organizations").select("id, name, slug, status").order("created_at", { ascending: false });
    setOrganizations(orgs ?? []);

    const { data: modules } = await supabase.from("modules").select("id, key, display_name");
    setAllModules((modules ?? []).map((m) => ({ id: m.id, key: m.key, displayName: m.display_name })));

    const { data: orgModules } = await supabase.from("org_modules").select("organization_id, modules(key)");
    const grouped: Record<string, string[]> = {};
    for (const row of orgModules ?? []) {
      const key = (row.modules as unknown as { key: string }).key;
      grouped[row.organization_id] = [...(grouped[row.organization_id] ?? []), key];
    }
    setEnabledByOrg(grouped);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (!accessToken) {
    return <p>Loading…</p>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="mb-4 text-xl font-semibold">Organizations</h1>
        <OrganizationsList organizations={organizations} />
      </div>

      <div>
        <h2 className="mb-2 text-lg font-medium">Create organization</h2>
        <CreateOrganizationForm accessToken={accessToken} onCreated={load} />
      </div>

      <div>
        <h2 className="mb-2 text-lg font-medium">Module enablement</h2>
        <label htmlFor="orgForModules" className="block text-sm">Organization</label>
        <select
          id="orgForModules"
          className="mt-1 mb-4 rounded border px-3 py-2"
          value={selectedOrgId ?? ""}
          onChange={(e) => setSelectedOrgId(e.target.value || null)}
        >
          <option value="">Select an organization</option>
          {organizations.map((org) => (
            <option key={org.id} value={org.id}>{org.name}</option>
          ))}
        </select>

        {selectedOrgId && (
          <ModuleEnablementPanel
            organizationId={selectedOrgId}
            allModules={allModules}
            enabledModuleKeys={enabledByOrg[selectedOrgId] ?? []}
            accessToken={accessToken}
            onEnabled={load}
          />
        )}
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { fetchStaffToken } from "@/lib/staffToken";
import { listOpportunities, exportYouthRepublicCsv, type OpportunitySummary } from "@/lib/youthRepublicFunctions";
import { useSelectedOrg } from "@/components/shell/AppShell";
import { CreateOpportunityForm } from "@/components/youth-republic/CreateOpportunityForm";

export default function YouthRepublicOpportunitiesPage() {
  const organizationId = useSelectedOrg();
  const [opportunities, setOpportunities] = useState<OpportunitySummary[]>([]);
  const [staffToken, setStaffToken] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!organizationId) return;
    const supabase = getBrowserSupabaseClient();
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) return;
    const token = await fetchStaffToken(sessionData.session.access_token);
    setStaffToken(token);
    const result = await listOpportunities({ organizationId }, token);
    setOpportunities(result.opportunities);
  }, [organizationId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleExport() {
    if (!organizationId || !staffToken) return;
    const csv = await exportYouthRepublicCsv({ organizationId, entity: "opportunities" }, staffToken);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "opportunities.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!organizationId) return <p>Select an organization to see its opportunities.</p>;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Opportunities</h1>
        <button type="button" onClick={handleExport} className="rounded border px-3 py-1.5 text-sm">
          Export CSV
        </button>
      </div>

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-gray-600">
            <th className="py-2 pr-4">Name</th>
            <th className="py-2 pr-4">Type</th>
            <th className="py-2 pr-4">Status</th>
            <th className="py-2 pr-4">Capacity</th>
          </tr>
        </thead>
        <tbody>
          {opportunities.map((o) => (
            <tr key={o.id} className="border-b border-gray-100">
              <td className="py-2 pr-4">{o.name}</td>
              <td className="py-2 pr-4">{o.type}</td>
              <td className="py-2 pr-4">{o.computedStatus}</td>
              <td className="py-2 pr-4">{o.capacity ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div>
        <h2 className="mb-2 text-lg font-medium">Create opportunity</h2>
        {staffToken && <CreateOpportunityForm organizationId={organizationId} staffToken={staffToken} onCreated={load} />}
      </div>
    </div>
  );
}

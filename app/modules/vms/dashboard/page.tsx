"use client";

import { useEffect, useState } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { fetchStaffToken } from "@/lib/staffToken";
import { getKpiSummary, type KpiSummary } from "@/lib/vmsFunctions";
import { useSelectedOrg } from "@/components/shell/AppShell";

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-gray-200 p-4">
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-sm text-gray-600">{label}</p>
    </div>
  );
}

function BreakdownList({ title, counts }: { title: string; counts: Record<string, number> }) {
  const entries = Object.entries(counts);
  return (
    <div>
      <h3 className="mb-2 text-sm font-medium text-gray-700">{title}</h3>
      {entries.length === 0 ? (
        <p className="text-sm text-gray-500">No data yet.</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {entries.map(([key, count]) => (
            <li key={key} className="flex justify-between">
              <span>{key}</span>
              <span>{count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function VmsDashboardPage() {
  const organizationId = useSelectedOrg();
  const [kpis, setKpis] = useState<KpiSummary | null>(null);

  useEffect(() => {
    async function load() {
      if (!organizationId) return;
      const supabase = getBrowserSupabaseClient();
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return;
      const staffToken = await fetchStaffToken(sessionData.session.access_token);
      const result = await getKpiSummary({ organizationId }, staffToken);
      setKpis(result);
    }
    load();
  }, [organizationId]);

  if (!organizationId) return <p>Select an organization to see its VMS dashboard.</p>;
  if (!kpis) return <p>Loading…</p>;

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold">VMS Dashboard</h1>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatTile label="Total registered" value={kpis.totalRegistered} />
        <StatTile label="Active" value={kpis.active} />
        <StatTile label="Completed participations" value={kpis.completedParticipations} />
        <StatTile label="Applications received" value={kpis.applicationsReceived} />
        <StatTile label="Selected" value={kpis.selected} />
        <StatTile label="Total verified hours" value={kpis.totalVerifiedHours} />
      </div>
      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
        <BreakdownList title="By city" counts={kpis.byCity} />
        <BreakdownList title="By province" counts={kpis.byProvince} />
        <BreakdownList title="By institution" counts={kpis.byInstitution} />
        <BreakdownList title="Participation by opportunity" counts={kpis.participationByOpportunity} />
        <BreakdownList title="Participation by activity type" counts={kpis.participationByActivityType} />
      </div>
    </div>
  );
}

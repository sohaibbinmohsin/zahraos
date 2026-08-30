"use client";

import { useCallback, useEffect, useState } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { fetchStaffToken } from "@/lib/staffToken";
import {
  listActivityHours,
  verifyHours,
  listOpportunities,
  listParticipationForOpportunity,
  exportYouthRepublicCsv,
  type ActivityListRow,
  type OpportunitySummary,
} from "@/lib/youthRepublicFunctions";
import { useSelectedOrg } from "@/components/shell/AppShell";
import { BulkAssignHoursForm, type ParticipantOption } from "@/components/youth-republic/BulkAssignHoursForm";

export default function YouthRepublicHoursPage() {
  const organizationId = useSelectedOrg();
  const [activity, setActivity] = useState<ActivityListRow[]>([]);
  const [opportunities, setOpportunities] = useState<OpportunitySummary[]>([]);
  const [selectedOpportunityId, setSelectedOpportunityId] = useState("");
  const [participants, setParticipants] = useState<ParticipantOption[]>([]);
  const [staffToken, setStaffToken] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!organizationId) return;
    const supabase = getBrowserSupabaseClient();
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) return;
    const token = await fetchStaffToken(sessionData.session.access_token);
    setStaffToken(token);
    const [hoursResult, opportunitiesResult] = await Promise.all([
      listActivityHours({ organizationId }, token),
      listOpportunities({ organizationId }, token),
    ]);
    setActivity(hoursResult.activity);
    setOpportunities(opportunitiesResult.opportunities);
  }, [organizationId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    async function loadParticipants() {
      if (!organizationId || !staffToken || !selectedOpportunityId) {
        setParticipants([]);
        return;
      }
      const result = await listParticipationForOpportunity(
        { organizationId, opportunityId: selectedOpportunityId },
        staffToken,
      );
      setParticipants(
        result.participants.map((p) => ({ participationId: p.participationId, volunteerName: p.volunteerName })),
      );
    }
    loadParticipants();
  }, [organizationId, staffToken, selectedOpportunityId]);

  async function handleVerify(activityHoursId: string, hoursSubmitted: number) {
    if (!staffToken) return;
    // decision is required — verifyHours has no separate reject endpoint,
    // this is always "verified" from this button (a reject action with a
    // reason is a separate, later concern, not built here).
    await verifyHours({ activityHoursId, decision: "verified", hoursVerified: hoursSubmitted }, staffToken);
    await load();
  }

  async function handleExport() {
    if (!organizationId || !staffToken) return;
    const csv = await exportYouthRepublicCsv({ organizationId, entity: "activity_hours" }, staffToken);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "activity_hours.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!organizationId) return <p>Select an organization to see its activity hours.</p>;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Hours</h1>
        <button type="button" onClick={handleExport} className="rounded border px-3 py-1.5 text-sm">
          Export CSV
        </button>
      </div>

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-gray-600">
            <th className="py-2 pr-4">Volunteer</th>
            <th className="py-2 pr-4">Opportunity</th>
            <th className="py-2 pr-4">Date</th>
            <th className="py-2 pr-4">Hours</th>
            <th className="py-2 pr-4">Status</th>
            <th className="py-2 pr-4">Actions</th>
          </tr>
        </thead>
        <tbody>
          {activity.map((a) => (
            <tr key={a.id} className="border-b border-gray-100">
              <td className="py-2 pr-4">{a.volunteerName}</td>
              <td className="py-2 pr-4">{a.opportunityName}</td>
              <td className="py-2 pr-4">{a.activityDate}</td>
              <td className="py-2 pr-4">{a.hoursVerified ?? a.hoursSubmitted}</td>
              <td className="py-2 pr-4">{a.verificationStatus}</td>
              <td className="py-2 pr-4">
                {a.verificationStatus === "recorded" && (
                  <button type="button" onClick={() => handleVerify(a.id, a.hoursSubmitted)} className="rounded border px-2 py-1 text-xs">
                    Verify
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div>
        <h2 className="mb-2 text-lg font-medium">Bulk-assign hours</h2>
        <label htmlFor="bulkOpportunity" className="block text-sm">Bulk-assign for opportunity</label>
        <select
          id="bulkOpportunity"
          className="mt-1 mb-3 rounded border px-3 py-2"
          value={selectedOpportunityId}
          onChange={(e) => setSelectedOpportunityId(e.target.value)}
        >
          <option value="">Select an opportunity</option>
          {opportunities.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
        {selectedOpportunityId && staffToken && (
          <BulkAssignHoursForm
            organizationId={organizationId}
            opportunityId={selectedOpportunityId}
            participants={participants}
            staffToken={staffToken}
            onAssigned={load}
          />
        )}
      </div>
    </div>
  );
}

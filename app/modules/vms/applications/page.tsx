"use client";

import { useCallback, useEffect, useState } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { fetchStaffToken } from "@/lib/staffToken";
import { listApplications, decideApplication, exportVmsCsv, type ApplicationListRow, type DecideApplicationPayload } from "@/lib/vmsFunctions";
import { useSelectedOrg } from "@/components/shell/AppShell";

export default function VmsApplicationsPage() {
  const organizationId = useSelectedOrg();
  const [applications, setApplications] = useState<ApplicationListRow[]>([]);
  const [staffToken, setStaffToken] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!organizationId) return;
    const supabase = getBrowserSupabaseClient();
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) return;
    const token = await fetchStaffToken(sessionData.session.access_token);
    setStaffToken(token);
    const result = await listApplications({ organizationId }, token);
    setApplications(result.applications);
  }, [organizationId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDecide(applicationId: string, decision: DecideApplicationPayload["decision"]) {
    if (!staffToken) return;
    // No organizationId here — decideApplication derives it from the
    // application row itself server-side.
    await decideApplication({ applicationId, decision }, staffToken);
    await load();
  }

  async function handleExport() {
    if (!organizationId || !staffToken) return;
    const csv = await exportVmsCsv({ organizationId, entity: "applications" }, staffToken);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "applications.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!organizationId) return <p>Select an organization to see its applications.</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Applications</h1>
        <button type="button" onClick={handleExport} className="rounded border px-3 py-1.5 text-sm">
          Export CSV
        </button>
      </div>

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-gray-600">
            <th className="py-2 pr-4">Volunteer</th>
            <th className="py-2 pr-4">Opportunity</th>
            <th className="py-2 pr-4">Status</th>
            <th className="py-2 pr-4">Actions</th>
          </tr>
        </thead>
        <tbody>
          {applications.map((a) => (
            <tr key={a.id} className="border-b border-gray-100">
              <td className="py-2 pr-4">{a.volunteerName}</td>
              <td className="py-2 pr-4">{a.opportunityName}</td>
              <td className="py-2 pr-4">{a.status}</td>
              <td className="py-2 pr-4 space-x-2">
                {a.status === "waitlisted" ? (
                  <button type="button" onClick={() => handleDecide(a.id, "selected")} className="rounded border px-2 py-1 text-xs">
                    Promote to selected
                  </button>
                ) : (
                  <>
                    <button type="button" onClick={() => handleDecide(a.id, "selected")} className="rounded border px-2 py-1 text-xs">
                      Select
                    </button>
                    <button type="button" onClick={() => handleDecide(a.id, "waitlisted")} className="rounded border px-2 py-1 text-xs">
                      Waitlist
                    </button>
                    <button type="button" onClick={() => handleDecide(a.id, "rejected")} className="rounded border px-2 py-1 text-xs">
                      Reject
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { fetchStaffToken } from "@/lib/staffToken";
import {
  listActivityHours,
  verifyHours,
  listOpportunities,
  listParticipationForOpportunity,
  type ActivityListRow,
  type OpportunitySummary,
  type VerifyHoursPayload,
} from "@/lib/youthRepublicFunctions";
import { useSelectedOrg } from "@/components/shell/AppShell";
import { BulkAssignHoursForm, type ParticipantOption } from "@/components/youth-republic/BulkAssignHoursForm";
import { AdjustHoursDrawer } from "@/components/youth-republic/AdjustHoursDrawer";
import { useToast } from "@/components/shell/ToastContext";

export default function YouthRepublicHoursPage() {
  const organizationId = useSelectedOrg();
  const { showToast } = useToast();
  const [activity, setActivity] = useState<ActivityListRow[]>([]);
  const [opportunities, setOpportunities] = useState<OpportunitySummary[]>([]);
  const [selectedOpportunityId, setSelectedOpportunityId] = useState("");
  const [participants, setParticipants] = useState<ParticipantOption[]>([]);
  const [staffToken, setStaffToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Drawer & Filter states
  const [adjustingRow, setAdjustingRow] = useState<ActivityListRow | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [showBulkAssign, setShowBulkAssign] = useState(false);

  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
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
    } catch (err) {
      console.error("Failed to load activity hours", err);
    } finally {
      setLoading(false);
    }
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
      try {
        const result = await listParticipationForOpportunity(
          { organizationId, opportunityId: selectedOpportunityId },
          staffToken,
        );
        setParticipants(
          result.participants.map((p) => ({ participationId: p.participationId, volunteerName: p.volunteerName })),
        );
      } catch (err) {
        console.error(err);
      }
    }
    loadParticipants();
  }, [organizationId, staffToken, selectedOpportunityId]);

  async function handleVerify(activityHoursId: string, hoursSubmitted: number) {
    if (!staffToken) return;
    await verifyHours({ activityHoursId, decision: "verified", hoursVerified: hoursSubmitted }, staffToken);
    showToast("Shift hours accredited.");
    await load();
  }

  async function handleSaveAdjustment(payload: VerifyHoursPayload) {
    if (!staffToken) return;
    await verifyHours(payload, staffToken);
    showToast("Shift hours adjustment recorded.");
    await load();
  }

  if (!organizationId) {
    return (
      <div className="panel p-8 text-center">
        <p className="text-[var(--ink-2)] font-medium">Select an organization to see its activity hours.</p>
      </div>
    );
  }

  const filtered = activity.filter((a) => {
    const matchesSearch =
      !searchQuery ||
      a.volunteerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.opportunityName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = selectedStatus === "all" || a.verificationStatus === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Hours Verification &amp; Accreditation</h1>
          <div className="page-subtitle">
            Review submitted volunteer logs, adjust shift accreditation, and issue certified student service hours.
          </div>
        </div>
        <div className="page-toolbar">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setShowBulkAssign(!showBulkAssign)}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>{showBulkAssign ? "Close Bulk Assign" : "Bulk-Assign Hours"}</span>
          </button>
        </div>
      </div>

      {/* Bulk-Assign Section */}
      <div className="panel p-5 space-y-4">
        <div className="panel-head">
          <div>
            <h2 className="panel-title">Bulk-Assign Shift Hours</h2>
            <p className="text-xs text-[var(--ink-2)] mt-0.5">Accredit verified hours across participating volunteers for a drive.</p>
          </div>
        </div>

        <div className="form-group max-w-md">
          <label htmlFor="bulkOpportunity" className="form-label">
            Bulk-assign for opportunity
          </label>
          <select
            id="bulkOpportunity"
            className="form-select"
            value={selectedOpportunityId}
            onChange={(e) => setSelectedOpportunityId(e.target.value)}
          >
            <option value="">Select an opportunity</option>
            {opportunities.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>

        {selectedOpportunityId && staffToken && (
          <BulkAssignHoursForm
            organizationId={organizationId}
            opportunityId={selectedOpportunityId}
            participants={participants}
            staffToken={staffToken}
            onAssigned={() => {
              showToast("Bulk hours assigned successfully.");
              load();
            }}
          />
        )}
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white border border-[var(--line)] rounded-xl">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <input
            type="text"
            className="search-input"
            placeholder="Search volunteer or drive name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <select
            className="filter-select"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
          >
            <option value="all">All Verification Statuses</option>
            <option value="recorded">Pending Review (Recorded)</option>
            <option value="verified">Verified &amp; Accredited</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        <span className="text-xs font-semibold text-[var(--ink-2)]">
          Showing {filtered.length} of {activity.length} shift logs
        </span>
      </div>

      {/* Data Table */}
      <div className="table-card">
        <div className="table-responsive-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Volunteer Name</th>
                <th>Opportunity / Drive</th>
                <th>Shift Date</th>
                <th>Claimed Hours</th>
                <th>Accredited Hours</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Verification Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => {
                const isPending = a.verificationStatus === "recorded" || a.verificationStatus === "pending";
                const isVerified = a.verificationStatus === "verified";
                const isRejected = a.verificationStatus === "rejected";
                const hoursClaimed = a.hoursSubmitted;
                const hoursAccredited = a.hoursVerified ?? (isVerified ? hoursClaimed : "—");

                return (
                  <tr key={a.id}>
                    <td>
                      <div>
                        <div className="font-bold text-[var(--ink)]">{a.volunteerName}</div>
                        <div className="text-xs text-[var(--ink-2)]">{a.role ?? "General Volunteer"}</div>
                      </div>
                    </td>
                    <td>
                      <span className="font-medium text-[var(--ink)]">{a.opportunityName}</span>
                    </td>
                    <td>
                      <span className="font-mono text-xs text-[var(--ink-2)]">{a.activityDate}</span>
                    </td>
                    <td>
                      <span className="font-mono font-semibold text-[var(--ink)]">{hoursClaimed} hrs</span>
                    </td>
                    <td>
                      <span className="font-mono font-bold text-emerald-700">
                        {typeof hoursAccredited === "number" ? `${hoursAccredited} hrs` : hoursAccredited}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          isVerified
                            ? "badge-pos"
                            : isRejected
                            ? "badge-neg"
                            : "badge-pend"
                        }`}
                      >
                        {a.verificationStatus}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div className="inline-flex items-center gap-1.5 justify-end">
                        {isPending && (
                          <button
                            type="button"
                            onClick={() => handleVerify(a.id, a.hoursSubmitted)}
                            className="btn btn-primary btn-xs"
                          >
                            Verify
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => setAdjustingRow(a)}
                          className="btn btn-secondary btn-xs"
                        >
                          Adjust Hours
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {filtered.length === 0 && !loading && (
        <div className="panel p-8 text-center">
          <p className="text-sm text-[var(--ink-2)]">No shift logs found matching the filter criteria.</p>
        </div>
      )}

      {/* Adjust Hours Slide-Out Drawer */}
      <AdjustHoursDrawer
        activityRow={adjustingRow}
        isOpen={Boolean(adjustingRow)}
        onClose={() => setAdjustingRow(null)}
        onSave={handleSaveAdjustment}
      />
    </div>
  );
}

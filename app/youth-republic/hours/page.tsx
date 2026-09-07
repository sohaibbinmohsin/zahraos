"use client";

import { useCallback, useEffect, useState } from "react";
import {
  listActivityHours,
  verifyHours,
  listOpportunities,
  listParticipationForOpportunity,
  type ActivityListRow,
  type VerifyHoursPayload,
} from "@/lib/youthRepublicFunctions";
import useSWR from "swr";
import { useSelectedOrg, useShellStaffToken } from "@/components/shell/AppShell";
import { BulkAssignHoursForm, type ParticipantOption } from "@/components/youth-republic/BulkAssignHoursForm";
import { AdjustHoursDrawer } from "@/components/youth-republic/AdjustHoursDrawer";
import { useToast } from "@/components/shell/ToastContext";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { ListPageSkeleton } from "@/components/ui/skeletons";

// Two verification-status values mean "awaiting review" — a shift the
// volunteer logged (`recorded`) and one carried over from older data
// (`pending`). The "Pending Review" filter matches either.
const PENDING_HOURS_STATUSES = ["recorded", "pending"];

const HOURS_STATUS_LABEL: Record<string, string> = {
  recorded: "pending review",
  pending: "pending review",
  verified: "verified",
  rejected: "rejected",
};

export default function YouthRepublicHoursPage() {
  const organizationId = useSelectedOrg();
  const { showToast } = useToast();
  const staffToken = useShellStaffToken();
  const [selectedOpportunityId, setSelectedOpportunityId] = useState("");
  const [participants, setParticipants] = useState<ParticipantOption[]>([]);

  // Drawer & Filter states
  const [adjustingRow, setAdjustingRow] = useState<ActivityListRow | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("pending");
  const [selectedDrive, setSelectedDrive] = useState("all");
  const [showBulkAssign, setShowBulkAssign] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  const closeBulkAssign = useCallback(() => {
    setShowBulkAssign(false);
    setSelectedOpportunityId("");
  }, []);

  const {
    data: hoursData,
    isLoading: loading,
    mutate: load,
  } = useSWR(
    organizationId && staffToken ? ["hoursPage", organizationId] : null,
    async () => {
      const [hoursResult, opportunitiesResult] = await Promise.all([
        listActivityHours({ organizationId: organizationId! }, staffToken!),
        listOpportunities({ organizationId: organizationId! }, staffToken!),
      ]);
      return { activity: hoursResult.activity, opportunities: opportunitiesResult.opportunities };
    },
    { onError: (err) => console.error("Failed to load activity hours", err) },
  );
  const activity = hoursData?.activity ?? [];
  const opportunities = hoursData?.opportunities ?? [];

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
    setVerifyingId(activityHoursId);
    try {
      await verifyHours({ activityHoursId, decision: "verified", hoursVerified: hoursSubmitted }, staffToken);
      showToast("Shift hours accredited.");
      await load();
    } catch (err) {
      showToast(err instanceof Error ? `Could not accredit hours: ${err.message}` : "Could not accredit hours.");
    } finally {
      setVerifyingId(null);
    }
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

  if (loading && activity.length === 0) {
    return <ListPageSkeleton columns={7} rows={6} filterBar={false} toolbarItems={4} />;
  }

  const driveNames = [...new Set(activity.map((a) => a.opportunityName).filter(Boolean))].sort();

  const filtered = activity.filter((a) => {
    const matchesSearch =
      !searchQuery ||
      a.volunteerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.opportunityName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      selectedStatus === "all" ||
      a.verificationStatus === selectedStatus ||
      (selectedStatus === "pending" && PENDING_HOURS_STATUSES.includes(a.verificationStatus));
    const matchesDrive = selectedDrive === "all" || a.opportunityName === selectedDrive;
    return matchesSearch && matchesStatus && matchesDrive;
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
          <input
            type="text"
            className="search-input"
            placeholder="Search volunteer or drive name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Select
            aria-label="Filter by drive"
            value={selectedDrive}
            onChange={setSelectedDrive}
            options={[
              { value: "all", label: "All Drives" },
              ...driveNames.map((nm) => ({ value: nm, label: nm })),
            ]}
          />
          <Select
            aria-label="Filter by status"
            value={selectedStatus}
            onChange={setSelectedStatus}
            options={[
              { value: "all", label: "All Verification Statuses" },
              { value: "pending", label: "Pending Review" },
              { value: "verified", label: "Verified & Accredited" },
              { value: "rejected", label: "Rejected" },
            ]}
          />
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setShowBulkAssign(true)}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Bulk-Assign Hours</span>
          </button>
        </div>
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
                        {HOURS_STATUS_LABEL[a.verificationStatus] ?? a.verificationStatus}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div className="inline-flex items-center gap-1.5 justify-end">
                        {isPending && (
                          <LoadingButton
                            onClick={() => handleVerify(a.id, a.hoursSubmitted)}
                            className="btn btn-primary btn-xs"
                            loading={verifyingId === a.id}
                            loadingText="Accrediting…"
                            disabled={verifyingId !== null}
                          >
                            Verify
                          </LoadingButton>
                        )}

                        <button
                          type="button"
                          onClick={() => setAdjustingRow(a)}
                          className="btn btn-secondary btn-xs"
                          disabled={verifyingId === a.id}
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

      {/* Bulk-Assign Hours Modal */}
      <Modal
        isOpen={showBulkAssign}
        onClose={closeBulkAssign}
        title="Bulk-Assign Shift Hours"
        description="Accredit hours across confirmed participants for a drive."
        maxWidth={520}
      >
        <div className="space-y-4">
          <div className="form-group">
            <label htmlFor="bulkOpportunity" className="form-label">Opportunity / drive</label>
            <select
              id="bulkOpportunity"
              className="form-select"
              value={selectedOpportunityId}
              onChange={(e) => setSelectedOpportunityId(e.target.value)}
            >
              <option value="">Select a drive</option>
              {opportunities.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>

          {selectedOpportunityId && staffToken ? (
            <BulkAssignHoursForm
              organizationId={organizationId}
              opportunityId={selectedOpportunityId}
              participants={participants}
              staffToken={staffToken}
              onCancel={closeBulkAssign}
              onAssigned={() => {
                showToast("Bulk hours assigned successfully.");
                closeBulkAssign();
                load();
              }}
            />
          ) : (
            <p className="text-xs text-[var(--ink-2)]">
              Pick a drive to choose participants and assign hours.
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
}

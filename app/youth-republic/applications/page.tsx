"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { fetchStaffToken } from "@/lib/staffToken";
import {
  listApplications,
  decideApplication,
  type ApplicationListRow,
  type DecideApplicationPayload,
} from "@/lib/youthRepublicFunctions";
import { useSelectedOrg } from "@/components/shell/AppShell";
import { ApplicationReviewDrawer } from "@/components/youth-republic/ApplicationReviewDrawer";
import { useToast } from "@/components/shell/ToastContext";
import { Select } from "@/components/ui/Select";
import { ListPageSkeleton } from "@/components/ui/skeletons";

// Statuses that still need a triage decision. The backend now emits a single
// "pending_review"; the two legacy values are kept here so older rows still
// render in the "needs a decision" bucket.
const PENDING_STATUSES = ["pending_review", "submitted", "under_review"];

const STATUS_LABEL: Record<string, string> = {
  pending_review: "pending review",
  submitted: "pending review",
  under_review: "pending review",
  selected: "selected",
  waitlisted: "waitlisted",
  rejected: "rejected",
  withdrawn: "withdrawn",
  draft: "draft",
};

const DECISION_META: Record<
  DecideApplicationPayload["decision"],
  { label: string; loadingLabel: string; toast: string; variant: string }
> = {
  selected: { label: "Select", loadingLabel: "Selecting…", toast: "selected", variant: "btn-primary" },
  waitlisted: { label: "Waitlist", loadingLabel: "Waitlisting…", toast: "waitlisted", variant: "btn-secondary" },
  rejected: { label: "Reject", loadingLabel: "Rejecting…", toast: "rejected", variant: "btn-danger" },
  pending_review: {
    label: "Reconsider",
    loadingLabel: "Moving to review…",
    toast: "moved back to pending review",
    variant: "btn-primary",
  },
};

function DecisionButton({
  decision,
  loading,
  disabled,
  onClick,
}: {
  decision: DecideApplicationPayload["decision"];
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const meta = DECISION_META[decision];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`btn ${meta.variant} btn-xs`}
    >
      {loading ? (
        <>
          <span className="btn-spinner" aria-hidden="true" />
          {meta.loadingLabel}
        </>
      ) : (
        meta.label
      )}
    </button>
  );
}

function ApplicationsContent() {
  const organizationId = useSelectedOrg();
  const searchParams = useSearchParams();
  const opportunityIdParam = searchParams.get("opportunityId");
  const { showToast } = useToast();
  const [applications, setApplications] = useState<ApplicationListRow[]>([]);
  const [staffToken, setStaffToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Drawer state
  const [selectedApp, setSelectedApp] = useState<ApplicationListRow | null>(null);

  // Which row + decision is currently being written to the server, so only
  // that button shows a spinner and the rest of the row locks.
  const [busy, setBusy] = useState<{ id: string; decision: DecideApplicationPayload["decision"] } | null>(null);

  // "Reconsider" is a purely local reveal — it opens Select/Waitlist/Reject on
  // an already-decided row. No server call until one of those is clicked.
  const [reconsideringId, setReconsideringId] = useState<string | null>(null);

  // Search & Filter — opens on the triage queue (Pending Review) by default.
  // The drive filter is seeded from a ?opportunityId= deep link when present.
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("pending_review");
  const [driveFilter, setDriveFilter] = useState(opportunityIdParam ?? "all");

  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const supabase = getBrowserSupabaseClient();
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return;
      const token = await fetchStaffToken(sessionData.session.access_token);
      setStaffToken(token);
      // Always load the org's full set — the drive filter is applied
      // client-side so switching it needs no refetch.
      const result = await listApplications({ organizationId }, token);
      setApplications(result.applications);
    } catch (err) {
      console.error("Failed to load applications", err);
      showToast(err instanceof Error ? `Could not load applications: ${err.message}` : "Could not load applications.");
    } finally {
      setLoading(false);
    }
  }, [organizationId, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  // Throws on failure so the review drawer can keep itself open; the table
  // rows call it through `void`, relying on the toast for the error.
  async function handleDecide(applicationId: string, decision: DecideApplicationPayload["decision"]) {
    if (!staffToken) return;
    setBusy({ id: applicationId, decision });
    try {
      await decideApplication({ applicationId, decision }, staffToken);
      showToast(`Application ${DECISION_META[decision].toast}.`);
      setReconsideringId(null);
      await load();
    } catch (err) {
      showToast(
        err instanceof Error ? `Could not update application: ${err.message}` : "Could not update application.",
      );
      throw err;
    } finally {
      setBusy(null);
    }
  }

  const decideFromRow = (applicationId: string, decision: DecideApplicationPayload["decision"]) => {
    void handleDecide(applicationId, decision).catch(() => {});
  };

  if (!organizationId) {
    return (
      <div className="panel p-8 text-center">
        <p className="text-[var(--ink-2)] font-medium">Select an organization to see its applications.</p>
      </div>
    );
  }

  if (loading && applications.length === 0) {
    return <ListPageSkeleton columns={5} rows={8} filterBar={false} toolbarItems={3} />;
  }

  // Distinct drives present in the loaded applications, for the filter select.
  const driveOptions = [...new Map(
    applications
      .filter((a) => a.opportunityId)
      .map((a) => [a.opportunityId, a.opportunityName || "Untitled drive"] as [string, string]),
  ).entries()].sort((a, b) => a[1].localeCompare(b[1]));

  const filtered = applications.filter((a) => {
    const candidateName = a.applicantName || a.volunteerName || "";
    const oppName = a.opportunityName || "";
    const matchesSearch =
      !searchQuery ||
      candidateName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      oppName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === "all" ||
      a.status === statusFilter ||
      (statusFilter === "pending_review" && PENDING_STATUSES.includes(a.status));
    const matchesDrive = driveFilter === "all" || a.opportunityId === driveFilter;
    return matchesSearch && matchesStatus && matchesDrive;
  });

  return (
    <div className="space-y-6">
      {/* Page Header — search + status filter live inline with the title */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Volunteer Applications</h1>
          <div className="page-subtitle">
            Candidate Triage Queue, dynamic questionnaire responses &amp; batch decisioning across drives.
          </div>
        </div>
        <div className="page-toolbar">
          <input
            type="text"
            className="search-input"
            placeholder="Search candidate name or drive..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Select
            aria-label="Filter by drive"
            value={driveFilter}
            onChange={setDriveFilter}
            options={[
              { value: "all", label: "All Drives" },
              ...driveOptions.map(([id, nm]) => ({ value: id, label: nm })),
            ]}
          />
          <Select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: "all", label: "All Application Statuses" },
              { value: "pending_review", label: "Pending Review" },
              { value: "selected", label: "Selected" },
              { value: "waitlisted", label: "Waitlisted" },
              { value: "rejected", label: "Rejected" },
            ]}
          />
        </div>
      </div>

      {/* Data Table */}
      <div className="table-card">
        <div className="table-responsive-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Volunteer Candidate</th>
                <th>Target Opportunity</th>
                <th>Applied Timestamp</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Triage Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => {
                const displayName = a.applicantName || a.volunteerName;
                const appliedDate = a.appliedAt
                  ? new Date(a.appliedAt).toLocaleDateString("en-PK", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })
                  : "—";

                return (
                  <tr key={a.id}>
                    <td>
                      <div>
                        <button
                          type="button"
                          className="font-bold text-[var(--ink)] hover:underline text-left cursor-pointer"
                          onClick={() => setSelectedApp(a)}
                        >
                          {displayName}
                        </button>
                        <div className="text-xs text-[var(--ink-2)] mt-0.5">
                          {a.applicantEmail ?? "Verified Profile"}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="font-medium text-[var(--ink)]">{a.opportunityName}</span>
                    </td>
                    <td>
                      <span className="font-mono text-xs text-[var(--ink-2)]">{appliedDate}</span>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          a.status === "selected"
                            ? "badge-pos"
                            : a.status === "waitlisted"
                            ? "badge-prog"
                            : a.status === "rejected"
                            ? "badge-neg"
                            : "badge-pend"
                        }`}
                      >
                        {STATUS_LABEL[a.status] ?? a.status}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {(() => {
                        const rowBusy = busy?.id === a.id;
                        const isPending = PENDING_STATUSES.includes(a.status);
                        const isReconsidering = reconsideringId === a.id;
                        const showDecisionButtons = isPending || isReconsidering;
                        return (
                          <div className="inline-flex items-center gap-1.5 justify-end">
                            <button
                              type="button"
                              onClick={() => setSelectedApp(a)}
                              className="btn btn-secondary btn-xs"
                              title="View submitted questionnaire answers"
                              disabled={rowBusy}
                            >
                              Review Answers
                            </button>

                            {showDecisionButtons ? (
                              <>
                                <DecisionButton
                                  decision="selected"
                                  loading={rowBusy && busy?.decision === "selected"}
                                  disabled={rowBusy}
                                  onClick={() => decideFromRow(a.id, "selected")}
                                />
                                <DecisionButton
                                  decision="waitlisted"
                                  loading={rowBusy && busy?.decision === "waitlisted"}
                                  disabled={rowBusy}
                                  onClick={() => decideFromRow(a.id, "waitlisted")}
                                />
                                <DecisionButton
                                  decision="rejected"
                                  loading={rowBusy && busy?.decision === "rejected"}
                                  disabled={rowBusy}
                                  onClick={() => decideFromRow(a.id, "rejected")}
                                />
                                {isReconsidering && !isPending && (
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-xs"
                                    onClick={() => setReconsideringId(null)}
                                    disabled={rowBusy}
                                  >
                                    Cancel
                                  </button>
                                )}
                              </>
                            ) : (
                              <button
                                type="button"
                                className="btn btn-primary btn-xs"
                                onClick={() => setReconsideringId(a.id)}
                              >
                                Reconsider
                              </button>
                            )}
                          </div>
                        );
                      })()}
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
          <p className="text-sm text-[var(--ink-2)]">No applications matching the selected criteria.</p>
        </div>
      )}

      {/* Candidate Review Drawer */}
      <ApplicationReviewDrawer
        application={selectedApp}
        isOpen={Boolean(selectedApp)}
        onClose={() => setSelectedApp(null)}
        onDecide={handleDecide}
      />
    </div>
  );
}

export default function YouthRepublicApplicationsPage() {
  return (
    <Suspense fallback={<ListPageSkeleton columns={5} rows={8} filterBar={false} toolbarItems={3} />}>
      <ApplicationsContent />
    </Suspense>
  );
}

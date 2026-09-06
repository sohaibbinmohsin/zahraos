"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
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

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const supabase = getBrowserSupabaseClient();
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return;
      const token = await fetchStaffToken(sessionData.session.access_token);
      setStaffToken(token);
      const result = await listApplications(
        { organizationId, ...(opportunityIdParam ? { opportunityId: opportunityIdParam } : {}) },
        token,
      );
      setApplications(result.applications);
    } catch (err) {
      console.error("Failed to load applications", err);
      showToast(err instanceof Error ? `Could not load applications: ${err.message}` : "Could not load applications.");
    } finally {
      setLoading(false);
    }
  }, [organizationId, opportunityIdParam, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDecide(applicationId: string, decision: DecideApplicationPayload["decision"]) {
    if (!staffToken) return;
    await decideApplication({ applicationId, decision }, staffToken);
    showToast(`Application marked as ${decision}.`);
    await load();
  }

  if (!organizationId) {
    return (
      <div className="panel p-8 text-center">
        <p className="text-[var(--ink-2)] font-medium">Select an organization to see its applications.</p>
      </div>
    );
  }

  const filteredOppName = opportunityIdParam
    ? applications.find((a) => a.opportunityId === opportunityIdParam)?.opportunityName ?? null
    : null;

  const filtered = applications.filter((a) => {
    const candidateName = a.applicantName || a.volunteerName || "";
    const oppName = a.opportunityName || "";
    const matchesSearch =
      !searchQuery ||
      candidateName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      oppName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || a.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Volunteer Applications</h1>
          <div className="page-subtitle">
            Candidate Triage Queue, dynamic questionnaire responses &amp; batch decisioning across drives.
          </div>
        </div>
        <div className="page-toolbar">
        </div>
      </div>

      {opportunityIdParam && (
        <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-[var(--bg-page)] border border-[var(--line-subtle)] text-sm">
          <span className="text-[var(--ink-2)]">
            Showing applications for <strong className="text-[var(--ink)]">{filteredOppName ?? "this opportunity"}</strong>
          </span>
          <Link href="/youth-republic/applications" className="btn btn-secondary btn-xs">
            Clear filter
          </Link>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white border border-[var(--line)] rounded-xl">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <input
            type="text"
            className="search-input"
            placeholder="Search candidate name or drive..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <select
            className="filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Application Statuses</option>
            <option value="submitted">Applied (Pending Review)</option>
            <option value="selected">Selected</option>
            <option value="waitlisted">Waitlisted</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        <span className="text-xs font-semibold text-[var(--ink-2)]">
          Showing {filtered.length} of {applications.length} candidates
        </span>
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
                        {a.status}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div className="inline-flex items-center gap-1.5 justify-end">
                        <button
                          type="button"
                          onClick={() => setSelectedApp(a)}
                          className="btn btn-secondary btn-xs"
                          title="View submitted questionnaire answers"
                        >
                          Review Answers
                        </button>

                        {a.status === "waitlisted" ? (
                          <button
                            type="button"
                            onClick={() => handleDecide(a.id, "selected")}
                            className="btn btn-primary btn-xs"
                          >
                            Promote to selected
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => handleDecide(a.id, "selected")}
                              className="btn btn-primary btn-xs"
                            >
                              Select
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDecide(a.id, "waitlisted")}
                              className="btn btn-secondary btn-xs"
                            >
                              Waitlist
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDecide(a.id, "rejected")}
                              className="btn btn-danger btn-xs"
                            >
                              Reject
                            </button>
                          </>
                        )}
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
    <Suspense fallback={<p className="p-8 text-center text-[var(--ink-3)]">Loading applications…</p>}>
      <ApplicationsContent />
    </Suspense>
  );
}

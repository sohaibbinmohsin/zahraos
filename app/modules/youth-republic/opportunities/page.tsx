"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { fetchStaffToken } from "@/lib/staffToken";
import {
  listOpportunities,
  getOpportunityDetail,
  updateOpportunity,
  exportYouthRepublicCsv,
  type OpportunitySummary,
} from "@/lib/youthRepublicFunctions";
import { useSelectedOrg } from "@/components/shell/AppShell";
import { CreateOpportunityForm } from "@/components/youth-republic/CreateOpportunityForm";
import { useToast } from "@/components/shell/ToastContext";

type EditTarget = NonNullable<
  React.ComponentProps<typeof CreateOpportunityForm>["initialOpportunity"]
>;

function fmtDateRange(start: string | null, end: string | null): string | null {
  if (!start && !end) return null;
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };
  const s = start ? new Date(start).toLocaleDateString("en-GB", opts) : null;
  const e = end ? new Date(end).toLocaleDateString("en-GB", opts) : null;
  if (s && e) return `${s} – ${e}`;
  return s ?? e;
}

const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  coming_soon: "Coming soon",
  in_progress: "In progress",
  completed: "Completed",
  closed: "Closed",
};

export default function YouthRepublicOpportunitiesPage() {
  const organizationId = useSelectedOrg();
  const { showToast } = useToast();
  const [opportunities, setOpportunities] = useState<OpportunitySummary[]>([]);
  const [staffToken, setStaffToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [isCreating, setIsCreating] = useState(false);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [loadingEdit, setLoadingEdit] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPillar, setSelectedPillar] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");

  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const supabase = getBrowserSupabaseClient();
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return;
      const token = await fetchStaffToken(sessionData.session.access_token);
      setStaffToken(token);
      const result = await listOpportunities({ organizationId }, token);
      setOpportunities(result.opportunities);
    } catch (err) {
      console.error("Failed to load opportunities", err);
      showToast(err instanceof Error ? `Could not load opportunities: ${err.message}` : "Could not load opportunities.");
    } finally {
      setLoading(false);
    }
  }, [organizationId, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  async function openEditor(oppId: string) {
    if (!staffToken) return;
    setLoadingEdit(true);
    try {
      const d = await getOpportunityDetail({ opportunityId: oppId }, staffToken);
      setEditTarget({
        id: d.id,
        name: d.name,
        type: d.type,
        description: d.description ?? undefined,
        location: d.location ?? undefined,
        isOnline: d.isOnline,
        capacity: d.capacity ?? undefined,
        applicationOpenAt: d.applicationOpenAt ?? undefined,
        applicationDeadline: d.applicationDeadline ?? undefined,
        activityStartAt: d.activityStartAt ?? undefined,
        activityEndAt: d.activityEndAt ?? undefined,
        about: d.about ?? undefined,
        duties: d.duties,
        eligibility: d.eligibility,
        whatToBring: d.whatToBring,
        applicationForm: d.applicationForm,
      });
    } catch (err) {
      console.error(err);
      showToast(err instanceof Error ? `Could not open opportunity: ${err.message}` : "Could not open opportunity.");
    } finally {
      setLoadingEdit(false);
    }
  }

  async function toggleDeactivated(opp: OpportunitySummary) {
    if (!organizationId || !staffToken) return;
    const archiving = !opp.deactivatedAt;
    if (archiving && !confirm(`Archive "${opp.name}"? It will be hidden from volunteers immediately.`)) return;
    setBusyId(opp.id);
    try {
      await updateOpportunity(
        { opportunityId: opp.id, organizationId, deactivatedAt: archiving ? new Date().toISOString() : null },
        staffToken,
      );
      showToast(archiving ? "Opportunity archived." : "Opportunity restored.");
      await load();
    } catch (err) {
      console.error(err);
      showToast(err instanceof Error ? `Failed: ${err.message}` : "Action failed.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleExport() {
    if (!organizationId || !staffToken) return;
    try {
      const csv = await exportYouthRepublicCsv({ organizationId, entity: "opportunities" }, staffToken);
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "opportunities.csv";
      a.click();
      URL.revokeObjectURL(url);
      showToast("Downloaded opportunities CSV.");
    } catch (err) {
      console.error(err);
      showToast("CSV export failed.");
    }
  }

  const pillars = useMemo(
    () => [...new Set(opportunities.map((o) => o.type))].sort(),
    [opportunities],
  );

  if (!organizationId) {
    return (
      <div className="panel p-8 text-center">
        <p className="text-[var(--ink-2)] font-medium">Select an organization to see its opportunities.</p>
      </div>
    );
  }

  if (isCreating || editTarget) {
    return (
      <div className="space-y-6">
        <button
          type="button"
          className="btn btn-secondary btn-xs mb-2"
          onClick={() => {
            setIsCreating(false);
            setEditTarget(null);
          }}
        >
          &larr; Back to Opportunities
        </button>

        {staffToken && (
          <CreateOpportunityForm
            organizationId={organizationId}
            staffToken={staffToken}
            initialOpportunity={editTarget ?? undefined}
            onCreated={() => {
              setIsCreating(false);
              setEditTarget(null);
              load();
            }}
            onCancel={() => {
              setIsCreating(false);
              setEditTarget(null);
            }}
          />
        )}
      </div>
    );
  }

  const filtered = opportunities.filter((o) => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      o.name.toLowerCase().includes(q) ||
      o.type.toLowerCase().includes(q) ||
      (o.city ?? "").toLowerCase().includes(q);
    const matchesPillar = selectedPillar === "all" || o.type === selectedPillar;
    const matchesStatus = selectedStatus === "all" || o.computedStatus === selectedStatus;
    return matchesSearch && matchesPillar && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Volunteer Opportunities</h1>
          <div className="page-subtitle">
            Manage public community drives, set capacity quotas, and build customized application forms.
          </div>
        </div>
        <div className="page-toolbar">
          <button type="button" onClick={handleExport} className="btn btn-secondary btn-sm">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>Export CSV</span>
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setIsCreating(true)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Create Opportunity</span>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white border border-[var(--line)] rounded-xl">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <input
            type="text"
            className="search-input"
            placeholder="Search by name, pillar or city..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <select className="filter-select" value={selectedPillar} onChange={(e) => setSelectedPillar(e.target.value)}>
            <option value="all">All Pillars</option>
            {pillars.map((p) => (
              <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
            ))}
          </select>
          <select className="filter-select" value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}>
            <option value="all">All Statuses</option>
            <option value="open">Open</option>
            <option value="coming_soon">Coming soon</option>
            <option value="in_progress">In progress</option>
            <option value="completed">Completed</option>
            <option value="closed">Closed</option>
          </select>
        </div>
        <span className="text-xs font-semibold text-[var(--ink-2)]">
          Showing {filtered.length} of {opportunities.length} drives
        </span>
      </div>

      {loading && opportunities.length === 0 ? (
        <div className="panel p-8 text-center">
          <p className="text-sm text-[var(--ink-2)]">Loading opportunities…</p>
        </div>
      ) : (
        <div className="opp-grid">
          {filtered.map((opp) => {
            const cap = opp.capacity ?? null;
            const filled = opp.filledCount;
            const percent = cap && cap > 0 ? Math.min(100, Math.round((filled / cap) * 100)) : 0;
            const dateRange = fmtDateRange(opp.activityStartAt, opp.activityEndAt);
            const archived = Boolean(opp.deactivatedAt);
            const statusLabel = archived ? "Archived" : (STATUS_LABEL[opp.computedStatus] ?? opp.computedStatus);

            return (
              <div key={opp.id} className="opp-card" style={archived ? { opacity: 0.6 } : undefined}>
                <div>
                  <div className="opp-head">
                    <span className={`type-pill ${opp.type}`}>{opp.type}</span>
                    <span className={`badge ${!archived && opp.computedStatus === "open" ? "badge-pos" : "badge-neu"}`}>
                      {statusLabel}
                    </span>
                  </div>

                  <div className="opp-title">{opp.name}</div>
                  {opp.description && <div className="opp-lead">{opp.description}</div>}

                  <div className="mt-4">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-[var(--ink-2)]">Capacity</span>
                      <span className="font-mono">
                        {cap == null ? `${filled} confirmed` : `${filled} / ${cap} (${percent}%)`}
                      </span>
                    </div>
                    {cap != null && (
                      <div className="meter-bar">
                        <div className="meter-fill" style={{ width: `${percent}%` }} />
                      </div>
                    )}
                  </div>

                  <div className="opp-meta-row">
                    <div className="opp-meta-item">
                      <span>📍</span>
                      <span>{opp.online ? "Online" : (opp.city ?? "—")}</span>
                    </div>
                    {dateRange && (
                      <div className="opp-meta-item">
                        <span>📅</span>
                        <span>{dateRange}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="opp-footer">
                  <button
                    type="button"
                    className="btn btn-secondary btn-xs"
                    disabled={loadingEdit}
                    onClick={() => openEditor(opp.id)}
                  >
                    {loadingEdit ? "Opening…" : "Edit"}
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary btn-xs"
                    disabled={busyId === opp.id}
                    onClick={() => toggleDeactivated(opp)}
                  >
                    {busyId === opp.id ? "…" : archived ? "Restore" : "Archive"}
                  </button>

                  <Link
                    href={`/modules/youth-republic/applications?opportunityId=${opp.id}`}
                    className="btn btn-dark btn-xs"
                  >
                    View Applicants &rarr;
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="panel p-8 text-center">
          <p className="text-sm text-[var(--ink-2)]">
            {opportunities.length === 0
              ? "No opportunities yet. Use “Create Opportunity” to add one — it will appear on the volunteer noticeboard immediately."
              : "No opportunities match the current filters."}
          </p>
        </div>
      )}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { fetchStaffToken } from "@/lib/staffToken";
import {
  listOpportunities,
  getOpportunityDetail,
  updateOpportunity,
  type OpportunitySummary,
} from "@/lib/youthRepublicFunctions";
import { useSelectedOrg, useShellAccessToken } from "@/components/shell/AppShell";
import { CreateOpportunityForm } from "@/components/youth-republic/CreateOpportunityForm";
import { useToast } from "@/components/shell/ToastContext";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { CardGridSkeleton } from "@/components/ui/skeletons";

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

// The top-right pill is the *lifecycle / application* status; the brand-gold
// blinking dot on the title separately marks a drive that is running now.
// An in-progress drive can still have applications open or closed, so the two
// are independent. Coming-soon / completed / archived always imply closed
// applications, so their pill is just the lifecycle label.
function cardStatus(
  opp: OpportunitySummary,
  archived: boolean,
): { pill: { label: string; cls: string }; running: boolean } {
  if (archived) return { pill: { label: "Archived", cls: "badge-neu" }, running: false };

  const deadlinePassed = opp.applicationDeadline
    ? new Date(opp.applicationDeadline).getTime() < Date.now()
    : false;

  switch (opp.computedStatus) {
    case "completed":
      return { pill: { label: "Completed", cls: "badge-comp" }, running: false };
    case "coming_soon":
      return { pill: { label: "Coming Soon", cls: "badge-pend" }, running: false };
    case "closed":
      return { pill: { label: "Closed", cls: "badge-neu" }, running: false };
    case "in_progress":
      return {
        pill: deadlinePassed
          ? { label: "Closed", cls: "badge-neu" }
          : { label: "Open", cls: "badge-pos" },
        running: true,
      };
    case "open":
    default:
      return { pill: { label: "Open", cls: "badge-pos" }, running: false };
  }
}

export default function YouthRepublicDrivesPage() {
  const organizationId = useSelectedOrg();
  const accessToken = useShellAccessToken();
  const { showToast } = useToast();
  const [opportunities, setOpportunities] = useState<OpportunitySummary[]>([]);
  const [staffToken, setStaffToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<{ id: string; action: "archive" | "delete" } | null>(null);

  const [isCreating, setIsCreating] = useState(false);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [openingEditorId, setOpeningEditorId] = useState<string | null>(null);

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
      setOpportunities(result.opportunities.filter((o) => o.computedStatus !== "deleted"));
    } catch (err) {
      console.error("Failed to load drives", err);
      showToast(err instanceof Error ? `Could not load drives: ${err.message}` : "Could not load drives.");
    } finally {
      setLoading(false);
    }
  }, [organizationId, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  async function openEditor(oppId: string) {
    if (!staffToken) return;
    setOpeningEditorId(oppId);
    try {
      const d = await getOpportunityDetail({ opportunityId: oppId }, staffToken);
      const summary = opportunities.find((o) => o.id === oppId);
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
        computedStatus: summary?.computedStatus ?? d.computedStatus,
        deactivatedAt: summary?.deactivatedAt ?? null,
      });
    } catch (err) {
      console.error(err);
      showToast(err instanceof Error ? `Could not open drive: ${err.message}` : "Could not open drive.");
    } finally {
      setOpeningEditorId(null);
    }
  }

  async function toggleDeactivated(opp: OpportunitySummary) {
    if (!organizationId || !staffToken) return;
    const archiving = !opp.deactivatedAt;
    if (archiving && !confirm(`Archive "${opp.name}"? It will be hidden from volunteers immediately.`)) return;
    setBusy({ id: opp.id, action: "archive" });
    try {
      await updateOpportunity(
        { opportunityId: opp.id, organizationId, deactivatedAt: archiving ? new Date().toISOString() : null },
        staffToken,
      );
      showToast(archiving ? "Drive archived." : "Drive restored.");
      await load();
    } catch (err) {
      console.error(err);
      showToast(err instanceof Error ? `Failed: ${err.message}` : "Action failed.");
    } finally {
      setBusy(null);
    }
  }

  async function handleDeleteOpportunity(opp: OpportunitySummary) {
    if (!organizationId || !staffToken) return;
    if (!confirm(`Are you sure you want to permanently delete "${opp.name}"? This action cannot be undone.`)) {
      return;
    }
    setBusy({ id: opp.id, action: "delete" });
    try {
      await updateOpportunity(
        { opportunityId: opp.id, organizationId, hardDelete: true },
        staffToken,
      );
      setOpportunities((prev) => prev.filter((o) => o.id !== opp.id));
      showToast(`Drive "${opp.name}" deleted.`);
    } catch (err) {
      console.error(err);
      showToast(err instanceof Error ? `Failed to delete: ${err.message}` : "Failed to delete drive.");
    } finally {
      setBusy(null);
    }
  }

  if (!organizationId) {
    return (
      <div className="panel p-8 text-center">
        <p className="text-[var(--ink-2)] font-medium">Select an organization to see its drives.</p>
      </div>
    );
  }

  if (isCreating || editTarget) {
    return (
      <div className="space-y-6">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--ink-2)] hover:text-[var(--ink)] mb-3 bg-transparent border-0 p-0 cursor-pointer transition-colors"
          onClick={() => {
            setIsCreating(false);
            setEditTarget(null);
          }}
        >
          &larr; Back to Drives
        </button>

        {staffToken && (
          <CreateOpportunityForm
            organizationId={organizationId}
            staffToken={staffToken}
            accessToken={accessToken}
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

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Drives Noticeboard</h1>
          <div className="page-subtitle">
            Manage active drives, customize multi-field application forms, and track volunteer capacity.
          </div>
        </div>
        <div className="page-toolbar">
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setIsCreating(true)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Create Drive</span>
          </button>
        </div>
      </div>

      {loading && opportunities.length === 0 ? (
        <CardGridSkeleton header={false} />
      ) : (
        <div className="opp-grid">
          {opportunities.map((opp) => {
            const cap = opp.capacity ?? null;
            const filled = opp.filledCount;
            const percent = cap && cap > 0 ? Math.min(100, Math.round((filled / cap) * 100)) : 0;
            const dateRange = fmtDateRange(opp.activityStartAt, opp.activityEndAt);
            const archived = Boolean(opp.deactivatedAt);
            const { pill, running } = cardStatus(opp, archived);

            return (
              <div key={opp.id} className="opp-card" style={archived ? { opacity: 0.6 } : undefined}>
                <div>
                  <div className="opp-head">
                    <span className={`type-pill ${opp.type}`}>{opp.type}</span>
                    <span className={`badge ${pill.cls}`}>{pill.label}</span>
                  </div>

                  <div className="opp-title">
                    {opp.name}
                    {running && (
                      <span className="live-dot" aria-hidden="true" title="Drive in progress" />
                    )}
                  </div>
                  {opp.description && <div className="opp-lead">{opp.description}</div>}

                  <div className="opp-meta-row">
                    <div className="opp-meta-item">
                      <span className="icon-svg">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                          <circle cx="12" cy="10" r="3" />
                        </svg>
                      </span>
                      <span>{opp.online ? "Online" : (opp.city || "Lahore")}</span>
                    </div>
                    <div className="opp-meta-item">
                      <span className="icon-svg">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                          <line x1="16" y1="2" x2="16" y2="6" />
                          <line x1="8" y1="2" x2="8" y2="6" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                      </span>
                      <span>{dateRange ? `Starts: ${dateRange}` : "Starts: Rolling"}</span>
                    </div>
                  </div>
                </div>

                <div className="opp-footer">
                  {archived ? (
                    <div />
                  ) : (
                    <div>
                      <div style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--ink)" }}>
                        Capacity: {cap == null ? `${filled} confirmed` : `${filled} / ${cap}`}
                      </div>
                      {cap != null && (
                        <div style={{ width: "90px", height: "5px", background: "var(--bg-page)", borderRadius: "99px", border: "1px solid var(--line)", marginTop: "3px", overflow: "hidden" }}>
                          <div style={{ width: `${percent}%`, height: "100%", background: "var(--brand)" }} />
                        </div>
                      )}
                    </div>
                  )}

                  {archived ? (
                    <div style={{ display: "inline-flex", gap: ".35rem", alignItems: "center" }}>
                      <LoadingButton
                        className="btn btn-secondary btn-xs"
                        disabled={busy?.id === opp.id}
                        loading={busy?.id === opp.id && busy.action === "archive"}
                        loadingText="Restoring…"
                        onClick={() => toggleDeactivated(opp)}
                      >
                        Restore
                      </LoadingButton>
                      <LoadingButton
                        className="btn btn-danger btn-xs"
                        disabled={busy?.id === opp.id}
                        loading={busy?.id === opp.id && busy.action === "delete"}
                        loadingText="Deleting…"
                        onClick={() => handleDeleteOpportunity(opp)}
                      >
                        Delete
                      </LoadingButton>
                    </div>
                  ) : (
                    <div style={{ display: "inline-flex", gap: ".35rem", alignItems: "center" }}>
                      <LoadingButton
                        className="btn btn-secondary btn-xs"
                        disabled={openingEditorId !== null}
                        loading={openingEditorId === opp.id}
                        loadingText="Opening…"
                        onClick={() => openEditor(opp.id)}
                      >
                        <span className="icon-svg">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                          </svg>
                        </span>
                        <span>Edit</span>
                      </LoadingButton>

                      <Link
                        href={`/youth-republic/applications?opportunityId=${opp.id}`}
                        className="btn btn-dark btn-xs"
                      >
                        <span className="icon-svg">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        </span>
                        <span>View Applicants</span>
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && opportunities.length === 0 && (
        <div className="panel p-8 text-center">
          <p className="text-sm text-[var(--ink-2)]">
            No drives yet. Use “Create Drive” to add one — it will appear on the volunteer noticeboard immediately.
          </p>
        </div>
      )}
    </div>
  );
}

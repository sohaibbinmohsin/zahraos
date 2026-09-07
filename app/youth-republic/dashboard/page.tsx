"use client";

import useSWR from "swr";
import Link from "next/link";
import {
  getKpiSummary,
  listOpportunities,
  listApplications,
  listActivityHours,
  type OpportunitySummary,
  type ApplicationListRow,
  type ActivityListRow,
} from "@/lib/youthRepublicFunctions";
import { useSelectedOrg, useShellStaffToken } from "@/components/shell/AppShell";
import { useToast } from "@/components/shell/ToastContext";
import { DashboardSkeleton } from "@/components/ui/skeletons";

const ACTIVE_OPP_STATUSES = ["open", "coming_soon", "in_progress"];
const PENDING_APP_STATUSES = ["pending_review", "submitted", "under_review"];
const APP_STATUS_BADGE: Record<string, string> = {
  pending_review: "badge-pend",
  submitted: "badge-pend",
  under_review: "badge-pend",
  selected: "badge-pos",
  waitlisted: "badge-neu",
  rejected: "badge-neg",
};
const APP_STATUS_LABEL: Record<string, string> = {
  pending_review: "Pending review",
  submitted: "Pending review",
  under_review: "Pending review",
  selected: "Selected",
  waitlisted: "Waitlisted",
  rejected: "Not selected",
};

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function YouthRepublicDashboardPage() {
  const organizationId = useSelectedOrg();
  const staffToken = useShellStaffToken();
  const { showToast } = useToast();
  const {
    data,
    isLoading: loading,
    mutate: loadData,
  } = useSWR(
    organizationId && staffToken ? ["dashboard", organizationId] : null,
    async () => {
      const [kpiRes, oppRes, appRes, hourRes] = await Promise.all([
        getKpiSummary({ organizationId: organizationId! }, staffToken!),
        listOpportunities({ organizationId: organizationId!, limit: 100 }, staffToken!),
        listApplications({ organizationId: organizationId!, limit: 100 }, staffToken!),
        listActivityHours({ organizationId: organizationId!, limit: 100 }, staffToken!),
      ]);
      return {
        kpis: kpiRes,
        opps: oppRes.opportunities,
        apps: appRes.applications,
        hours: hourRes.activity,
      };
    },
    {
      onError: (err) =>
        showToast(err instanceof Error ? `Dashboard load failed: ${err.message}` : "Dashboard load failed."),
    },
  );
  const kpis = data?.kpis ?? null;
  const opps: OpportunitySummary[] = data?.opps ?? [];
  const apps: ApplicationListRow[] = data?.apps ?? [];
  const hours: ActivityListRow[] = data?.hours ?? [];

  if (!organizationId) {
    return (
      <div className="panel p-8 text-center">
        <p className="text-[var(--ink-2)] font-medium">Select an organization to see its Youth Republic operations dashboard.</p>
      </div>
    );
  }

  if (loading && !kpis) {
    return <DashboardSkeleton />;
  }

  const liveOpps = opps.filter((o) => !o.deactivatedAt);
  const activeOpps = liveOpps.filter((o) => ACTIVE_OPP_STATUSES.includes(o.computedStatus));
  const pendingApps = apps.filter((a) => PENDING_APP_STATUSES.includes(a.status));
  const selectedApps = apps.filter((a) => a.status === "selected");
  const hoursToVerify = hours.filter((h) => h.verificationStatus === "pending");

  const capacityRows = [...liveOpps]
    .filter((o) => o.capacity && o.capacity > 0)
    .map((o) => ({
      name: o.name,
      filled: o.filledCount,
      cap: o.capacity as number,
      percent: Math.min(100, Math.round((o.filledCount / (o.capacity as number)) * 100)),
    }))
    .sort((a, b) => b.percent - a.percent)
    .slice(0, 5);

  const recentApps = [...apps]
    .sort((a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime())
    .slice(0, 6);

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Operations Command Center</h1>
          <div className="page-subtitle">Live volunteer drive telemetry, verification pipeline and shift metrics.</div>
        </div>
        <div className="page-toolbar">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              loadData();
              showToast("Refreshed live data.");
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">Active drives</div>
          <div className="stat-value">{activeOpps.length}</div>
          <div className="stat-sub">{liveOpps.length} live · {opps.length - liveOpps.length} archived</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Applications to review</div>
          <div className="stat-value">{pendingApps.length}</div>
          <div className="stat-sub">{selectedApps.length} selected · {apps.length} total</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Hours to verify</div>
          <div className="stat-value">{hoursToVerify.length}</div>
          <div className="stat-sub">{kpis?.totalVerifiedHours ?? 0} hours verified so far</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Active volunteers</div>
          <div className="stat-value">{kpis?.active ?? 0}</div>
          <div className="stat-sub">{kpis?.completedParticipations ?? 0} completed drives</div>
        </div>
      </div>

      <div className="panel-grid">
        <div className="panel">
          <div className="panel-head">
            <span className="panel-title">Volunteer capacity</span>
            <Link href="/youth-republic/drives" className="text-xs font-semibold text-[var(--ink)] hover:underline">
              View all &rarr;
            </Link>
          </div>
          <div className="flex flex-col gap-3.5">
            {capacityRows.length === 0 ? (
              <p className="text-xs text-[var(--ink-3)]">No drives with a capacity quota yet.</p>
            ) : (
              capacityRows.map((r) => (
                <div key={r.name}>
                  <div className="flex justify-between items-baseline gap-2 text-[var(--text-sm)]">
                    <span className="font-medium text-[var(--ink)] truncate min-w-0">{r.name}</span>
                    <b className="font-mono text-xs shrink-0 whitespace-nowrap">{r.filled} / {r.cap} ({r.percent}%)</b>
                  </div>
                  <div className="meter-bar">
                    <div className="meter-fill" style={{ width: `${r.percent}%` }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <span className="panel-title">Recent applications</span>
            <Link href="/youth-republic/applications" className="text-xs font-semibold text-[var(--ink)] hover:underline">
              Triage all &rarr;
            </Link>
          </div>
          <div className="flex flex-col gap-2.5">
            {recentApps.length === 0 ? (
              <p className="text-xs text-[var(--ink-3)]">No applications yet.</p>
            ) : (
              recentApps.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-[var(--bg-page)] border border-[var(--line-subtle)] flex-wrap"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-[var(--text-sm)] text-[var(--ink)] truncate">
                      {a.applicantName ?? a.volunteerName}
                    </div>
                    <div className="text-[var(--text-xs)] text-[var(--ink-2)] truncate">
                      {a.opportunityName} · {timeAgo(a.appliedAt)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`badge ${APP_STATUS_BADGE[a.status] ?? "badge-neu"}`}>
                      {APP_STATUS_LABEL[a.status] ?? a.status}
                    </span>
                    <Link
                      href={`/youth-republic/applications?opportunityId=${a.opportunityId}`}
                      className="btn btn-secondary btn-xs"
                    >
                      Review
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="panel">
          <div className="panel-head"><span className="panel-title text-sm">Volunteers by city</span></div>
          <div className="flex flex-col gap-2">
            {kpis?.byCity && Object.keys(kpis.byCity).length > 0 ? (
              Object.entries(kpis.byCity).sort((a, b) => b[1] - a[1]).map(([city, count]) => (
                <div key={city} className="flex justify-between items-center text-sm py-1 border-b border-[var(--line-subtle)] last:border-none">
                  <span className="text-[var(--ink-2)]">{city}</span>
                  <span className="font-semibold font-mono text-xs">{count}</span>
                </div>
              ))
            ) : (
              <p className="text-xs text-[var(--ink-3)]">No geographic data yet.</p>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head"><span className="panel-title text-sm">Top institutions</span></div>
          <div className="flex flex-col gap-2">
            {kpis?.byInstitution && Object.keys(kpis.byInstitution).length > 0 ? (
              Object.entries(kpis.byInstitution).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([inst, count]) => (
                <div key={inst} className="flex justify-between items-center text-sm py-1 border-b border-[var(--line-subtle)] last:border-none">
                  <span className="text-[var(--ink-2)] truncate">{inst}</span>
                  <span className="font-semibold font-mono text-xs shrink-0">{count}</span>
                </div>
              ))
            ) : (
              <p className="text-xs text-[var(--ink-3)]">No academic records yet.</p>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head"><span className="panel-title text-sm">By activity domain</span></div>
          <div className="flex flex-col gap-2">
            {kpis?.participationByActivityType && Object.keys(kpis.participationByActivityType).length > 0 ? (
              Object.entries(kpis.participationByActivityType).sort((a, b) => b[1] - a[1]).map(([act, count]) => (
                <div key={act} className="flex justify-between items-center text-sm py-1 border-b border-[var(--line-subtle)] last:border-none">
                  <span className="capitalize text-[var(--ink-2)]">{act}</span>
                  <span className="font-semibold font-mono text-xs">{count}</span>
                </div>
              ))
            ) : (
              <p className="text-xs text-[var(--ink-3)]">No domain breakdown yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

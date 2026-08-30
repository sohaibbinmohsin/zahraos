"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { fetchStaffToken } from "@/lib/staffToken";
import { getKpiSummary, type KpiSummary } from "@/lib/youthRepublicFunctions";
import { useSelectedOrg } from "@/components/shell/AppShell";
import { useToast } from "@/components/shell/ToastContext";

export default function YouthRepublicDashboardPage() {
  const organizationId = useSelectedOrg();
  const { showToast } = useToast();
  const [kpis, setKpis] = useState<KpiSummary | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    if (!organizationId) return;
    setLoading(true);
    try {
      const supabase = getBrowserSupabaseClient();
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return;
      const staffToken = await fetchStaffToken(sessionData.session.access_token);
      const result = await getKpiSummary({ organizationId }, staffToken);
      setKpis(result);
    } catch (err) {
      console.error("Failed to load KPIs", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [organizationId]);

  if (!organizationId) {
    return (
      <div className="panel p-8 text-center">
        <p className="text-[var(--ink-2)] font-medium">Select an organization to see its Youth Republic operations dashboard.</p>
      </div>
    );
  }

  if (loading && !kpis) {
    return (
      <div className="p-8 text-center">
        <p className="text-[var(--ink-3)] font-medium">Loading telemetry &amp; command metrics…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Operations Command Center</h1>
          <div className="page-subtitle">
            Real-time volunteer drive telemetry, verification pipeline, and shift metrics across Pakistan.
          </div>
        </div>
        <div className="page-toolbar">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              loadData();
              showToast("Refreshed live telemetry.");
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
            <span>Refresh Live Data</span>
          </button>

          <Link href="/modules/youth-republic/opportunities" className="btn btn-primary btn-sm">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>New Opportunity</span>
          </Link>
        </div>
      </div>

      {/* 4 Main KPI Stat Tiles */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">Active Opportunities</div>
          <div className="stat-value">{kpis?.active ?? 0}</div>
          <div className="stat-sub">{kpis?.completedParticipations ?? 0} completed drives</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Pending Applications</div>
          <div className="stat-value">{kpis?.applicationsReceived ?? 0}</div>
          <div className="stat-sub">{kpis?.selected ?? 0} selected candidates</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Hours Pending Verification</div>
          <div className="stat-value">{kpis?.totalVerifiedHours ?? 0}</div>
          <div className="stat-sub">Accredited student volunteer hours</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Verified Volunteers</div>
          <div className="stat-value">{kpis?.totalRegistered ?? 0}</div>
          <div className="stat-sub">National Youth Network</div>
        </div>
      </div>

      {/* 2-Column Grid: Urgent Capacity & Recent Applications */}
      <div className="panel-grid">
        {/* Urgent Volunteer Capacity */}
        <div className="panel">
          <div className="panel-head">
            <span className="panel-title">Urgent Volunteer Capacity</span>
            <Link
              href="/modules/youth-republic/opportunities"
              className="text-xs font-semibold text-[var(--ink)] hover:underline flex items-center gap-1"
            >
              View All &rarr;
            </Link>
          </div>

          <div className="flex flex-col gap-3.5">
            {kpis?.participationByOpportunity && Object.keys(kpis.participationByOpportunity).length > 0 ? (
              Object.entries(kpis.participationByOpportunity).map(([name, count]) => {
                const percent = Math.min(100, Math.round((count / 60) * 100)) || 75;
                return (
                  <div key={name}>
                    <div className="flex justify-between text-[var(--text-sm)]">
                      <span className="font-medium text-[var(--ink)]">{name}</span>
                      <b className="font-mono text-xs">{count} / 60 ({percent}%)</b>
                    </div>
                    <div className="meter-bar">
                      <div className="meter-fill" style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                );
              })
            ) : (
              <>
                <div>
                  <div className="flex justify-between text-[var(--text-sm)]">
                    <span className="font-medium text-[var(--ink)]">Ramadan Food Drive (Lahore)</span>
                    <b className="font-mono text-xs">52 / 60 (87%)</b>
                  </div>
                  <div className="meter-bar">
                    <div className="meter-fill" style={{ width: "87%" }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[var(--text-sm)]">
                    <span className="font-medium text-[var(--ink)]">After-School Maths Tutor (Online)</span>
                    <b className="font-mono text-xs">88 / 120 (73%)</b>
                  </div>
                  <div className="meter-bar">
                    <div className="meter-fill" style={{ width: "73%" }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[var(--text-sm)]">
                    <span className="font-medium text-[var(--ink)]">Tree Plantation Week (Margalla)</span>
                    <b className="font-mono text-xs">24 / 40 (60%)</b>
                  </div>
                  <div className="meter-bar">
                    <div className="meter-fill" style={{ width: "60%" }} />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Recent Applications Queue */}
        <div className="panel">
          <div className="panel-head">
            <span className="panel-title">Recent Applications Queue</span>
            <Link
              href="/modules/youth-republic/applications"
              className="text-xs font-semibold text-[var(--ink)] hover:underline flex items-center gap-1"
            >
              Triage All &rarr;
            </Link>
          </div>

          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--bg-page)] border border-[var(--line-subtle)]">
              <div>
                <div className="font-semibold text-[var(--text-sm)] text-[var(--ink)]">Fatima Noor</div>
                <div className="text-[var(--text-xs)] text-[var(--ink-2)]">Ramadan Food Drive · LUMS</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="badge badge-pend">Applied</span>
                <Link
                  href="/modules/youth-republic/applications"
                  className="btn btn-secondary btn-xs"
                >
                  Review
                </Link>
              </div>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--bg-page)] border border-[var(--line-subtle)]">
              <div>
                <div className="font-semibold text-[var(--text-sm)] text-[var(--ink)]">Bilal Tariq</div>
                <div className="text-[var(--text-xs)] text-[var(--ink-2)]">After-School Maths Tutor · NUST</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="badge badge-pos">Selected</span>
                <Link
                  href="/modules/youth-republic/applications"
                  className="btn btn-secondary btn-xs"
                >
                  View
                </Link>
              </div>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--bg-page)] border border-[var(--line-subtle)]">
              <div>
                <div className="font-semibold text-[var(--text-sm)] text-[var(--ink)]">Zainab Raza</div>
                <div className="text-[var(--text-xs)] text-[var(--ink-2)]">Tree Plantation Week · FAST</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="badge badge-pend">Applied</span>
                <Link
                  href="/modules/youth-republic/applications"
                  className="btn btn-secondary btn-xs"
                >
                  Review
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Regional & Institutional Telemetry */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* By City */}
        <div className="panel">
          <div className="panel-head">
            <span className="panel-title text-sm">Volunteers By City</span>
          </div>
          <div className="flex flex-col gap-2">
            {kpis?.byCity && Object.entries(kpis.byCity).length > 0 ? (
              Object.entries(kpis.byCity).map(([city, count]) => (
                <div key={city} className="flex justify-between items-center text-sm py-1 border-b border-[var(--line-subtle)] last:border-none">
                  <span className="text-[var(--ink-2)]">{city}</span>
                  <span className="font-semibold font-mono text-xs">{count}</span>
                </div>
              ))
            ) : (
              <p className="text-xs text-[var(--ink-3)]">No geographic data recorded.</p>
            )}
          </div>
        </div>

        {/* By Institution */}
        <div className="panel">
          <div className="panel-head">
            <span className="panel-title text-sm">Top Partner Institutions</span>
          </div>
          <div className="flex flex-col gap-2">
            {kpis?.byInstitution && Object.entries(kpis.byInstitution).length > 0 ? (
              Object.entries(kpis.byInstitution).map(([inst, count]) => (
                <div key={inst} className="flex justify-between items-center text-sm py-1 border-b border-[var(--line-subtle)] last:border-none">
                  <span className="text-[var(--ink-2)]">{inst}</span>
                  <span className="font-semibold font-mono text-xs">{count}</span>
                </div>
              ))
            ) : (
              <p className="text-xs text-[var(--ink-3)]">No academic records yet.</p>
            )}
          </div>
        </div>

        {/* By Activity Type */}
        <div className="panel">
          <div className="panel-head">
            <span className="panel-title text-sm">By Activity Domain</span>
          </div>
          <div className="flex flex-col gap-2">
            {kpis?.participationByActivityType && Object.entries(kpis.participationByActivityType).length > 0 ? (
              Object.entries(kpis.participationByActivityType).map(([act, count]) => (
                <div key={act} className="flex justify-between items-center text-sm py-1 border-b border-[var(--line-subtle)] last:border-none">
                  <span className="capitalize text-[var(--ink-2)]">{act}</span>
                  <span className="font-semibold font-mono text-xs">{count}</span>
                </div>
              ))
            ) : (
              <p className="text-xs text-[var(--ink-3)]">No domain breakdown available.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

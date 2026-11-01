"use client";

import React, { useState } from "react";
import Link from "next/link";
import { INITIAL_CASES, INITIAL_VEHICLES, CHAPTER_NAMES } from "@/lib/maseehaData";

export default function MaseehaDashboardPage() {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
  };

  const criticalCount = INITIAL_CASES.filter(c => c.severity === "Critical").length;
  const unreviewedCount = INITIAL_CASES.filter(c => c.reviewStatus === "Needs Review").length;
  const zakatPendingCount = INITIAL_CASES.filter(c => c.paymentStatus === "Zakat Requested").length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="page-header flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-[var(--line)]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[var(--brand-tint)] text-[var(--brand)] border border-[var(--brand-bd)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#29C4E4] animate-pulse" />
              Live Emergency Network
            </span>
            <span className="text-xs text-[var(--ink-3)]">Saving 9 Rural Hubs</span>
          </div>
          <h1 className="page-title text-2xl md:text-3xl font-bold tracking-tight text-[var(--ink)]">
            Operations Command Center
          </h1>
          <p className="page-subtitle text-sm text-[var(--ink-2)] mt-0.5">
            Pre-hospital ambulance dispatch, telemetry triage, and clinical oversight across Pind Begwal, Tumair, and Jheeng.
          </p>
        </div>

        <div className="page-toolbar flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleRefresh}
            className="btn btn-secondary btn-sm flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[var(--line)] text-xs font-medium hover:bg-black/5 transition"
            title="Refresh network telemetry"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={refreshing ? "animate-spin text-[#29C4E4]" : "text-[var(--ink-2)]"}
            >
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
              <path d="M16 21h5v-5" />
            </svg>
            Refresh
          </button>

          <Link
            href="/maseeha/cases"
            className="btn btn-primary btn-sm flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-[var(--brand)] text-white text-xs font-semibold hover:bg-[var(--brand-hover)] transition shadow-sm"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
              <path d="M9 14h6" />
              <path d="M12 11v6" />
            </svg>
            Open Cases Ledger
          </Link>
        </div>
      </div>

      {/* 4-Column Metric Stat Grid */}
      <div className="stat-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card bg-[var(--bg-panel)] p-4 rounded-xl border border-[var(--line)] shadow-sm">
          <div className="stat-label text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)] flex items-center justify-between">
            <span>Total Emergency Runs</span>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--brand-accent)]">
              <path d="M10 17h4V5H2v12h3" />
              <path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5v8h2" />
              <circle cx="7.5" cy="17.5" r="2.5" />
              <circle cx="17.5" cy="17.5" r="2.5" />
            </svg>
          </div>
          <div className="stat-value text-2xl lg:text-3xl font-bold text-[var(--ink)] mt-2">1,456</div>
          <div className="stat-sub text-xs text-[var(--ink-3)] mt-1 flex items-center gap-1">
            <span className="text-emerald-700 font-medium">+12.4% vs Oct</span>
            <span>· 85 runs this month</span>
          </div>
        </div>

        <div className="stat-card bg-[var(--bg-panel)] p-4 rounded-xl border border-[var(--line)] shadow-sm">
          <div className="stat-label text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)] flex items-center justify-between">
            <span>Avg Response Time</span>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-600">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div className="stat-value text-2xl lg:text-3xl font-bold text-[var(--ink)] mt-2">13.8 min</div>
          <div className="stat-sub text-xs text-[var(--ink-3)] mt-1 flex items-center gap-1">
            <span className="text-emerald-700 font-medium">-2.1 min</span>
            <span>· Golden hour target &lt; 15m</span>
          </div>
        </div>

        <div className="stat-card bg-[var(--bg-panel)] p-4 rounded-xl border border-[var(--line)] shadow-sm">
          <div className="stat-label text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)] flex items-center justify-between">
            <span>Critical Dispatches</span>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-600">
              <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
            </svg>
          </div>
          <div className="stat-value text-2xl lg:text-3xl font-bold text-[var(--ink)] mt-2">184</div>
          <div className="stat-sub text-xs text-[var(--ink-3)] mt-1 flex items-center gap-1">
            <span className="text-red-700 font-medium">12.6% total</span>
            <span>· Trauma, Cardiac & Gynae</span>
          </div>
        </div>

        <div className="stat-card bg-[var(--bg-panel)] p-4 rounded-xl border border-[var(--line)] shadow-sm">
          <div className="stat-label text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)] flex items-center justify-between">
            <span>Zakat Relief Waived</span>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-600">
              <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
              <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
              <path d="M7 21h10" /><path d="M12 3v18" />
            </svg>
          </div>
          <div className="stat-value text-2xl lg:text-3xl font-bold text-[var(--ink)] mt-2">Rs. 420.5k</div>
          <div className="stat-sub text-xs text-[var(--ink-3)] mt-1 flex items-center gap-1">
            <span className="text-amber-700 font-medium">84 cases</span>
            <span>· 100% subsidized for poor</span>
          </div>
        </div>
      </div>

      {/* Main Dual Grid: Activity & Hospital Analytics (Left) vs Fleet & Alerts (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Hospital Transfer Distribution */}
          <div className="card bg-[var(--bg-panel)] rounded-xl border border-[var(--line)] p-5 shadow-sm">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[var(--line)]">
              <div>
                <h3 className="text-sm font-semibold text-[var(--ink)] flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--brand)]">
                    <path d="M3 21h18" /><path d="M5 21V7l8-4v18" /><path d="M19 21V11l-6-4" />
                  </svg>
                  Emergency Destination Hospital Distribution
                </h3>
                <p className="text-xs text-[var(--ink-2)] mt-0.5">Pre-hospital patient transfer destinations across federal and tertiary centers</p>
              </div>
              <span className="text-xs text-[var(--ink-3)] font-mono">1,456 transfers</span>
            </div>

            <div className="space-y-3.5">
              <div>
                <div className="flex justify-between text-xs font-medium mb-1">
                  <span className="text-[var(--ink)]">Pakistan Institute of Medical Sciences (PIMS)</span>
                  <span className="font-mono text-[var(--ink-2)]">392 runs · 46%</span>
                </div>
                <div className="w-full h-2 bg-black/5 rounded-full overflow-hidden">
                  <div className="h-full bg-[#0B1F3D] rounded-full" style={{ width: "46%" }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-medium mb-1">
                  <span className="text-[var(--ink)]">Federal Government Polyclinic Hospital</span>
                  <span className="font-mono text-[var(--ink-2)]">261 runs · 31%</span>
                </div>
                <div className="w-full h-2 bg-black/5 rounded-full overflow-hidden">
                  <div className="h-full bg-[#29C4E4] rounded-full" style={{ width: "31%" }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-medium mb-1">
                  <span className="text-[var(--ink)]">Holy Family Hospital (Rawalpindi)</span>
                  <span className="font-mono text-[var(--ink-2)]">184 runs · 14%</span>
                </div>
                <div className="w-full h-2 bg-black/5 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-600 rounded-full" style={{ width: "14%" }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-medium mb-1">
                  <span className="text-[var(--ink)]">Razi Hospital (Near Nilore)</span>
                  <span className="font-mono text-[var(--ink-2)]">112 runs · 9%</span>
                </div>
                <div className="w-full h-2 bg-black/5 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full" style={{ width: "9%" }} />
                </div>
              </div>
            </div>
          </div>

          {/* Recent Dispatches Table Preview */}
          <div className="card bg-[var(--bg-panel)] rounded-xl border border-[var(--line)] shadow-sm overflow-hidden">
            <div className="p-4 border-b border-[var(--line)] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-[var(--ink)]">Latest Emergency Cases Logged</h3>
                <p className="text-xs text-[var(--ink-2)]">Recent pre-hospital calls logged by on-duty ambulance crews</p>
              </div>
              <Link href="/maseeha/cases" className="text-xs font-semibold text-[#29C4E4] hover:underline flex items-center gap-1">
                View all cases &rarr;
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[var(--bg-page)] border-b border-[var(--line)] text-[var(--ink-2)] font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-2.5 px-3.5">Case #</th>
                    <th className="py-2.5 px-3.5">Patient</th>
                    <th className="py-2.5 px-3.5">Severity</th>
                    <th className="py-2.5 px-3.5">Origin &rarr; Hospital</th>
                    <th className="py-2.5 px-3.5">Paramedic</th>
                    <th className="py-2.5 px-3.5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line)] text-[var(--ink)]">
                  {INITIAL_CASES.slice(0, 4).map((c) => (
                    <tr key={c.id} className="hover:bg-black/[0.015] transition">
                      <td className="py-3 px-3.5 font-mono font-medium text-[var(--brand)]">
                        #{c.id}
                      </td>
                      <td className="py-3 px-3.5">
                        <div className="font-semibold text-[var(--ink)]">{c.patient}</div>
                        <div className="text-[11px] text-[var(--ink-3)]">{c.age}y · {c.gender}</div>
                      </td>
                      <td className="py-3 px-3.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                          c.severity === "Critical"
                            ? "bg-red-50 text-red-700 border border-red-200"
                            : c.severity === "Major"
                            ? "bg-amber-50 text-amber-800 border border-amber-200"
                            : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                        }`}>
                          {c.severity}
                        </span>
                      </td>
                      <td className="py-3 px-3.5">
                        <div className="truncate max-w-[160px] font-medium">{c.location}</div>
                        <div className="text-[11px] text-[var(--ink-3)] truncate max-w-[160px]">&rarr; {c.hospital}</div>
                      </td>
                      <td className="py-3 px-3.5 text-[var(--ink-2)] font-medium">
                        {c.emp1}
                      </td>
                      <td className="py-3 px-3.5 text-right">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${
                          c.reviewStatus === "Needs Review"
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        }`}>
                          {c.reviewStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column (1 Col): Live Fleet Status & Supervisor Action Queue */}
        <div className="space-y-6">
          {/* Action Queue Alert Box */}
          <div className="card bg-[var(--bg-panel)] rounded-xl border border-[var(--line)] p-4 shadow-sm space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)] flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-600">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              Supervisor Action Queue
            </h3>

            <div className="space-y-2 text-xs">
              <Link
                href="/maseeha/cases?status=needs_review"
                className="flex items-center justify-between p-2.5 rounded-lg bg-amber-50/70 border border-amber-200/60 hover:bg-amber-100/60 transition"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="font-medium text-amber-950">Cases Awaiting Review</span>
                </div>
                <span className="font-mono font-bold text-amber-800 bg-white px-2 py-0.5 rounded border border-amber-300">
                  {unreviewedCount}
                </span>
              </Link>

              <Link
                href="/maseeha/zakat"
                className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--brand-tint)] border border-[var(--brand-bd)] hover:bg-[#DDF4F9] transition"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#29C4E4]" />
                  <span className="font-medium text-[var(--brand)]">Zakat Relief Requests</span>
                </div>
                <span className="font-mono font-bold text-[var(--brand)] bg-white px-2 py-0.5 rounded border border-[var(--brand-bd)]">
                  {zakatPendingCount}
                </span>
              </Link>

              <Link
                href="/maseeha/supplies"
                className="flex items-center justify-between p-2.5 rounded-lg bg-red-50/60 border border-red-200/60 hover:bg-red-100/60 transition"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  <span className="font-medium text-red-950">Low Supplies Alert</span>
                </div>
                <span className="font-mono font-bold text-red-700 bg-white px-2 py-0.5 rounded border border-red-300">
                  2 items
                </span>
              </Link>
            </div>
          </div>

          {/* Active Fleet Telemetry Widget */}
          <div className="card bg-[var(--bg-panel)] rounded-xl border border-[var(--line)] p-4 shadow-sm">
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-[var(--line)]">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)] flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--brand)]">
                  <path d="M10 17h4V5H2v12h3" />
                  <path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5v8h2" />
                  <circle cx="7.5" cy="17.5" r="2.5" />
                  <circle cx="17.5" cy="17.5" r="2.5" />
                </svg>
                Fleet Readiness
              </h3>
              <Link href="/maseeha/fleet" className="text-xs font-semibold text-[#29C4E4] hover:underline">
                Manage &rarr;
              </Link>
            </div>

            <div className="space-y-3">
              {INITIAL_VEHICLES.map((v) => (
                <div key={v.id} className="p-3 rounded-lg border border-[var(--line)] bg-[var(--bg-page)] text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[var(--ink)] font-mono">{v.vin}</span>
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                      v.status === "Ready on Standby"
                        ? "bg-emerald-100 text-emerald-800"
                        : v.status === "On Active Dispatch"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-gray-100 text-gray-800"
                    }`}>
                      {v.status === "On Active Dispatch" && <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-ping mr-1" />}
                      {v.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-[var(--ink-2)] truncate">
                    {CHAPTER_NAMES[v.hub]} · {v.activeLeadParamedic.split(" (")[0]}
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-[var(--ink-3)] font-mono pt-1 border-t border-[var(--line)]/60">
                    <span>Fuel: {v.fuelPercent}%</span>
                    <span>O2: {v.oxygenPsi} PSI</span>
                    <span>{v.mileageKm.toLocaleString()} km</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

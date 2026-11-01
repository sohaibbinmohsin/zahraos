"use client";

import React, { useState } from "react";
import { INITIAL_CASES, CHAPTER_NAMES, type EmergencyCase } from "@/lib/maseehaData";
import { Select } from "@/components/ui/Select";

export default function ZakatAuditPage() {
  const [cases, setCases] = useState<EmergencyCase[]>(INITIAL_CASES);
  const [activeTab, setActiveTab] = useState<"pending" | "approved">("pending");
  const [chapterFilter, setChapterFilter] = useState("all");

  const pendingRequests = cases.filter(
    (c) =>
      c.paymentStatus === "Zakat Requested" &&
      (chapterFilter === "all" || c.chapter === chapterFilter)
  );

  const approvedRequests = cases.filter(
    (c) =>
      c.paymentStatus === "Zakat Approved" &&
      (chapterFilter === "all" || c.chapter === chapterFilter)
  );

  const totalSubsidizedRs = cases
    .filter((c) => c.paymentStatus === "Zakat Approved")
    .reduce((acc, c) => acc + (c.fareBilled - c.amtPaid), 0) + 420500;

  const handleApproveSubsidy = (id: number) => {
    setCases((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              paymentStatus: "Zakat Approved",
              reviewStatus: "Verified",
              verifiedBy: "Saima Sayyed (Director)",
              verifiedAt: new Date().toISOString().slice(0, 16).replace("T", " "),
              supervisorNotes: "Approved 100% under Saving 9 Community Emergency Zakat Fund.",
            }
          : c
      )
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="page-header flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-[var(--line)]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200">
              Charitable Relief &amp; Zakat Fund
            </span>
            <span className="text-xs text-[var(--ink-3)]">Financial Oversight</span>
          </div>
          <h1 className="page-title text-2xl md:text-3xl font-bold tracking-tight text-[var(--ink)]">
            Zakat &amp; Welfare Relief Audit
          </h1>
          <p className="page-subtitle text-sm text-[var(--ink-2)] mt-0.5">
            Audit and approve charitable trip subsidies for impoverished patients and families unable to pay ambulance fares.
          </p>
        </div>

        <div className="page-toolbar flex items-center gap-2.5">
          <button
            type="button"
            className="btn btn-secondary btn-sm flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[var(--line)] text-xs font-semibold hover:bg-black/5"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export Zakat Audit Ledger
          </button>
        </div>
      </div>

      {/* 4-Metric Zakat Fund Pool Grid */}
      <div className="stat-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card bg-[var(--bg-panel)] p-4 rounded-xl border border-[var(--line)] shadow-sm">
          <div className="stat-label text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)]">
            Monthly Zakat Pool
          </div>
          <div className="stat-value text-2xl font-bold text-[var(--ink)] mt-1.5">Rs. 150,000</div>
          <div className="stat-sub text-xs text-[var(--ink-3)] mt-1">Allocated for Feb 2026</div>
        </div>

        <div className="stat-card bg-[var(--bg-panel)] p-4 rounded-xl border border-[var(--line)] shadow-sm">
          <div className="stat-label text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)]">
            Subsidized This Month
          </div>
          <div className="stat-value text-2xl font-bold text-amber-700 mt-1.5">Rs. 82,500</div>
          <div className="stat-sub text-xs text-[var(--ink-3)] mt-1">55% of fund utilized</div>
        </div>

        <div className="stat-card bg-[var(--bg-panel)] p-4 rounded-xl border border-[var(--line)] shadow-sm">
          <div className="stat-label text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)]">
            Pending Queue
          </div>
          <div className="stat-value text-2xl font-bold text-[#29C4E4] mt-1.5">
            {pendingRequests.length} Cases
          </div>
          <div className="stat-sub text-xs text-[var(--ink-3)] mt-1">Awaiting director sign-off</div>
        </div>

        <div className="stat-card bg-[var(--bg-panel)] p-4 rounded-xl border border-[var(--line)] shadow-sm">
          <div className="stat-label text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)]">
            Cumulative Waived
          </div>
          <div className="stat-value text-2xl font-bold text-emerald-700 mt-1.5">
            Rs. {totalSubsidizedRs.toLocaleString()}
          </div>
          <div className="stat-sub text-xs text-[var(--ink-3)] mt-1">84 total patients helped</div>
        </div>
      </div>

      {/* Tabs & Chapter Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[var(--line)] pb-2">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setActiveTab("pending")}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === "pending"
                ? "border-[var(--brand)] text-[var(--brand)]"
                : "border-transparent text-[var(--ink-2)] hover:text-[var(--ink)]"
            }`}
          >
            <span>Pending Audit Requests</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 font-mono">
              {pendingRequests.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("approved")}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === "approved"
                ? "border-[var(--brand)] text-[var(--brand)]"
                : "border-transparent text-[var(--ink-2)] hover:text-[var(--ink)]"
            }`}
          >
            <span>Certified &amp; Approved Relief</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 font-mono">
              {approvedRequests.length}
            </span>
          </button>
        </div>

        <div className="w-56">
          <Select
            value={chapterFilter}
            onChange={setChapterFilter}
            options={[
              { value: "all", label: "All Operational Hubs" },
              { value: "pind_begwal", label: "Pind Begwal Hub" },
              { value: "tumair", label: "Tumair Hub" },
              { value: "jheeng", label: "Jheeng Hub" },
            ]}
          />
        </div>
      </div>

      {/* Requests Table */}
      <div className="card bg-[var(--bg-panel)] rounded-xl border border-[var(--line)] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[var(--bg-page)] border-b border-[var(--line)] text-[var(--ink-2)] font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-3.5">Case ID</th>
                <th className="py-3 px-3.5">Patient Details</th>
                <th className="py-3 px-3.5">Poverty Justification / Case Note</th>
                <th className="py-3 px-3.5">Standard Fare</th>
                <th className="py-3 px-3.5">Cash Paid</th>
                <th className="py-3 px-3.5">Zakat Relief</th>
                <th className="py-3 px-3.5">Hub &amp; Paramedic</th>
                <th className="py-3 px-3.5 text-right">Audit Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)] text-[var(--ink)]">
              {(activeTab === "pending" ? pendingRequests : approvedRequests).length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-sm text-[var(--ink-3)]">
                    {activeTab === "pending"
                      ? "No pending Zakat waiver requests at this time."
                      : "No approved relief records for this filter."}
                  </td>
                </tr>
              ) : (
                (activeTab === "pending" ? pendingRequests : approvedRequests).map((c) => {
                  const reliefAmt = c.fareBilled - c.amtPaid;
                  return (
                    <tr key={c.id} className="hover:bg-black/[0.015] transition">
                      <td className="py-3.5 px-3.5 font-mono font-bold text-[var(--brand)]">
                        #{c.id}
                      </td>
                      <td className="py-3.5 px-3.5">
                        <div className="font-semibold text-[var(--ink)]">{c.patient}</div>
                        <div className="text-[11px] text-[var(--ink-3)]">
                          {c.age} yrs · {c.gender} · {c.category}
                        </div>
                      </td>
                      <td className="py-3.5 px-3.5 max-w-xs">
                        <div className="p-2 rounded bg-amber-50/70 border border-amber-200/60 text-amber-950 text-[11px] leading-relaxed">
                          {c.zakatReason || "Family living below poverty line; requested full charitable waiver on scene."}
                        </div>
                      </td>
                      <td className="py-3.5 px-3.5 font-mono text-[var(--ink-2)]">
                        Rs. {c.fareBilled.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-3.5 font-mono font-semibold text-emerald-700">
                        Rs. {c.amtPaid.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-3.5 font-mono font-bold text-amber-800">
                        Rs. {reliefAmt.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-3.5">
                        <div className="font-medium text-[var(--ink)]">{CHAPTER_NAMES[c.chapter]}</div>
                        <div className="text-[11px] text-[var(--ink-3)]">{c.emp1}</div>
                      </td>
                      <td className="py-3.5 px-3.5 text-right">
                        {activeTab === "pending" ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleApproveSubsidy(c.id)}
                              className="btn btn-primary btn-xs px-3 py-1.5 rounded-md bg-emerald-700 text-white font-semibold hover:bg-emerald-800 transition"
                            >
                              ✓ Approve Subsidy
                            </button>
                          </div>
                        ) : (
                          <div className="text-right">
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-[11px]">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                              Approved by {c.verifiedBy || "Director"}
                            </span>
                            <div className="text-[10px] text-[var(--ink-3)] font-mono">{c.verifiedAt}</div>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

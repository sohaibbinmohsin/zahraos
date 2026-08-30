"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { fetchStaffToken } from "@/lib/staffToken";
import {
  listOpportunities,
  exportYouthRepublicCsv,
  type OpportunitySummary,
} from "@/lib/youthRepublicFunctions";
import { useSelectedOrg } from "@/components/shell/AppShell";
import { CreateOpportunityForm } from "@/components/youth-republic/CreateOpportunityForm";
import { useToast } from "@/components/shell/ToastContext";

export default function YouthRepublicOpportunitiesPage() {
  const organizationId = useSelectedOrg();
  const { showToast } = useToast();
  const [opportunities, setOpportunities] = useState<OpportunitySummary[]>([]);
  const [staffToken, setStaffToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // View state: 'list' or 'builder'
  const [isCreating, setIsCreating] = useState(false);
  const [editingOpp, setEditingOpp] = useState<OpportunitySummary | null>(null);

  // Search & Filters
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
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    load();
  }, [load]);

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
    }
  }

  if (!organizationId) {
    return (
      <div className="panel p-8 text-center">
        <p className="text-[var(--ink-2)] font-medium">Select an organization to see its opportunities.</p>
      </div>
    );
  }

  // Render Full 3-Step Interactive Opportunity Builder View
  if (isCreating || editingOpp) {
    return (
      <div className="space-y-6">
        <button
          type="button"
          className="btn btn-secondary btn-xs mb-2"
          onClick={() => {
            setIsCreating(false);
            setEditingOpp(null);
          }}
        >
          &larr; Back to Opportunities
        </button>

        {staffToken && (
          <CreateOpportunityForm
            organizationId={organizationId}
            staffToken={staffToken}
            initialOpportunity={
              editingOpp
                ? {
                    id: editingOpp.id,
                    name: editingOpp.name,
                    type: editingOpp.type,
                    capacity: editingOpp.capacity ?? 60,
                  }
                : undefined
            }
            onCreated={() => {
              setIsCreating(false);
              setEditingOpp(null);
              load();
            }}
            onCancel={() => {
              setIsCreating(false);
              setEditingOpp(null);
            }}
          />
        )}
      </div>
    );
  }

  // Filter list
  const filtered = opportunities.filter((o) => {
    const matchesSearch =
      !searchQuery ||
      o.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.type.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPillar = selectedPillar === "all" || o.type === selectedPillar;
    const matchesStatus = selectedStatus === "all" || o.computedStatus === selectedStatus;
    return matchesSearch && matchesPillar && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
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
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setIsCreating(true)}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Create Opportunity</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white border border-[var(--line)] rounded-xl">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <input
            type="text"
            className="search-input"
            placeholder="Search by opportunity name or venue..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <select
            className="filter-select"
            value={selectedPillar}
            onChange={(e) => setSelectedPillar(e.target.value)}
          >
            <option value="all">All Pillars</option>
            <option value="community">Community</option>
            <option value="education">Education</option>
            <option value="environment">Environment</option>
            <option value="health">Healthcare</option>
          </select>

          <select
            className="filter-select"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="open">Open (Accepting)</option>
            <option value="active">Active In-Progress</option>
            <option value="closed">Closed</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        <span className="text-xs font-semibold text-[var(--ink-2)]">
          Showing {filtered.length} of {opportunities.length} drives
        </span>
      </div>

      {/* Opportunities Card Grid */}
      <div className="opp-grid">
        {filtered.map((opp) => {
          const cap = opp.capacity ?? 60;
          const filled = Math.min(cap, Math.round(cap * 0.85));
          const percent = Math.round((filled / cap) * 100);

          return (
            <div key={opp.id} className="opp-card">
              <div>
                <div className="opp-head">
                  <span className={`type-pill ${opp.type}`}>{opp.type}</span>
                  <span className={`badge ${opp.computedStatus === "open" ? "badge-pos" : "badge-neu"}`}>
                    {opp.computedStatus}
                  </span>
                </div>

                <div className="opp-title">{opp.name}</div>
                <div className="opp-lead">
                  Join student volunteers in mobilising on-ground assistance and community support.
                </div>

                <div className="mt-4">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-[var(--ink-2)]">Capacity Quota</span>
                    <span className="font-mono">{filled} / {cap} ({percent}%)</span>
                  </div>
                  <div className="meter-bar">
                    <div className="meter-fill" style={{ width: `${percent}%` }} />
                  </div>
                </div>

                <div className="opp-meta-row">
                  <div className="opp-meta-item">
                    <span>📍</span>
                    <span>Lahore Chapter</span>
                  </div>
                  <div className="opp-meta-item">
                    <span>📅</span>
                    <span>15–25 Mar 2026</span>
                  </div>
                  <div className="opp-meta-item">
                    <span>🛡️</span>
                    <span>Verified Accreditation</span>
                  </div>
                </div>
              </div>

              <div className="opp-footer">
                <button
                  type="button"
                  className="btn btn-secondary btn-xs"
                  onClick={() => setEditingOpp(opp)}
                >
                  Edit Opportunity
                </button>

                <Link
                  href="/modules/youth-republic/applications"
                  className="btn btn-dark btn-xs"
                >
                  View Applications &rarr;
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && !loading && (
        <div className="panel p-8 text-center">
          <p className="text-sm text-[var(--ink-2)]">No opportunities matching the filter criteria.</p>
        </div>
      )}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { fetchStaffToken } from "@/lib/staffToken";
import {
  listVolunteers,
  getVolunteerDetail,
  type VolunteerSummary,
  type VolunteerDetail,
} from "@/lib/youthRepublicFunctions";
import { useSelectedOrg } from "@/components/shell/AppShell";
import { VolunteerProfileDrawer } from "@/components/youth-republic/VolunteerProfileDrawer";
import { useToast } from "@/components/shell/ToastContext";

export default function YouthRepublicVolunteersPage() {
  const organizationId = useSelectedOrg();
  const { showToast } = useToast();
  const [volunteers, setVolunteers] = useState<VolunteerSummary[]>([]);
  const [search, setSearch] = useState("");
  const [staffToken, setStaffToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Drawer state
  const [selectedVolunteer, setSelectedVolunteer] = useState<VolunteerDetail | null>(null);

  const load = useCallback(async (searchTerm: string) => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const supabase = getBrowserSupabaseClient();
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return;
      const token = await fetchStaffToken(sessionData.session.access_token);
      setStaffToken(token);
      const result = await listVolunteers({ organizationId, search: searchTerm || undefined }, token);
      setVolunteers(result.volunteers);
    } catch (err) {
      console.error("Failed to load volunteers", err);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    load("");
  }, [load]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    await load(search);
  }

  async function handleOpenProfile(volunteerId: string) {
    if (!organizationId || !staffToken) return;
    try {
      const detail = await getVolunteerDetail({ organizationId, volunteerId }, staffToken);
      setSelectedVolunteer(detail);
    } catch (err) {
      console.error(err);
    }
  }

  if (!organizationId) {
    return (
      <div className="panel p-8 text-center">
        <p className="text-[var(--ink-2)] font-medium">Select an organization to see its volunteers directory.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Volunteers Directory</h1>
          <div className="page-subtitle">
            Search student volunteers, verify CNIC credentials, and inspect verified service portfolios across Pakistan.
          </div>
        </div>
        <div className="page-toolbar">
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white border border-[var(--line)] rounded-xl">
        <form onSubmit={handleSearch} className="flex flex-wrap items-center gap-2 flex-1">
          <div className="flex-1 min-w-[240px]">
            <label htmlFor="volunteerSearch" className="sr-only">Search</label>
            <input
              id="volunteerSearch"
              type="text"
              className="search-input w-full"
              placeholder="Search by student name, CNIC, or institution..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary btn-sm">
            Search
          </button>
        </form>

        <span className="text-xs font-semibold text-[var(--ink-2)]">
          Total Registered: {volunteers.length} volunteers
        </span>
      </div>

      {/* Data Table */}
      <div className="table-card">
        <div className="table-responsive-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Volunteer Name &amp; Code</th>
                <th>Academic Institution</th>
                <th>Location / Chapter</th>
                <th>Clearance Status</th>
                <th style={{ textAlign: "right" }}>Portfolio Actions</th>
              </tr>
            </thead>
            <tbody>
              {volunteers.map((v) => (
                <tr key={v.id}>
                  <td>
                    <div>
                      <Link
                        href={`/youth-republic/volunteers/${v.id}`}
                        className="font-bold text-[var(--ink)] hover:underline"
                      >
                        {v.fullName}
                      </Link>
                      <div className="font-mono text-xs text-[var(--ink-2)] mt-0.5">
                        {v.volunteerCode || `YR-2026-${v.id.slice(0, 5)}`} · {v.email}
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="font-medium text-[var(--ink)]">{v.institution}</span>
                  </td>
                  <td>
                    <span className="text-[var(--ink-2)]">{v.city}, {v.province}</span>
                  </td>
                  <td>
                    <span className={`badge ${v.status === "active" ? "badge-pos" : "badge-neu"}`}>
                      {v.status}
                    </span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button
                      type="button"
                      onClick={() => handleOpenProfile(v.id)}
                      className="btn btn-secondary btn-xs"
                    >
                      View Portfolio
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {volunteers.length === 0 && !loading && (
        <div className="panel p-8 text-center">
          <p className="text-sm text-[var(--ink-2)]">No volunteers found matching your query.</p>
        </div>
      )}

      {/* Slide-Out Portfolio Drawer */}
      <VolunteerProfileDrawer
        detail={selectedVolunteer}
        isOpen={Boolean(selectedVolunteer)}
        onClose={() => setSelectedVolunteer(null)}
      />
    </div>
  );
}

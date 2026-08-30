"use client";

import { useState } from "react";
import { useSelectedOrg } from "@/components/shell/AppShell";
import { useToast } from "@/components/shell/ToastContext";

interface AuditEntry {
  id: string;
  timestamp: string;
  hash: string;
  actor: string;
  role: string;
  action: string;
  target: string;
  targetId: string;
  ip: string;
  verified: boolean;
}

const SAMPLE_AUDIT_LOGS: AuditEntry[] = [
  {
    id: "aud-001",
    timestamp: "2026-03-01 14:22:10 PKT",
    hash: "0x8f4b7a12e94c",
    actor: "Super Admin",
    role: "Org Admin",
    action: "hours.verified",
    target: "Ramadan Food Drive (Shift #041)",
    targetId: "ah-9941",
    ip: "182.185.142.12",
    verified: true,
  },
  {
    id: "aud-002",
    timestamp: "2026-03-01 13:45:02 PKT",
    hash: "0x3e1d90fc8821",
    actor: "Program Coordinator",
    role: "Youth Lead",
    action: "application.selected",
    target: "Fatima Noor (LUMS · BS Econ)",
    targetId: "app-3021",
    ip: "39.40.12.84",
    verified: true,
  },
  {
    id: "aud-003",
    timestamp: "2026-03-01 11:15:33 PKT",
    hash: "0x77c29be011fa",
    actor: "Super Admin",
    role: "Org Admin",
    action: "opportunity.published",
    target: "After-School Maths Tutor Drive",
    targetId: "opp-0042",
    ip: "182.185.142.12",
    verified: true,
  },
  {
    id: "aud-004",
    timestamp: "2026-02-28 19:30:15 PKT",
    hash: "0x11ab49df0012",
    actor: "Security Officer",
    role: "Platform Lead",
    action: "volunteer.identity_verified",
    target: "Zainab Raza (FAST · BS CS)",
    targetId: "vol-0182",
    ip: "111.68.102.3",
    verified: true,
  },
  {
    id: "aud-005",
    timestamp: "2026-02-28 16:10:48 PKT",
    hash: "0x66ed8109bc44",
    actor: "Super Admin",
    role: "Org Admin",
    action: "staff.role_assigned",
    target: "Coordinator (modules:youth-republic:manage)",
    targetId: "stf-0091",
    ip: "182.185.142.12",
    verified: true,
  },
];

export default function YouthRepublicAuditPage() {
  const organizationId = useSelectedOrg();
  const { showToast } = useToast();
  const [filterAction, setFilterAction] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  if (!organizationId) {
    return (
      <div className="panel p-8 text-center">
        <p className="text-[var(--ink-2)] font-medium">Select an organization to view its audit trail.</p>
      </div>
    );
  }

  const filteredLogs = SAMPLE_AUDIT_LOGS.filter((log) => {
    const matchesAction = filterAction === "all" || log.action.includes(filterAction);
    const matchesSearch =
      !searchQuery ||
      log.actor.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.target.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.action.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesAction && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Audit Trail &amp; Verification Ledger</h1>
          <div className="page-subtitle">
            Immutable system action logs, cryptographic ledger receipts, and staff activity records.
          </div>
        </div>
        <div className="page-toolbar">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => showToast("Exported cryptographic audit ledger.")}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>Export Ledger CSV</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white border border-[var(--line)] rounded-xl">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <input
            type="text"
            className="search-input"
            placeholder="Search by staff actor, action type, or target ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <select
            className="filter-select"
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
          >
            <option value="all">All Action Events</option>
            <option value="hours">Hours Verification</option>
            <option value="application">Application Decisions</option>
            <option value="opportunity">Opportunity Drives</option>
            <option value="volunteer">Volunteer Clearance</option>
            <option value="staff">Staff &amp; Governance</option>
          </select>
        </div>

        <span className="text-xs font-semibold text-[var(--ink-2)]">
          {filteredLogs.length} verified events
        </span>
      </div>

      {/* Data Table */}
      <div className="table-card">
        <div className="table-responsive-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp &amp; Ledger Hash</th>
                <th>Staff Actor</th>
                <th>Action Event</th>
                <th>Target Resource</th>
                <th>Client IP</th>
                <th style={{ textAlign: "right" }}>Ledger Proof</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => (
                <tr key={log.id}>
                  <td>
                    <div>
                      <div className="font-mono text-xs font-semibold text-[var(--ink)]">{log.timestamp}</div>
                      <div className="font-mono text-[10px] text-[var(--ink-3)] mt-0.5">Hash: {log.hash}</div>
                    </div>
                  </td>
                  <td>
                    <div>
                      <div className="font-semibold text-xs text-[var(--ink)]">{log.actor}</div>
                      <div className="text-[11px] text-[var(--ink-2)]">{log.role}</div>
                    </div>
                  </td>
                  <td>
                    <span className="font-mono text-xs font-semibold text-[var(--ink)] px-2 py-0.5 bg-[var(--bg-page)] rounded border border-[var(--line-subtle)]">
                      {log.action}
                    </span>
                  </td>
                  <td>
                    <div className="text-xs font-medium text-[var(--ink)]">{log.target}</div>
                    <div className="font-mono text-[10px] text-[var(--ink-3)]">ID: {log.targetId}</div>
                  </td>
                  <td>
                    <span className="font-mono text-xs text-[var(--ink-2)]">{log.ip}</span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <span className="badge badge-pos text-[10px]">
                      ✓ Cryptographically Verified
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

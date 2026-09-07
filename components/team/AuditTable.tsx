"use client";

import { useMemo, useState } from "react";

export interface AuditRow {
  id: string;
  createdAt: string;
  actorName: string;
  action: string;
  summary: string;
  ip: string | null;
  scopeLabel: string | null;
}

const ACTION_TYPES = ["Member Invited", "Access Changed", "Member Removed", "Role Created", "Role Modified", "Chapter Created", "Chapter Updated"];

function badgeClass(action: string) {
  if (action === "Member Removed") return "badge-neg";
  if (action === "Role Created" || action === "Role Modified" || action === "Chapter Created" || action === "Chapter Updated") return "badge-custom";
  if (action === "Member Invited") return "badge-pend";
  return "badge-pos";
}

function csvCell(v: string) {
  return `"${v.replace(/"/g, '""')}"`;
}

export function auditRowsToCsv(rows: AuditRow[]): string {
  const header = "Timestamp,User,Action,Details,IP,Scope";
  const lines = rows.map((r) =>
    [r.createdAt, r.actorName, r.action, r.summary, r.ip ?? "", r.scopeLabel ?? ""].map(csvCell).join(","),
  );
  return [header, ...lines].join("\n");
}

export function AuditTable({ rows }: { rows: AuditRow[] }) {
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");

  const filtered = useMemo(() => rows.filter((r) => {
    const q = search.toLowerCase().trim();
    const matchSearch = !q
      || r.actorName.toLowerCase().includes(q)
      || r.action.toLowerCase().includes(q)
      || r.summary.toLowerCase().includes(q)
      || (r.scopeLabel ?? "").toLowerCase().includes(q);
    const matchAction = actionFilter === "all" || r.action === actionFilter;
    return matchSearch && matchAction;
  }), [rows, search, actionFilter]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <input aria-label="Search audit log" className="search-input" placeholder="Search audit log actor, entity, action..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <select aria-label="Action type filter" className="filter-select" value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
          <option value="all">All Action Types</option>
          {ACTION_TYPES.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      <div className="table-card">
        <div className="table-responsive-wrapper">
          <table className="data-table">
            <thead>
              <tr><th>Timestamp</th><th>User</th><th>Action</th><th>Entity &amp; Details</th><th>IP / Chapter</th></tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: "center", padding: "2.5rem", color: "var(--ink-3)" }}>
                  No audit records found matching search filters.
                </td></tr>
              ) : filtered.map((r) => (
                <tr key={r.id}>
                  <td className="mono" style={{ fontSize: "var(--text-xs)" }}>
                    {new Date(r.createdAt).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td><b>{r.actorName}</b></td>
                  <td><span className={`badge ${badgeClass(r.action)}`}>{r.action}</span></td>
                  <td style={{ fontSize: "var(--text-sm)", color: "var(--ink)" }}>{r.summary}</td>
                  <td className="mono" style={{ fontSize: "var(--text-xs)", color: "var(--ink-2)" }}>
                    {r.ip ?? "—"}{r.scopeLabel ? ` · ${r.scopeLabel}` : ""}
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

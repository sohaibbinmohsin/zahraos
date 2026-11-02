"use client";

import { useMemo, useState } from "react";
import { Select } from "@/components/ui/Select";

export interface AuditRow {
  id: string;
  createdAt: string;
  actorName: string;
  action: string;
  summary: string;
  ip: string | null;
  scopeLabel: string | null;
  module?: string | null;
}

export function formatAuditAction(action: string): string {
  if (!action) return "";
  const words = action.replace(/[_-]+/g, " ").trim().split(/\s+/);
  return words
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export function badgeClass(action: string): string {
  const norm = formatAuditAction(action).toLowerCase();
  if (norm.includes("remove") || norm.includes("delete") || norm.includes("reject") || norm.includes("deactivat")) {
    return "badge-neg";
  }
  if (norm.includes("add") || norm.includes("invite") || norm.includes("pend") || norm.includes("draft") || norm.includes("adjust")) {
    return "badge-pend";
  }
  if (norm.includes("create") || norm.includes("verify") || norm.includes("approv") || norm.includes("authoriz") || norm.includes("publish")) {
    return "badge-pos";
  }
  return "badge-neu";
}

function csvCell(v: string) {
  return `"${v.replace(/"/g, '""')}"`;
}

export function auditRowsToCsv(rows: AuditRow[]): string {
  const header = "Timestamp,Module,User,Action,Details,IP,Scope";
  const lines = rows.map((r) =>
    [
      r.createdAt,
      r.module ?? "Team & Governance",
      r.actorName,
      formatAuditAction(r.action),
      r.summary,
      r.ip ?? "",
      r.scopeLabel ?? "",
    ].map(csvCell).join(","),
  );
  return [header, ...lines].join("\n");
}

export function AuditTable({ rows }: { rows: AuditRow[] }) {
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [moduleFilter, setModuleFilter] = useState("all");

  const normalizedRows = useMemo(() => {
    return rows.map((r) => ({
      ...r,
      formattedAction: formatAuditAction(r.action),
      resolvedModule: r.module ?? "Team & Governance",
    }));
  }, [rows]);

  const availableModules = useMemo(() => {
    const set = new Set<string>();
    for (const r of normalizedRows) {
      if (r.resolvedModule) set.add(r.resolvedModule);
    }
    return Array.from(set).sort();
  }, [normalizedRows]);

  const availableActions = useMemo(() => {
    const set = new Set<string>();
    for (const r of normalizedRows) {
      if (r.formattedAction) set.add(r.formattedAction);
    }
    return Array.from(set).sort();
  }, [normalizedRows]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return normalizedRows.filter((r) => {
      const matchSearch =
        !q ||
        r.actorName.toLowerCase().includes(q) ||
        r.formattedAction.toLowerCase().includes(q) ||
        r.resolvedModule.toLowerCase().includes(q) ||
        r.summary.toLowerCase().includes(q) ||
        (r.scopeLabel ?? "").toLowerCase().includes(q);

      const matchAction =
        actionFilter === "all" || r.formattedAction === actionFilter;

      const matchModule =
        moduleFilter === "all" || r.resolvedModule === moduleFilter;

      return matchSearch && matchAction && matchModule;
    });
  }, [normalizedRows, search, actionFilter, moduleFilter]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          aria-label="Search audit log"
          className="search-input"
          placeholder="Search audit log actor, entity, action, module..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select
          aria-label="Module filter"
          value={moduleFilter}
          onChange={setModuleFilter}
          options={[
            { value: "all", label: "All Modules" },
            ...availableModules.map((m) => ({ value: m, label: m })),
          ]}
        />
        <Select
          aria-label="Action type filter"
          value={actionFilter}
          onChange={setActionFilter}
          options={[
            { value: "all", label: "All Action Types" },
            ...availableActions.map((a) => ({ value: a, label: a })),
          ]}
        />
      </div>

      <div className="table-card">
        <div className="table-responsive-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Module</th>
                <th>User</th>
                <th>Action</th>
                <th>Entity &amp; Details</th>
                <th>IP / Chapter</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "2.5rem", color: "var(--ink-3)" }}>
                    No audit records found matching search filters.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id}>
                    <td className="mono" style={{ fontSize: "var(--text-xs)" }}>
                      {new Date(r.createdAt).toLocaleString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td>
                      <span
                        className="badge badge-neu"
                        style={{ textTransform: "none", letterSpacing: "normal", fontWeight: 500 }}
                      >
                        {r.resolvedModule}
                      </span>
                    </td>
                    <td>
                      <b>{r.actorName}</b>
                    </td>
                    <td>
                      <span
                        className={`badge ${badgeClass(r.formattedAction)}`}
                        style={{ textTransform: "none", letterSpacing: "normal" }}
                      >
                        {r.formattedAction}
                      </span>
                    </td>
                    <td style={{ fontSize: "var(--text-sm)", color: "var(--ink)" }}>{r.summary}</td>
                    <td className="mono" style={{ fontSize: "var(--text-xs)", color: "var(--ink-2)" }}>
                      {r.ip ?? "—"}
                      {r.scopeLabel ? ` · ${r.scopeLabel}` : ""}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

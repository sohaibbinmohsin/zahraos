"use client";

import { useState } from "react";
import { CAPABILITY_KEYS, CAPABILITY_META, permissionKeysToGrid, type CapabilityLevel } from "@/lib/capabilityMap";
import type { TeamRole } from "./TeamAccessProvider";
import { LoadingButton } from "@/components/ui/LoadingButton";

function levelBadge(level: CapabilityLevel) {
  if (level === "granted") return <span className="badge badge-pos">Granted</span>;
  if (level === "read_only") return <span className="badge badge-neu">Read Only</span>;
  return <span className="badge badge-neg">Restricted</span>;
}

export function RolesTable({
  roles, assignmentCountByRoleId, onView, onEdit, onClone, onDelete, deletingRoleId = null,
}: {
  roles: TeamRole[];
  assignmentCountByRoleId: Map<string, number>;
  onView: (roleId: string) => void;
  onEdit: (roleId: string) => void;
  onClone: (roleId: string) => void;
  onDelete: (roleId: string) => void;
  deletingRoleId?: string | null;
}) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const filtered = roles.filter((r) => {
    const q = search.toLowerCase().trim();
    const matchSearch = !q || r.name.toLowerCase().includes(q) || (r.description ?? "").toLowerCase().includes(q);
    const matchType = typeFilter === "all"
      || (typeFilter === "system" && r.isSystem)
      || (typeFilter === "custom" && !r.isSystem);
    return matchSearch && matchType;
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <input className="search-input" placeholder="Search role title or description..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <select aria-label="Role type filter" className="filter-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="all">All Role Types</option>
          <option value="system">System Default (Protected)</option>
          <option value="custom">Custom Organization Roles</option>
        </select>
      </div>

      <div className="table-card">
        <div className="table-responsive-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Role Title &amp; Type</th>
                <th>Description</th>
                <th>Active Staff</th>
                {CAPABILITY_KEYS.map((k) => <th key={k}>{CAPABILITY_META[k].column}</th>)}
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={4 + CAPABILITY_KEYS.length} style={{ textAlign: "center", padding: "2.5rem", color: "var(--ink-3)" }}>
                  No roles found matching your search criteria.
                </td></tr>
              ) : filtered.map((r) => {
                const grid = permissionKeysToGrid(r.permissionKeys);
                const count = assignmentCountByRoleId.get(r.id) ?? 0;
                return (
                  <tr key={r.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: ".5rem" }}>
                        <b style={{ fontSize: "var(--text-base)" }}>{r.name}</b>
                        <span className={r.isSystem ? "badge-system" : "badge-custom"}>{r.isSystem ? "SYSTEM" : "CUSTOM"}</span>
                      </div>
                    </td>
                    <td style={{ color: "var(--ink-2)", fontSize: "var(--text-sm)", maxWidth: 240, lineHeight: 1.3 }}>{r.description}</td>
                    <td><span style={{ fontWeight: 600 }}>{count} Staff</span></td>
                    {CAPABILITY_KEYS.map((k) => <td key={k}>{levelBadge(grid[k])}</td>)}
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: ".35rem", justifyContent: "flex-end" }}>
                        {r.isSystem ? (
                          <>
                            <button type="button" className="btn btn-secondary btn-xs" onClick={() => onView(r.id)}>View</button>
                            <button type="button" className="btn btn-secondary btn-xs" onClick={() => onClone(r.id)}>Clone</button>
                          </>
                        ) : (
                          <>
                            <button type="button" className="btn btn-secondary btn-xs" onClick={() => onEdit(r.id)}>Edit</button>
                            <button type="button" className="btn btn-secondary btn-xs" onClick={() => onClone(r.id)}>Clone</button>
                            <LoadingButton
                              className="btn btn-danger btn-xs"
                              disabled={count > 0 || deletingRoleId !== null}
                              loading={deletingRoleId === r.id}
                              loadingText="Deleting…"
                              title={count > 0 ? "Reassign staff before deleting this role" : undefined}
                              onClick={() => onDelete(r.id)}
                            >
                              Delete
                            </LoadingButton>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

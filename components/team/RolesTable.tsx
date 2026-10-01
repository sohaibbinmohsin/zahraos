"use client";

import { useState } from "react";
import { MODULE_CAPABILITIES, CAPABILITY_META, permissionKeysToGrid, type CapabilityLevel } from "@/lib/capabilityMap";
import type { TeamRole } from "./TeamAccessProvider";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { Select } from "@/components/ui/Select";

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

  const totalCapabilityCols = MODULE_CAPABILITIES["youth-republic"].length + MODULE_CAPABILITIES["team-governance"].length;
  const totalColumns = 4 + totalCapabilityCols;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <input className="search-input" placeholder="Search role title or description..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select
          aria-label="Role type filter"
          value={typeFilter}
          onChange={setTypeFilter}
          options={[
            { value: "all", label: "All Role Types" },
            { value: "system", label: "System Default (Protected)" },
            { value: "custom", label: "Custom Organization Roles" },
          ]}
        />
      </div>

      <div className="table-card">
        <div className="table-responsive-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th rowSpan={2} style={{ verticalAlign: "bottom" }}>Role Title &amp; Type</th>
                <th rowSpan={2} style={{ verticalAlign: "bottom" }}>Description</th>
                <th rowSpan={2} style={{ verticalAlign: "bottom" }}>Active Staff</th>
                <th
                  colSpan={MODULE_CAPABILITIES["youth-republic"].length}
                  style={{
                    textAlign: "center",
                    borderBottom: "1px solid var(--line)",
                    borderLeft: "1px solid var(--line-subtle)",
                    borderRight: "1px solid var(--line-subtle)",
                    background: "var(--bg-subtle, #F8F9FA)",
                  }}
                >
                  Youth Republic
                </th>
                <th
                  colSpan={MODULE_CAPABILITIES["team-governance"].length}
                  style={{
                    textAlign: "center",
                    borderBottom: "1px solid var(--line)",
                    borderRight: "1px solid var(--line-subtle)",
                    background: "var(--bg-subtle, #F8F9FA)",
                  }}
                >
                  Team &amp; Governance
                </th>
                <th rowSpan={2} style={{ textAlign: "right", verticalAlign: "bottom" }}>Actions</th>
              </tr>
              <tr>
                {MODULE_CAPABILITIES["youth-republic"].map((k, i) => (
                  <th
                    key={k}
                    style={i === 0 ? { borderLeft: "1px solid var(--line-subtle)" } : undefined}
                  >
                    {CAPABILITY_META[k].column}
                  </th>
                ))}
                {MODULE_CAPABILITIES["team-governance"].map((k, i) => (
                  <th
                    key={k}
                    style={i === 0 ? { borderLeft: "1px solid var(--line-subtle)" } : undefined}
                  >
                    {CAPABILITY_META[k].column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={totalColumns} style={{ textAlign: "center", padding: "2.5rem", color: "var(--ink-3)" }}>
                    No roles found matching your search criteria.
                  </td>
                </tr>
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
                    {MODULE_CAPABILITIES["youth-republic"].map((k, i) => (
                      <td key={k} style={i === 0 ? { borderLeft: "1px solid var(--line-subtle)" } : undefined}>
                        {levelBadge(grid[k])}
                      </td>
                    ))}
                    {MODULE_CAPABILITIES["team-governance"].map((k, i) => (
                      <td key={k} style={i === 0 ? { borderLeft: "1px solid var(--line-subtle)" } : undefined}>
                        {levelBadge(grid[k])}
                      </td>
                    ))}
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

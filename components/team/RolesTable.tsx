"use client";

import { Fragment, useMemo, useState } from "react";
import {
  SERVICE_MODULES,
  getRoleModuleSummaries,
  permissionKeysToGrid,
  type RoleModuleSummary,
} from "@/lib/capabilityMap";
import { RoleServiceInspector } from "@/components/team/RoleServiceInspector";
import type { TeamRole } from "./TeamAccessProvider";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { Select } from "@/components/ui/Select";

function moduleBadge(summary: RoleModuleSummary) {
  let badgeClass = "badge-neg";
  let label = "Restricted";

  if (summary.level === "full") {
    badgeClass = "badge-pos";
    label = "Full Access";
  } else if (summary.level === "limited") {
    badgeClass = "badge-warn";
    label = "Limited";
  } else if (summary.level === "read_only") {
    badgeClass = "badge-neu";
    label = "Read Only";
  }

  return (
    <span
      key={summary.moduleKey}
      className={`badge ${badgeClass}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontSize: "var(--text-2xs)",
        padding: "0.2rem 0.5rem",
      }}
    >
      {summary.title}: {label}
    </span>
  );
}

export function RolesTable({
  roles,
  assignmentCountByRoleId,
  onView,
  onEdit,
  onClone,
  onDelete,
  deletingRoleId = null,
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
  const [moduleFilter, setModuleFilter] = useState("all");
  const [expandedRoleIds, setExpandedRoleIds] = useState<Set<string>>(() => new Set());

  const moduleOptions = [
    { value: "all", label: "All Modules" },
    ...SERVICE_MODULES.map((m) => ({ value: m.key, label: m.title })),
  ];

  const rolesWithSummaries = useMemo(() => {
    return roles.map((r) => {
      const grid = permissionKeysToGrid(r.permissionKeys);
      const summaries = getRoleModuleSummaries(grid);
      return { role: r, grid, summaries };
    });
  }, [roles]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return rolesWithSummaries.filter(({ role: r, summaries }) => {
      const matchSearch =
        !q ||
        r.name.toLowerCase().includes(q) ||
        (r.description ?? "").toLowerCase().includes(q) ||
        summaries.some(
          (s) => s.level !== "restricted" && s.title.toLowerCase().includes(q),
        );

      const matchType =
        typeFilter === "all" ||
        (typeFilter === "system" && r.isSystem) ||
        (typeFilter === "custom" && !r.isSystem);

      const matchModule =
        moduleFilter === "all" ||
        summaries.some(
          (s) => s.moduleKey === moduleFilter && s.level !== "restricted",
        );

      return matchSearch && matchType && matchModule;
    });
  }, [rolesWithSummaries, search, typeFilter, moduleFilter]);

  const allExpanded =
    filtered.length > 0 && filtered.every(({ role: r }) => expandedRoleIds.has(r.id));

  const toggleExpandAll = () => {
    if (allExpanded) {
      setExpandedRoleIds((prev) => {
        const next = new Set(prev);
        for (const { role: r } of filtered) {
          next.delete(r.id);
        }
        return next;
      });
    } else {
      setExpandedRoleIds((prev) => {
        const next = new Set(prev);
        for (const { role: r } of filtered) {
          next.add(r.id);
        }
        return next;
      });
    }
  };

  const toggleRole = (roleId: string) => {
    setExpandedRoleIds((prev) => {
      const next = new Set(prev);
      if (next.has(roleId)) {
        next.delete(roleId);
      } else {
        next.add(roleId);
      }
      return next;
    });
  };

  const handleRowClick = (e: React.MouseEvent, roleId: string) => {
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("a") || target.closest("input")) {
      return;
    }
    toggleRole(roleId);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="search-input"
            placeholder="Search role title, description, or module..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
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
          <Select
            aria-label="Module filter"
            value={moduleFilter}
            onChange={setModuleFilter}
            options={moduleOptions}
          />
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={filtered.length === 0}
          onClick={toggleExpandAll}
        >
          {allExpanded ? "Collapse All" : "Expand All"}
        </button>
      </div>

      <div className="table-card">
        <div className="table-responsive-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: "3.5rem", textAlign: "center" }}>Expand</th>
                <th>Role Title &amp; Type</th>
                <th>Description</th>
                <th>Governed Modules</th>
                <th>Active Staff</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    style={{
                      textAlign: "center",
                      padding: "2.5rem",
                      color: "var(--ink-3)",
                    }}
                  >
                    No roles found matching your search criteria.
                  </td>
                </tr>
              ) : (
                filtered.map(({ role: r, grid, summaries }) => {
                  const count = assignmentCountByRoleId.get(r.id) ?? 0;
                  const isExpanded = expandedRoleIds.has(r.id);

                  return (
                    <Fragment key={r.id}>
                      <tr
                        onClick={(e) => handleRowClick(e, r.id)}
                        style={{ cursor: "pointer" }}
                        className={isExpanded ? "row-expanded" : undefined}
                      >
                        <td style={{ textAlign: "center" }}>
                          <button
                            type="button"
                            aria-label={
                              isExpanded ? `Collapse ${r.name}` : `Expand ${r.name}`
                            }
                            aria-expanded={isExpanded}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleRole(r.id);
                            }}
                            className="btn btn-secondary btn-xs"
                            style={{
                              padding: "0.2rem 0.4rem",
                              border: "none",
                              background: "transparent",
                              cursor: "pointer",
                              fontSize: "11px",
                              lineHeight: 1,
                              color: "var(--ink-2)",
                            }}
                          >
                            <span aria-hidden="true">{isExpanded ? "▼" : "▶"}</span>
                          </button>
                        </td>
                        <td>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: ".5rem",
                            }}
                          >
                            <b style={{ fontSize: "var(--text-base)" }}>{r.name}</b>
                            <span
                              className={
                                r.isSystem ? "badge-system" : "badge-custom"
                              }
                            >
                              {r.isSystem ? "SYSTEM" : "CUSTOM"}
                            </span>
                          </div>
                        </td>
                        <td
                          style={{
                            color: "var(--ink-2)",
                            fontSize: "var(--text-sm)",
                            maxWidth: 240,
                            lineHeight: 1.3,
                          }}
                        >
                          {r.description}
                        </td>
                        <td>
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: ".35rem",
                            }}
                          >
                            {summaries.map(moduleBadge)}
                          </div>
                        </td>
                        <td>
                          <span style={{ fontWeight: 600 }}>{count} Staff</span>
                        </td>
                        <td
                          style={{ textAlign: "right" }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div
                            style={{
                              display: "inline-flex",
                              gap: ".35rem",
                              justifyContent: "flex-end",
                            }}
                          >
                            {r.isSystem ? (
                              <>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-xs"
                                  onClick={() => onView(r.id)}
                                >
                                  View
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-xs"
                                  onClick={() => onClone(r.id)}
                                >
                                  Clone
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-xs"
                                  onClick={() => onEdit(r.id)}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-xs"
                                  onClick={() => onClone(r.id)}
                                >
                                  Clone
                                </button>
                                <LoadingButton
                                  className="btn btn-danger btn-xs"
                                  disabled={count > 0 || deletingRoleId !== null}
                                  loading={deletingRoleId === r.id}
                                  loadingText="Deleting…"
                                  title={
                                    count > 0
                                      ? "Reassign staff before deleting this role"
                                      : undefined
                                  }
                                  onClick={() => onDelete(r.id)}
                                >
                                  Delete
                                </LoadingButton>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${r.id}-detail`}>
                          <td
                            colSpan={6}
                            style={{
                              padding: "0.75rem 1rem",
                              background: "var(--bg-subtle, #F8F9FA)",
                            }}
                          >
                            <RoleServiceInspector grid={grid} roleName={r.name} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
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

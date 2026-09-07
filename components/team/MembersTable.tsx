"use client";

import { useMemo, useState } from "react";
import { Select } from "@/components/ui/Select";
import { effectivePermissionTags } from "@/lib/capabilityMap";
import type { Chapter, TeamMember, TeamRole } from "./TeamAccessProvider";

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

export function MembersTable({
  members, roles, chapters, onEdit,
}: {
  members: TeamMember[];
  roles: TeamRole[];
  chapters: Chapter[];
  onEdit: (memberId: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [scopeFilter, setScopeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const permKeysByRoleId = useMemo(
    () => new Map(roles.map((r) => [r.id, r.permissionKeys])),
    [roles],
  );
  const chapterNameById = useMemo(
    () => new Map(chapters.map((c) => [c.id, c.name])),
    [chapters],
  );

  const filtered = members.filter((m) => {
    const q = search.toLowerCase().trim();
    const matchSearch = !q
      || m.fullName.toLowerCase().includes(q)
      || m.email.toLowerCase().includes(q)
      || m.assignments.some((a) => a.roleName.toLowerCase().includes(q) || a.scopeLabel.toLowerCase().includes(q));
    const matchRole = roleFilter === "all" || m.assignments.some((a) => a.roleName === roleFilter);
    const matchScope = scopeFilter === "all"
      || m.assignments.some((a) => (a.scopeKind === "org_wide" ? "org_wide" : a.chapterId) === scopeFilter);
    const matchStatus = statusFilter === "all" || m.status === statusFilter;
    return matchSearch && matchRole && matchScope && matchStatus;
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="search-input"
          placeholder="Search member name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select
          aria-label="Role filter"
          value={roleFilter}
          onChange={setRoleFilter}
          options={[
            { value: "all", label: "All Roles" },
            ...roles.map((r) => ({ value: r.name, label: `${r.name}${r.isSystem ? "" : " (Custom)"}` })),
          ]}
        />
        <Select
          aria-label="Scope filter"
          value={scopeFilter}
          onChange={setScopeFilter}
          options={[
            { value: "all", label: "All Scopes / Chapters" },
            { value: "org_wide", label: "National / All Chapters" },
            ...chapters.map((c) => ({ value: c.id, label: c.city ? `${c.name} — ${c.city}` : c.name })),
          ]}
        />
        <Select
          aria-label="Status filter"
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: "all", label: "All Statuses" },
            { value: "active", label: "Active & Verified" },
            { value: "invited", label: "Pending Invitation" },
          ]}
        />
      </div>

      <div className="table-card">
        <div className="table-responsive-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Member Name &amp; Email</th>
                <th>Assigned Roles &amp; Scopes</th>
                <th>Effective Permissions</th>
                <th>Last Active</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "2.5rem", color: "var(--ink-3)" }}>
                    No team members found matching your search filter criteria.
                  </td>
                </tr>
              ) : filtered.map((m) => {
                const tags = effectivePermissionTags(m.assignments.map((a) => permKeysByRoleId.get(a.roleId) ?? []));
                return (
                  <tr key={m.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: ".65rem" }}>
                        <div className="avatar" style={{ width: 28, height: 28, fontSize: "var(--text-xs)" }}>{initials(m.fullName)}</div>
                        <div>
                          <div style={{ fontWeight: 600 }}>{m.fullName}</div>
                          <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-2)" }}>{m.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: ".35rem" }}>
                        {m.assignments.map((a) => (
                          <span className="role-chip" key={a.id}>
                            <span>{a.roleName}</span>
                            <span className="scope-pill">
                              {a.chapterId ? (chapterNameById.get(a.chapterId) ?? a.scopeLabel) : a.scopeLabel}
                            </span>
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: ".25rem", maxWidth: 280 }}>
                        {tags.map((t) => <span className="perm-tag" key={t}>{t}</span>)}
                      </div>
                    </td>
                    <td><span style={{ fontSize: "var(--text-sm)", color: "var(--ink-2)" }}>{m.lastActiveLabel}</span></td>
                    <td>
                      {m.expiresAt && new Date(m.expiresAt).getTime() < Date.now() ? (
                        <span className="badge badge-neg">Expired</span>
                      ) : (
                        <span className={`badge ${m.status === "active" ? "badge-pos" : m.status === "invited" ? "badge-pend" : "badge-neg"}`}>
                          {m.status === "active" ? "Active" : m.status === "invited" ? "Pending Invite" : "Suspended"}
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button type="button" className="btn btn-secondary btn-xs" onClick={() => onEdit(m.id)}>
                        Edit Access
                      </button>
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

"use client";

import { useEffect } from "react";
import { Select } from "@/components/ui/Select";
import type { RoleAssignmentInput } from "@/lib/platformFunctions";

const ORG_WIDE_LABEL = "National / All Chapters";

export interface RoleScopeRow {
  key: string;
  roleId: string;
  scopeKind: "org_wide" | "chapter";
  chapterId: string | null;
  scopeLabel: string;
}

export function makeRoleScopeRow(roleId: string): RoleScopeRow {
  return {
    key: crypto.randomUUID(),
    roleId,
    scopeKind: "org_wide",
    chapterId: null,
    scopeLabel: ORG_WIDE_LABEL,
  };
}

export function rowsToAssignmentPayload(rows: RoleScopeRow[]): RoleAssignmentInput[] {
  return rows.map((r) => ({
    roleId: r.roleId,
    scopeKind: r.scopeKind,
    chapterId: r.scopeKind === "chapter" ? r.chapterId : null,
    scopeLabel: r.scopeLabel,
  }));
}

export function RoleScopeRepeater({
  rows, roles, chapters, onChange, addLabel,
}: {
  rows: RoleScopeRow[];
  roles: { id: string; name: string; isSystem: boolean }[];
  chapters: { id: string; name: string }[];
  onChange: (rows: RoleScopeRow[]) => void;
  addLabel: string;
}) {
  function isSuperAdminRole(roleId: string): boolean {
    const role = roles.find((r) => r.id === roleId);
    return role?.name.trim().toLowerCase() === "super admin";
  }

  function update(idx: number, patch: Partial<RoleScopeRow>) {
    onChange(rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function handleRoleChange(idx: number, roleId: string) {
    if (isSuperAdminRole(roleId)) {
      update(idx, {
        roleId,
        scopeKind: "org_wide",
        chapterId: null,
        scopeLabel: ORG_WIDE_LABEL,
      });
    } else {
      update(idx, { roleId });
    }
  }

  function setScope(idx: number, value: string) {
    if (value === "org_wide") {
      update(idx, { scopeKind: "org_wide", chapterId: null, scopeLabel: ORG_WIDE_LABEL });
    } else {
      const chapter = chapters.find((c) => c.id === value);
      update(idx, { scopeKind: "chapter", chapterId: value, scopeLabel: chapter?.name ?? "Chapter" });
    }
  }

  useEffect(() => {
    let modified = false;
    const nextRows = rows.map((r) => {
      if (isSuperAdminRole(r.roleId) && (r.scopeKind !== "org_wide" || r.chapterId !== null || r.scopeLabel !== ORG_WIDE_LABEL)) {
        modified = true;
        return {
          ...r,
          scopeKind: "org_wide" as const,
          chapterId: null,
          scopeLabel: ORG_WIDE_LABEL,
        };
      }
      return r;
    });
    if (modified) {
      onChange(nextRows);
    }
  }, [rows, roles, onChange]);

  return (
    <div className="role-repeater-box">
      {rows.map((row, idx) => {
        const isSuperAdmin = isSuperAdminRole(row.roleId);
        return (
          <div className="role-repeater-row" key={row.key}>
            <Select
              aria-label="Role"
              value={row.roleId}
              onChange={(roleId) => handleRoleChange(idx, roleId)}
              options={roles.map((r) => ({
                value: r.id,
                label: `${r.name}${r.isSystem ? "" : " (Custom)"}`,
              }))}
            />
            {isSuperAdmin ? (
              <span className="badge badge-pos">National / All Chapters (Full Platform Access)</span>
            ) : (
              <Select
                aria-label="Scope"
                value={row.scopeKind === "org_wide" ? "org_wide" : (row.chapterId ?? "")}
                onChange={(val) => setScope(idx, val)}
                options={[
                  { value: "org_wide", label: ORG_WIDE_LABEL },
                  ...chapters.map((c) => ({ value: c.id, label: c.name })),
                ]}
              />
            )}
            {rows.length > 1 ? (
              <button
                type="button"
                className="btn btn-secondary btn-xs"
                aria-label="Remove role"
                onClick={() => onChange(rows.filter((_, i) => i !== idx))}
              >
                ✕
              </button>
            ) : <div />}
          </div>
        );
      })}
      <div>
        <button
          type="button"
          className="btn btn-secondary btn-xs"
          onClick={() => onChange([...rows, makeRoleScopeRow(roles[0]?.id ?? "")])}
        >
          {addLabel}
        </button>
      </div>
    </div>
  );
}

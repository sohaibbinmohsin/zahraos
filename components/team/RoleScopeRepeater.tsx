"use client";

import { Select } from "@/components/ui/Select";

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

export function rowsToAssignmentPayload(rows: RoleScopeRow[]) {
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
  function update(idx: number, patch: Partial<RoleScopeRow>) {
    onChange(rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }
  function setScope(idx: number, value: string) {
    if (value === "org_wide") {
      update(idx, { scopeKind: "org_wide", chapterId: null, scopeLabel: ORG_WIDE_LABEL });
    } else {
      const chapter = chapters.find((c) => c.id === value);
      update(idx, { scopeKind: "chapter", chapterId: value, scopeLabel: chapter?.name ?? "Chapter" });
    }
  }

  return (
    <div className="role-repeater-box">
      {rows.map((row, idx) => (
        <div className="role-repeater-row" key={row.key}>
          <Select
            aria-label="Role"
            value={row.roleId}
            onChange={(roleId) => update(idx, { roleId })}
            options={roles.map((r) => ({
              value: r.id,
              label: `${r.name}${r.isSystem ? "" : " (Custom)"}`,
            }))}
          />
          <Select
            aria-label="Scope"
            value={row.scopeKind === "org_wide" ? "org_wide" : (row.chapterId ?? "")}
            onChange={(val) => setScope(idx, val)}
            options={[
              { value: "org_wide", label: ORG_WIDE_LABEL },
              ...chapters.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
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
      ))}
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

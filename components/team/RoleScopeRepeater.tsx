"use client";

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
          <select
            className="form-select"
            value={row.roleId}
            onChange={(e) => update(idx, { roleId: e.target.value })}
          >
            {roles.map((r) => (
              <option key={r.id} value={r.id}>{r.name}{r.isSystem ? "" : " (Custom)"}</option>
            ))}
          </select>
          <select
            className="form-select"
            value={row.scopeKind === "org_wide" ? "org_wide" : (row.chapterId ?? "")}
            onChange={(e) => setScope(idx, e.target.value)}
          >
            <option value="org_wide">{ORG_WIDE_LABEL}</option>
            {chapters.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
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

"use client";

import { useCallback, useEffect } from "react";
import { Select } from "@/components/ui/Select";
import type { RoleAssignmentInput } from "@/lib/platformFunctions";

const ORG_WIDE_LABEL = "National / All Chapters";

export interface RoleScopeRow {
  key: string;
  roleId: string;
  scopeKind: "org_wide" | "chapter";
  chapterIds: string[];
  scopeLabel: string;
  /** @deprecated For backwards compatibility */
  chapterId?: string | null;
}

export function makeRoleScopeRow(roleId: string): RoleScopeRow {
  return {
    key: crypto.randomUUID(),
    roleId,
    scopeKind: "org_wide",
    chapterIds: [],
    chapterId: null,
    scopeLabel: ORG_WIDE_LABEL,
  };
}

export function rowsToAssignmentPayload(
  rows: RoleScopeRow[],
  chapters?: { id: string; name: string }[],
): RoleAssignmentInput[] {
  const chaptersMap = new Map((chapters ?? []).map((c) => [c.id, c.name]));
  const payload: RoleAssignmentInput[] = [];

  for (const r of rows) {
    if (r.scopeKind === "org_wide") {
      payload.push({
        roleId: r.roleId,
        scopeKind: "org_wide",
        chapterId: null,
        scopeLabel: ORG_WIDE_LABEL,
      });
    } else {
      const ids =
        r.chapterIds && r.chapterIds.length > 0
          ? r.chapterIds
          : r.chapterId
            ? [r.chapterId]
            : [];

      if (ids.length === 0) {
        payload.push({
          roleId: r.roleId,
          scopeKind: "chapter",
          chapterId: null,
          scopeLabel: "Chapter",
        });
      } else {
        for (const chId of ids) {
          payload.push({
            roleId: r.roleId,
            scopeKind: "chapter",
            chapterId: chId,
            scopeLabel:
              chaptersMap.get(chId) ||
              (ids.length === 1 && r.scopeLabel && r.scopeLabel !== ORG_WIDE_LABEL
                ? r.scopeLabel
                : "Chapter"),
          });
        }
      }
    }
  }

  return payload;
}

export function groupAssignmentsToRows(
  assignments: Array<{
    id?: string;
    roleId: string;
    scopeKind: "org_wide" | "chapter";
    chapterId?: string | null;
    scopeLabel?: string;
  }>,
  chapters?: { id: string; name: string }[],
): RoleScopeRow[] {
  const chaptersMap = new Map((chapters ?? []).map((c) => [c.id, c.name]));
  const rows: RoleScopeRow[] = [];
  const chapterRowByRole = new Map<string, RoleScopeRow>();

  for (const a of assignments) {
    if (a.scopeKind === "org_wide") {
      rows.push({
        key: a.id || crypto.randomUUID(),
        roleId: a.roleId,
        scopeKind: "org_wide",
        chapterIds: [],
        chapterId: null,
        scopeLabel: a.scopeLabel || ORG_WIDE_LABEL,
      });
    } else {
      const existing = chapterRowByRole.get(a.roleId);
      if (existing) {
        if (a.chapterId && !existing.chapterIds.includes(a.chapterId)) {
          existing.chapterIds.push(a.chapterId);
          existing.scopeLabel = existing.chapterIds
            .map((id) => chaptersMap.get(id) || id)
            .join(", ");
        }
      } else {
        const initialIds = a.chapterId ? [a.chapterId] : [];
        const label = a.chapterId
          ? chaptersMap.get(a.chapterId) || a.scopeLabel || "Chapter"
          : a.scopeLabel || "Chapter";
        const newRow: RoleScopeRow = {
          key: a.id || crypto.randomUUID(),
          roleId: a.roleId,
          scopeKind: "chapter",
          chapterIds: initialIds,
          chapterId: a.chapterId ?? null,
          scopeLabel: label,
        };
        chapterRowByRole.set(a.roleId, newRow);
        rows.push(newRow);
      }
    }
  }

  return rows;
}

export function RoleScopeRepeater({
  rows,
  roles,
  chapters,
  onChange,
  addLabel,
}: {
  rows: RoleScopeRow[];
  roles: { id: string; name: string; isSystem: boolean }[];
  chapters: { id: string; name: string }[];
  onChange: (rows: RoleScopeRow[]) => void;
  addLabel: string;
}) {
  const isSuperAdminRole = useCallback(
    (roleId: string): boolean => {
      const role = roles.find((r) => r.id === roleId);
      return role?.name.trim().toLowerCase() === "super admin";
    },
    [roles]
  );

  function update(idx: number, patch: Partial<RoleScopeRow>) {
    onChange(rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function handleRoleChange(idx: number, roleId: string) {
    if (isSuperAdminRole(roleId)) {
      update(idx, {
        roleId,
        scopeKind: "org_wide",
        chapterIds: [],
        chapterId: null,
        scopeLabel: ORG_WIDE_LABEL,
      });
    } else {
      update(idx, { roleId });
    }
  }

  function handleScopeKindChange(idx: number, scopeKind: "org_wide" | "chapter") {
    if (scopeKind === "org_wide") {
      update(idx, {
        scopeKind: "org_wide",
        chapterIds: [],
        chapterId: null,
        scopeLabel: ORG_WIDE_LABEL,
      });
    } else {
      update(idx, {
        scopeKind: "chapter",
        chapterIds: [],
        chapterId: null,
        scopeLabel: "Chapter",
      });
    }
  }

  function handleAddChapter(idx: number, chapterId: string) {
    if (!chapterId) return;
    const row = rows[idx];
    if (!row) return;
    if ((row.chapterIds ?? []).includes(chapterId)) return;
    const nextChapterIds = [...(row.chapterIds ?? []), chapterId];
    const chapterNames = nextChapterIds
      .map((id) => chapters.find((c) => c.id === id)?.name || id)
      .join(", ");
    update(idx, {
      chapterIds: nextChapterIds,
      chapterId: nextChapterIds[0] ?? null,
      scopeLabel: chapterNames || "Chapter",
    });
  }

  function handleRemoveChapter(idx: number, chapterId: string) {
    const row = rows[idx];
    if (!row) return;
    const nextChapterIds = (row.chapterIds ?? []).filter((id) => id !== chapterId);
    const chapterNames = nextChapterIds
      .map((id) => chapters.find((c) => c.id === id)?.name || id)
      .join(", ");
    update(idx, {
      chapterIds: nextChapterIds,
      chapterId: nextChapterIds[0] ?? null,
      scopeLabel: chapterNames || "Chapter",
    });
  }

  useEffect(() => {
    let modified = false;
    const nextRows = rows.map((r) => {
      if (
        isSuperAdminRole(r.roleId) &&
        (r.scopeKind !== "org_wide" ||
          (r.chapterIds && r.chapterIds.length > 0) ||
          r.chapterId !== null ||
          r.scopeLabel !== ORG_WIDE_LABEL)
      ) {
        modified = true;
        return {
          ...r,
          scopeKind: "org_wide" as const,
          chapterIds: [],
          chapterId: null,
          scopeLabel: ORG_WIDE_LABEL,
        };
      }
      return r;
    });
    if (modified) {
      onChange(nextRows);
    }
  }, [rows, isSuperAdminRole, onChange]);

  return (
    <div className="role-repeater-box">
      {rows.map((row, idx) => {
        const isSuperAdmin = isSuperAdminRole(row.roleId);
        const currentChapterIds = row.chapterIds ?? (row.chapterId ? [row.chapterId] : []);
        const availableChapters = chapters.filter((c) => !currentChapterIds.includes(c.id));

        return (
          <div
            className="role-scope-card"
            key={row.key}
            style={{
              background: "var(--bg-card, #ffffff)",
              border: "1px solid var(--line)",
              borderRadius: "8px",
              padding: "0.85rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
            }}
          >
            {/* Top row: Role selector + Remove role button */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <div style={{ flex: 1 }}>
                <Select
                  aria-label="Role"
                  value={row.roleId}
                  onChange={(roleId) => handleRoleChange(idx, roleId)}
                  options={roles.map((r) => ({
                    value: r.id,
                    label: `${r.name}${r.isSystem ? "" : " (Custom)"}`,
                  }))}
                />
              </div>
              {rows.length > 1 ? (
                <button
                  type="button"
                  className="btn btn-secondary btn-xs"
                  aria-label="Remove role"
                  onClick={() => onChange(rows.filter((_, i) => i !== idx))}
                >
                  ✕
                </button>
              ) : null}
            </div>

            {/* Scope Selection */}
            {isSuperAdmin ? (
              <div>
                <span className="badge badge-pos">National / All Chapters (Full Platform Access)</span>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                {/* Scope Radios */}
                <div style={{ display: "flex", alignItems: "center", gap: "1rem", fontSize: "var(--text-xs)" }}>
                  <label
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.35rem",
                      cursor: "pointer",
                      fontWeight: 500,
                    }}
                  >
                    <input
                      type="radio"
                      name={`scope-kind-${row.key}`}
                      value="org_wide"
                      checked={row.scopeKind === "org_wide"}
                      onChange={() => handleScopeKindChange(idx, "org_wide")}
                      aria-label="All Chapters"
                      style={{ accentColor: "var(--brand)", cursor: "pointer" }}
                    />
                    <span>All Chapters (National / All Chapters)</span>
                  </label>

                  <label
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.35rem",
                      cursor: "pointer",
                      fontWeight: 500,
                    }}
                  >
                    <input
                      type="radio"
                      name={`scope-kind-${row.key}`}
                      value="chapter"
                      checked={row.scopeKind === "chapter"}
                      onChange={() => handleScopeKindChange(idx, "chapter")}
                      aria-label="Specific Chapters"
                      style={{ accentColor: "var(--brand)", cursor: "pointer" }}
                    />
                    <span>Specific Chapters</span>
                  </label>
                </div>

                {/* Specific Chapters: Tag chips and Add Chapter dropdown */}
                {row.scopeKind === "chapter" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.15rem" }}>
                    {currentChapterIds.length > 0 ? (
                      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.4rem" }}>
                        {currentChapterIds.map((chId) => {
                          const chapter = chapters.find((c) => c.id === chId);
                          const chapterName = chapter ? chapter.name : chId;
                          return (
                            <span
                              key={chId}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "0.35rem",
                                padding: "0.2rem 0.55rem",
                                borderRadius: "9999px",
                                fontSize: "var(--text-xs)",
                                fontWeight: 500,
                                background: "var(--brand-tint, #eef2ff)",
                                color: "var(--on-brand, #312e81)",
                                border: "1px solid var(--brand-bd, #c7d2fe)",
                              }}
                            >
                              <span>{chapterName}</span>
                              <button
                                type="button"
                                style={{
                                  background: "none",
                                  border: "none",
                                  padding: 0,
                                  cursor: "pointer",
                                  color: "inherit",
                                  fontSize: "0.75rem",
                                  lineHeight: 1,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  opacity: 0.8,
                                }}
                                aria-label={`Remove ${chapterName}`}
                                onClick={() => handleRemoveChapter(idx, chId)}
                              >
                                ✕
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    ) : (
                      <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-2)", fontStyle: "italic" }}>
                        No chapters selected. Add at least one chapter below.
                      </div>
                    )}

                    <div style={{ maxWidth: 300 }}>
                      <Select
                        aria-label="Add Chapter"
                        value=""
                        disabled={availableChapters.length === 0}
                        onChange={(val) => handleAddChapter(idx, val)}
                        options={[
                          {
                            value: "",
                            label: availableChapters.length > 0 ? "+ Add chapter…" : "All chapters added",
                          },
                          ...availableChapters.map((c) => ({ value: c.id, label: c.name })),
                        ]}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
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

"use client";

import { useEffect, useMemo, useState } from "react";
import { useTeamAccess } from "./TeamAccessProvider";
import { useToast } from "@/components/shell/ToastContext";
import { createCustomRole, updateCustomRole } from "@/lib/platformFunctions";
import {
  CAPABILITY_KEYS, CAPABILITY_META, RESTRICTED_GRID, permissionKeysToGrid,
  type CapabilityGrid, type CapabilityKey, type CapabilityLevel,
} from "@/lib/capabilityMap";

const LEVEL_LABEL: Record<CapabilityLevel, string> = {
  granted: "Granted", read_only: "Read Only", restricted: "Restricted",
};

export function RoleDrawer({
  request, onClose,
}: {
  request: { mode: "create" | "edit" | "view" | "clone"; roleId: string | null } | null;
  onClose: () => void;
}) {
  const { organizationId, accessToken, moduleId, roles, refresh } = useTeamAccess();
  const { showToast } = useToast();
  const source = request?.roleId ? roles.find((r) => r.id === request.roleId) ?? null : null;
  const readOnly = request?.mode === "view";

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [grid, setGrid] = useState<CapabilityGrid>(RESTRICTED_GRID);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!request) return;
    if (request.mode === "create") {
      setName(""); setDescription("");
      setGrid({ drive: "granted", publish: "restricted", triage: "granted", hours: "restricted", team: "restricted" });
    } else if (source) {
      const g = permissionKeysToGrid(source.permissionKeys);
      setGrid(g);
      setDescription(source.description ?? "");
      setName(request.mode === "clone" ? `${source.name} (Copy)` : source.name);
    }
    // `source` is intentionally not a dep: it is recomputed every render
    // (roles.find over a fresh array), so including it would re-run this
    // effect on every render and fight the state it sets. `request` is a
    // stable reference from TeamDrawers state and is the real trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);

  const templateOptions = useMemo(() => roles.filter((r) => r.isSystem), [roles]);

  function applyTemplate(roleId: string) {
    const t = roles.find((r) => r.id === roleId);
    if (t) {
      setGrid(permissionKeysToGrid(t.permissionKeys));
      if (!description) setDescription(t.description ?? "");
    }
  }

  async function save() {
    if (!name.trim()) { showToast("Please specify a role title."); return; }
    if (!accessToken) return;
    setBusy(true);
    try {
      if (request?.mode === "edit" && source) {
        await updateCustomRole({ roleId: source.id, name: name.trim(), description, capabilities: grid }, accessToken);
        showToast(`Role "${name.trim()}" updated successfully.`);
      } else {
        if (!organizationId || !moduleId) return;
        await createCustomRole({ organizationId, moduleId, name: name.trim(), description, capabilities: grid }, accessToken);
        showToast(`Created new custom role "${name.trim()}".`);
      }
      await refresh();
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to save role.");
    } finally {
      setBusy(false);
    }
  }

  const open = request !== null;
  const title = request?.mode === "view" ? "System Role Specification"
    : request?.mode === "edit" ? "Edit Custom Role"
    : "Create Custom Role";

  return (
    <>
      <div className={`drawer-backdrop ${open ? "open" : ""}`} onClick={onClose} />
      <div className={`drawer ${open ? "open" : ""}`} style={{ maxWidth: 620 }}>
        {request && (
          <>
            <div className="drawer-header">
              <div>
                <h2 className="drawer-title">{title}</h2>
                <div style={{ fontSize: "var(--text-sm)", color: "var(--ink-2)" }}>
                  {readOnly
                    ? "Protected default system role permissions (read-only baseline)"
                    : "Define role boundaries and configure granular module permissions"}
                </div>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} aria-label="Close">✕</button>
            </div>

            <div className="drawer-body">
              <div className="form-group">
                <label className="form-label" htmlFor="role-name">Role Title *</label>
                <input id="role-name" className="form-input" value={name} disabled={readOnly}
                  onChange={(e) => setName(e.target.value)} placeholder="e.g. Regional Logistics Lead" />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="role-desc">Role Description</label>
                <textarea id="role-desc" className="form-textarea" rows={2} value={description} disabled={readOnly}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Explain the operational responsibilities and authority of this role..." />
              </div>

              {!readOnly && request.mode !== "edit" && (
                <div className="form-group">
                  <label className="form-label" htmlFor="role-template">Base Permission Template</label>
                  <select id="role-template" className="form-select" defaultValue="" onChange={(e) => e.target.value && applyTemplate(e.target.value)}>
                    <option value="">Start from Blank / Custom</option>
                    {templateOptions.map((r) => <option key={r.id} value={r.id}>Clone from {r.name}</option>)}
                  </select>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Granular Module Permissions</label>
                <div style={{ display: "flex", flexDirection: "column", gap: ".75rem" }}>
                  {CAPABILITY_KEYS.map((cap: CapabilityKey) => (
                    <div className="perm-matrix-group" key={cap}>
                      <div className="perm-checkbox-row">
                        <span>{CAPABILITY_META[cap].column}</span>
                        <select
                          aria-label={CAPABILITY_META[cap].column}
                          className="filter-select"
                          style={{ padding: ".2rem .4rem", fontSize: "var(--text-sm)" }}
                          value={grid[cap]}
                          disabled={readOnly}
                          onChange={(e) => setGrid({ ...grid, [cap]: e.target.value as CapabilityLevel })}
                        >
                          {CAPABILITY_META[cap].levels.map((lvl) => (
                            <option key={lvl} value={lvl}>{LEVEL_LABEL[lvl]}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="drawer-footer">
              <div style={{ marginLeft: "auto", display: "flex", gap: ".45rem" }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
                {!readOnly && (
                  <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={save}>
                    Save Role &amp; Permissions
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { useTeamAccess } from "./TeamAccessProvider";
import { useToast } from "@/components/shell/ToastContext";
import { createCustomRole, updateCustomRole } from "@/lib/platformFunctions";
import {
  MODULE_CAPABILITIES, CAPABILITY_META, RESTRICTED_GRID, permissionKeysToGrid, gridToPermissionKeys,
  type CapabilityGrid, type CapabilityKey, type CapabilityLevel,
} from "@/lib/capabilityMap";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { Select } from "@/components/ui/Select";

const LEVEL_LABEL: Record<CapabilityLevel, string> = {
  granted: "Granted", read_only: "Read Only", restricted: "Restricted",
};

export interface RoleTemplate {
  name: string;
  description: string;
  capabilities: CapabilityGrid;
}

export const ROLE_TEMPLATES: RoleTemplate[] = [
  {
    name: "Super Admin",
    description: "Full platform control and unconstrained administrative privileges across all operational modules.",
    capabilities: {
      ...RESTRICTED_GRID,
      drive: "granted",
      publish: "granted",
      triage: "granted",
      hours: "granted",
      volunteers: "read_only",
      org_governance: "granted",
      members: "granted",
      roles: "granted",
      audit: "read_only",
      inquiries: "granted",
      team: "granted",
    },
  },
  {
    name: "Org Admin",
    description: "Full operational permissions and organization-wide team governance.",
    capabilities: {
      ...RESTRICTED_GRID,
      drive: "granted",
      publish: "granted",
      triage: "granted",
      hours: "granted",
      volunteers: "read_only",
      org_governance: "granted",
      members: "granted",
      roles: "granted",
      audit: "read_only",
      inquiries: "granted",
      team: "granted",
    },
  },
  {
    name: "Chapter Admin",
    description: "Full chapter-level operational permissions and local chapter roster governance.",
    capabilities: {
      ...RESTRICTED_GRID,
      drive: "granted",
      publish: "granted",
      triage: "granted",
      hours: "granted",
      volunteers: "read_only",
      org_governance: "granted",
      members: "granted",
      roles: "restricted",
      audit: "read_only",
      inquiries: "restricted",
      team: "restricted",
    },
  },
  {
    name: "Operations Lead",
    description: "Oversees local chapter operations, drive execution, applicant selection, and field shift oversight.",
    capabilities: {
      ...RESTRICTED_GRID,
      drive: "granted",
      publish: "granted",
      triage: "granted",
      hours: "granted",
      volunteers: "restricted",
      org_governance: "restricted",
      members: "restricted",
      roles: "restricted",
      audit: "restricted",
      inquiries: "restricted",
      team: "restricted",
    },
  },
  {
    name: "Drive Coordinator",
    description: "Manages on-ground drive shifts, volunteer gate attendance, and direct shift hours logging.",
    capabilities: {
      ...RESTRICTED_GRID,
      drive: "granted",
      publish: "restricted",
      triage: "granted",
      hours: "granted",
      volunteers: "restricted",
      org_governance: "restricted",
      members: "restricted",
      roles: "restricted",
      audit: "restricted",
      inquiries: "restricted",
      team: "restricted",
    },
  },
  {
    name: "Application Reviewer",
    description: "Screens and shortlists volunteer applicants, assesses question responses, and assigns candidate statuses.",
    capabilities: {
      ...RESTRICTED_GRID,
      drive: "restricted",
      publish: "restricted",
      triage: "granted",
      hours: "restricted",
      volunteers: "restricted",
      org_governance: "restricted",
      members: "restricted",
      roles: "restricted",
      audit: "restricted",
      inquiries: "restricted",
      team: "restricted",
    },
  },
  {
    name: "Auditor",
    description: "Read-only compliance officer auditing hours logs, certifications, and operational activity records.",
    capabilities: {
      ...RESTRICTED_GRID,
      drive: "restricted",
      publish: "restricted",
      triage: "read_only",
      hours: "read_only",
      volunteers: "read_only",
      org_governance: "restricted",
      members: "restricted",
      roles: "restricted",
      audit: "read_only",
      inquiries: "restricted",
      team: "restricted",
    },
  },
];

export function RoleDrawer({
  request, onClose,
}: {
  request: { mode: "create" | "edit" | "view" | "clone"; roleId: string | null } | null;
  onClose: () => void;
}) {
  const { organizationId, accessToken, moduleId, roles, refresh } = useTeamAccess();
  const { showToast } = useToast();
  const source = request?.roleId
    ? roles.find((r) => r.id === request.roleId)
      ?? (() => {
        const tmpl = ROLE_TEMPLATES.find(
          (t) => t.name === request.roleId || `template-${t.name}` === request.roleId || t.name.toLowerCase() === request.roleId?.toLowerCase(),
        );
        if (!tmpl) return null;
        return {
          id: request.roleId,
          name: tmpl.name,
          description: tmpl.description,
          isSystem: true,
          permissionKeys: gridToPermissionKeys(tmpl.capabilities),
        };
      })()
    : null;
  const readOnly = request?.mode === "view";

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [grid, setGrid] = useState<CapabilityGrid>(RESTRICTED_GRID);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!request) return;
    if (request.mode === "create") {
      setName(""); setDescription(""); setSelectedTemplate("");
      setGrid({ ...RESTRICTED_GRID, drive: "granted", publish: "restricted", triage: "granted", hours: "restricted", team: "restricted" });
    } else if (source) {
      const g = permissionKeysToGrid(source.permissionKeys);
      setGrid(g);
      setDescription(source.description ?? "");
      setName(request.mode === "clone" ? `${source.name} (Copy)` : source.name);
      setSelectedTemplate("");
    }
    // `source` is intentionally not a dep: it is recomputed every render
    // (roles.find over a fresh array), so including it would re-run this
    // effect on every render and fight the state it sets. `request` is a
    // stable reference from TeamDrawers state and is the real trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request, source?.id]);

  const templateOptions = useMemo(() => {
    const list: Array<{ id: string; name: string }> = [];
    const seen = new Set<string>();
    for (const r of roles) {
      if (r.isSystem) {
        list.push({ id: r.id, name: r.name });
        seen.add(r.name.toLowerCase());
      }
    }
    for (const tmpl of ROLE_TEMPLATES) {
      if (!seen.has(tmpl.name.toLowerCase())) {
        list.push({ id: `template-${tmpl.name}`, name: tmpl.name });
        seen.add(tmpl.name.toLowerCase());
      }
    }
    return list;
  }, [roles]);

  function applyTemplate(roleIdOrKey: string) {
    const fromRoles = roles.find((r) => r.id === roleIdOrKey || r.name === roleIdOrKey);
    if (fromRoles) {
      setGrid(permissionKeysToGrid(fromRoles.permissionKeys));
      if (!description) setDescription(fromRoles.description ?? "");
      return;
    }
    const fromTmpl = ROLE_TEMPLATES.find(
      (t) => t.name === roleIdOrKey || `template-${t.name}` === roleIdOrKey,
    );
    if (fromTmpl) {
      setGrid(fromTmpl.capabilities);
      if (!description) setDescription(fromTmpl.description);
    }
  }

  function handleTemplateChange(templateKey: string) {
    setSelectedTemplate(templateKey);
    if (templateKey) applyTemplate(templateKey);
  }

  async function save() {
    if (!name.trim()) { showToast("Please specify a role title."); return; }
    if (!accessToken) return;
    if (request?.mode === "edit" && !source) {
      showToast("This role is no longer available — reopen it.");
      return;
    }
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
      const msg = err instanceof Error ? err.message : "";
      if (msg === "role_name_taken") showToast("A role with that name already exists.");
      else if (msg === "system_role_immutable") showToast("System roles can't be edited.");
      else showToast("Failed to save role.");
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
                  <Select
                    id="role-template"
                    aria-label="Base Permission Template"
                    value={selectedTemplate}
                    onChange={handleTemplateChange}
                    options={[
                      { value: "", label: "Start from Blank / Custom" },
                      ...templateOptions.map((r) => ({ value: r.id, label: `Clone from ${r.name}` })),
                    ]}
                  />
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Granular Module Permissions</label>
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  <fieldset className="perm-matrix-group" style={{ minWidth: 0 }}>
                    <legend className="perm-matrix-group-title">Youth Republic Operations</legend>
                    <div style={{ display: "flex", flexDirection: "column", gap: ".5rem" }}>
                      {MODULE_CAPABILITIES["youth-republic"].map((cap) => (
                        <div className="perm-checkbox-row" key={cap}>
                          <span>{CAPABILITY_META[cap].column}</span>
                          <Select
                            aria-label={CAPABILITY_META[cap].column}
                            value={grid[cap]}
                            disabled={readOnly}
                            onChange={(val) => setGrid({ ...grid, [cap]: val as CapabilityLevel })}
                            options={CAPABILITY_META[cap].levels.map((lvl) => ({
                              value: lvl,
                              label: LEVEL_LABEL[lvl],
                            }))}
                          />
                        </div>
                      ))}
                    </div>
                  </fieldset>

                  <fieldset className="perm-matrix-group" style={{ minWidth: 0 }}>
                    <legend className="perm-matrix-group-title">Team &amp; Governance</legend>
                    <div style={{ display: "flex", flexDirection: "column", gap: ".5rem" }}>
                      {MODULE_CAPABILITIES["team-governance"].map((cap) => (
                        <div className="perm-checkbox-row" key={cap}>
                          <span>{CAPABILITY_META[cap].column}</span>
                          <Select
                            aria-label={CAPABILITY_META[cap].column}
                            value={grid[cap]}
                            disabled={readOnly}
                            onChange={(val) => {
                              const nextGrid = { ...grid, [cap]: val as CapabilityLevel };
                              if (cap === "members") {
                                nextGrid.team = val === "granted" ? "granted" : "restricted";
                              }
                              setGrid(nextGrid);
                            }}
                            options={CAPABILITY_META[cap].levels.map((lvl) => ({
                              value: lvl,
                              label: LEVEL_LABEL[lvl],
                            }))}
                          />
                        </div>
                      ))}
                    </div>
                  </fieldset>
                </div>
              </div>
            </div>

            <div className="drawer-footer">
              <div style={{ marginLeft: "auto", display: "flex", gap: ".45rem" }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
                {!readOnly && (
                  <LoadingButton className="btn btn-primary btn-sm" disabled={busy} loading={busy} loadingText="Saving…" onClick={save}>
                    Save Role &amp; Permissions
                  </LoadingButton>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

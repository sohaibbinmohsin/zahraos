"use client";

import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useTeamAccess } from "./TeamAccessProvider";
import { useToast } from "@/components/shell/ToastContext";
import { createCustomRole, updateCustomRole } from "@/lib/platformFunctions";
import { OFF_GRID, type CapabilityGrid } from "@/lib/capabilityMap";
import {
  AREA_SWITCH_LABEL,
  emptySwitchesForCatalog,
  moduleBadge,
  moduleBadgeClass,
  moduleBadgeShortLabel,
  permissionKeysFromCatalogSwitches,
  permissionKeysFromDrawerGrid,
  switchesByCatalogFromKeys,
  type AreaSwitch,
  drawerCatalogs,
  type ModuleCatalog,
} from "@/registry/moduleCatalog";
import { ModuleCatalogStatusBanner } from "./ModuleCatalogStatusBanner";
import { useModuleCatalogs } from "./useModuleCatalogs";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { Select } from "@/components/ui/Select";

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
      ...OFF_GRID,
      drive: "granted",
      publish: "granted",
      triage: "granted",
      hours: "granted",
      volunteers: "view",
      org_governance: "granted",
      members: "granted",
      roles: "granted",
      audit: "view",
      inquiries: "granted",
      team: "granted",
    },
  },
  {
    name: "Org Admin",
    description: "Full operational permissions and organization-wide team governance.",
    capabilities: {
      ...OFF_GRID,
      drive: "granted",
      publish: "granted",
      triage: "granted",
      hours: "granted",
      volunteers: "view",
      org_governance: "granted",
      members: "granted",
      roles: "view",
      audit: "view",
      inquiries: "view",
      team: "granted",
    },
  },
  {
    name: "Chapter Admin",
    description: "Full chapter-level operational permissions and local chapter roster governance.",
    capabilities: {
      ...OFF_GRID,
      drive: "granted",
      publish: "granted",
      triage: "granted",
      hours: "granted",
      volunteers: "view",
      org_governance: "granted",
      members: "granted",
      roles: "off",
      audit: "view",
      inquiries: "off",
      team: "off",
    },
  },
  {
    name: "Chapter Lead",
    description: "Oversees local chapter operations, drive execution, applicant selection, hours verification, and chapter roster governance.",
    capabilities: {
      ...OFF_GRID,
      drive: "granted",
      publish: "granted",
      triage: "granted",
      hours: "granted",
      org_governance: "granted",
    },
  },
  {
    name: "City Lead",
    description: "Oversees multi-chapter regional operations, drive execution, applicant selection, hours verification, and chapter roster governance.",
    capabilities: {
      ...OFF_GRID,
      drive: "granted",
      publish: "granted",
      triage: "granted",
      hours: "granted",
      org_governance: "granted",
    },
  },
  {
    name: "Operations Lead",
    description: "Oversees local chapter operations, drive execution, applicant selection, and field shift oversight.",
    capabilities: {
      ...OFF_GRID,
      drive: "granted",
      publish: "granted",
      triage: "granted",
      hours: "granted",
      volunteers: "off",
      org_governance: "off",
      members: "off",
      roles: "off",
      audit: "off",
      inquiries: "off",
      team: "off",
    },
  },
  {
    name: "Drive Coordinator",
    description: "Manages on-ground drive shifts, volunteer gate attendance, and direct shift hours logging.",
    capabilities: {
      ...OFF_GRID,
      drive: "granted",
      publish: "off",
      triage: "granted",
      hours: "granted",
      volunteers: "off",
      org_governance: "off",
      members: "off",
      roles: "off",
      audit: "off",
      inquiries: "off",
      team: "off",
    },
  },
  {
    name: "Application Reviewer",
    description: "Screens and shortlists volunteer applicants, assesses question responses, and assigns candidate statuses.",
    capabilities: {
      ...OFF_GRID,
      drive: "off",
      publish: "off",
      triage: "granted",
      hours: "off",
      volunteers: "off",
      org_governance: "off",
      members: "off",
      roles: "off",
      audit: "off",
      inquiries: "off",
      team: "off",
    },
  },
  {
    name: "Auditor",
    description: "Read-only compliance officer auditing hours logs, certifications, and operational activity records.",
    capabilities: {
      ...OFF_GRID,
      drive: "off",
      publish: "off",
      triage: "view",
      hours: "view",
      volunteers: "view",
      org_governance: "off",
      members: "off",
      roles: "off",
      audit: "view",
      inquiries: "off",
      team: "off",
    },
  },
];

type CatalogPreset = "full" | "view" | "none";

function applyPresetToCatalog(catalog: ModuleCatalog, preset: CatalogPreset): Record<string, AreaSwitch> {
  const next = emptySwitchesForCatalog(catalog);
  for (const area of catalog.areas) {
    if (preset === "full") {
      next[area.key] = area.highest;
    } else if (preset === "view") {
      next[area.key] = "view";
    } else {
      next[area.key] = "none";
    }
  }
  return next;
}

function areaSwitchOptions(area: ModuleCatalog["areas"][number]) {
  const options: Array<{ value: AreaSwitch; label: string }> = [
    { value: "none", label: AREA_SWITCH_LABEL.none },
    { value: "view", label: AREA_SWITCH_LABEL.view },
  ];
  if (area.highest === "manage") {
    options.push({ value: "manage", label: AREA_SWITCH_LABEL.manage });
  }
  return options;
}

export function RoleDrawer({
  request, onClose,
}: {
  request: { mode: "create" | "edit" | "view" | "clone"; roleId: string | null } | null;
  onClose: () => void;
}) {
  const { organizationId, accessToken, moduleId, roles, refresh } = useTeamAccess();
  const { showToast } = useToast();
  const open = request !== null;
  const { catalogs, error: catalogError, loading: catalogsLoading, ready: catalogsReady } = useModuleCatalogs(
    organizationId,
    accessToken,
    open,
  );

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
          permissionKeys: permissionKeysFromDrawerGrid(drawerCatalogs, tmpl.capabilities),
        };
      })()
    : null;
  const readOnly = request?.mode === "view";

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [switchesByCatalog, setSwitchesByCatalog] = useState<Record<string, Record<string, AreaSwitch>>>({});
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [busy, setBusy] = useState(false);
  const [expandedServices, setExpandedServices] = useState<Record<string, boolean>>({});

  const activeCatalogs = catalogs ?? [];

  function toggleService(key: string) {
    setExpandedServices((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function setCatalogSwitches(catalogKey: string, next: Record<string, AreaSwitch>) {
    setSwitchesByCatalog((prev) => ({ ...prev, [catalogKey]: next }));
  }

  function applyCatalogPreset(catalog: ModuleCatalog, preset: CatalogPreset) {
    setCatalogSwitches(catalog.key, applyPresetToCatalog(catalog, preset));
  }

  function setSwitchesFromPermissionKeys(permissionKeys: string[], loadedCatalogs: readonly ModuleCatalog[]) {
    setSwitchesByCatalog(switchesByCatalogFromKeys(loadedCatalogs, permissionKeys));
  }

  useLayoutEffect(() => {
    if (!request || !catalogs) return;

    if (request.mode === "create") {
      setName("");
      setDescription("");
      setSelectedTemplate("");
      const blank = Object.fromEntries(
        catalogs.map((catalog) => [catalog.key, applyPresetToCatalog(catalog, "none")]),
      );
      if (blank["youth-republic"]) {
        blank["youth-republic"] = {
          ...blank["youth-republic"],
          drives: "manage",
          applications: "manage",
        };
      }
      setSwitchesByCatalog(blank);
      setExpandedServices(Object.fromEntries(catalogs.map((catalog) => [catalog.key, true])));
      return;
    }

    if (source) {
      setSwitchesFromPermissionKeys(source.permissionKeys, catalogs);
      setDescription(source.description ?? "");
      setName(request.mode === "clone" ? `${source.name} (Copy)` : source.name);
      setSelectedTemplate("");
      setExpandedServices(
        request.mode === "view"
          ? {}
          : Object.fromEntries(catalogs.map((catalog) => [catalog.key, true])),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request, source?.id, catalogs]);

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
    if (!catalogs) return;
    const fromRoles = roles.find((r) => r.id === roleIdOrKey || r.name === roleIdOrKey);
    if (fromRoles) {
      setSwitchesFromPermissionKeys(fromRoles.permissionKeys, catalogs);
      if (!description) setDescription(fromRoles.description ?? "");
      return;
    }

    for (const catalog of catalogs) {
      const fromModuleTemplate = catalog.roleTemplates.find(
        (t) => t.name === roleIdOrKey || `template-${t.name}` === roleIdOrKey,
      );
      if (fromModuleTemplate) {
        setCatalogSwitches(catalog.key, { ...fromModuleTemplate.switches });
        if (!description) setDescription(fromModuleTemplate.description);
        return;
      }
    }

    const fromTmpl = ROLE_TEMPLATES.find(
      (t) => t.name === roleIdOrKey || `template-${t.name}` === roleIdOrKey,
    );
    if (fromTmpl) {
      const keys = permissionKeysFromDrawerGrid(catalogs, fromTmpl.capabilities);
      setSwitchesFromPermissionKeys(keys, catalogs);
      if (!description) setDescription(fromTmpl.description);
    }
  }

  function handleTemplateChange(templateKey: string) {
    setSelectedTemplate(templateKey);
    if (templateKey) applyTemplate(templateKey);
  }

  async function save() {
    if (!name.trim()) { showToast("Please specify a role title.", "error"); return; }
    if (!accessToken || !catalogs) return;
    if (request?.mode === "edit" && !source) {
      showToast("This role is no longer available — reopen it.", "error");
      return;
    }
    setBusy(true);
    const permissionKeys = permissionKeysFromCatalogSwitches(catalogs, switchesByCatalog);
    try {
      if (request?.mode === "edit" && source) {
        await updateCustomRole({
          roleId: source.id,
          name: name.trim(),
          description,
          permissionKeys,
        }, accessToken);
        showToast(`Role "${name.trim()}" updated successfully.`);
      } else {
        if (!organizationId || !moduleId) return;
        await createCustomRole({
          organizationId,
          moduleId,
          name: name.trim(),
          description,
          permissionKeys,
        }, accessToken);
        showToast(`Created new custom role "${name.trim()}".`);
      }
      await refresh();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg === "role_name_taken") showToast("A role with that name already exists.", "error");
      else if (msg === "system_role_immutable") showToast("System roles can't be edited.", "error");
      else showToast("Failed to save role.", "error");
    } finally {
      setBusy(false);
    }
  }

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
              <ModuleCatalogStatusBanner error={catalogError} loading={catalogsLoading} />
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
                  {activeCatalogs.map((catalog) => {
                    const catalogSwitches = switchesByCatalog[catalog.key] ?? emptySwitchesForCatalog(catalog);
                    const badge = moduleBadge(catalog, catalogSwitches);
                    const badgeLabel = moduleBadgeShortLabel(badge);
                    const badgeClass = moduleBadgeClass(badge);
                    const isOpen = Boolean(expandedServices[catalog.key]);

                    return (
                      <div
                        key={catalog.key}
                        className="perm-matrix-group"
                        data-testid={`service-accordion-${catalog.key}`}
                        style={{ minWidth: 0, padding: "0.85rem 1rem" }}
                      >
                        <div
                          role="button"
                          tabIndex={0}
                          aria-label={`Toggle ${catalog.title}`}
                          aria-expanded={isOpen}
                          onClick={() => toggleService(catalog.key)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              toggleService(catalog.key);
                            }
                          }}
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            justifyContent: "space-between",
                            gap: "0.75rem",
                            flexWrap: "wrap",
                            cursor: "pointer",
                            userSelect: "none",
                          }}
                        >
                          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", flex: 1, minWidth: 200 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "0.4rem",
                                  fontWeight: 600,
                                  fontSize: "var(--text-sm)",
                                  color: "var(--ink)",
                                  textAlign: "left",
                                }}
                              >
                                <svg
                                  aria-hidden="true"
                                  width="12"
                                  height="12"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  style={{
                                    transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                                    transition: "transform 0.15s ease",
                                  }}
                                >
                                  <polyline points="6 9 12 15 18 9" />
                                </svg>
                                <span>{catalog.title}</span>
                              </span>
                              <span
                                className={`badge ${badgeClass}`}
                                data-testid={`service-badge-${catalog.key}`}
                              >
                                {badgeLabel}
                              </span>
                            </div>
                            <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-2)", lineHeight: 1.35, paddingLeft: "1.15rem" }}>
                              {catalog.description}
                            </div>
                          </div>

                          {!readOnly && (
                            <div
                              className="service-presets"
                              onClick={(e) => e.stopPropagation()}
                              style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}
                            >
                              <button
                                type="button"
                                className="btn btn-secondary btn-xs"
                                aria-label={`${catalog.title}: Full`}
                                data-testid={`preset-full-${catalog.key}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  applyCatalogPreset(catalog, "full");
                                }}
                                style={{ fontSize: "var(--text-xs)", padding: "0.15rem 0.5rem" }}
                              >
                                Full
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary btn-xs"
                                aria-label={`${catalog.title}: View`}
                                data-testid={`preset-view-${catalog.key}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  applyCatalogPreset(catalog, "view");
                                }}
                                style={{ fontSize: "var(--text-xs)", padding: "0.15rem 0.5rem" }}
                              >
                                View
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary btn-xs"
                                aria-label={`${catalog.title}: None`}
                                data-testid={`preset-none-${catalog.key}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  applyCatalogPreset(catalog, "none");
                                }}
                                style={{ fontSize: "var(--text-xs)", padding: "0.15rem 0.5rem" }}
                              >
                                None
                              </button>
                            </div>
                          )}
                        </div>

                        {isOpen && (
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: ".5rem",
                              marginTop: ".75rem",
                              paddingTop: ".65rem",
                              borderTop: "1px solid var(--line-subtle)",
                            }}
                          >
                            {catalog.areas.map((area) => {
                              const value = catalogSwitches[area.key] ?? "none";
                              return (
                                <div className="perm-checkbox-row" key={area.key} data-area={area.key}>
                                  <span>{area.label}</span>
                                  {readOnly ? (
                                    <span
                                      className={`badge ${
                                        value === "manage"
                                          ? "badge-pos"
                                          : value === "view"
                                          ? "badge-neu"
                                          : "badge-neg"
                                      }`}
                                      data-testid={`area-badge-${catalog.key}-${area.key}`}
                                    >
                                      {AREA_SWITCH_LABEL[value]}
                                    </span>
                                  ) : (
                                    <Select
                                      aria-label={area.label}
                                      value={value}
                                      onChange={(val) => {
                                        setCatalogSwitches(catalog.key, {
                                          ...catalogSwitches,
                                          [area.key]: val as AreaSwitch,
                                        });
                                      }}
                                      options={areaSwitchOptions(area)}
                                    />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="drawer-footer">
              <div style={{ marginLeft: "auto", display: "flex", gap: ".45rem" }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
                {!readOnly && (
                  <LoadingButton
                    className="btn btn-primary btn-sm"
                    disabled={busy || !catalogsReady || Boolean(catalogError)}
                    loading={busy}
                    loadingText="Saving…"
                    onClick={save}
                  >
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
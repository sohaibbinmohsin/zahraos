"use client";

import { useState } from "react";
import {
  AREA_SWITCH_LABEL,
  moduleBadge,
  moduleBadgeClass,
  moduleBadgeShortLabel,
  switchesFromKeys,
  type ModuleCatalog,
} from "@/registry/moduleCatalog";

function areaBadgeClass(value: "none" | "view" | "manage"): string {
  if (value === "manage") return "badge-pos";
  if (value === "view") return "badge-neu";
  return "badge-neg";
}

export function RoleServiceInspector({
  catalogs,
  permissionKeys,
  roleName,
  readOnly,
}: {
  catalogs: ModuleCatalog[];
  permissionKeys: string[];
  roleName: string;
  readOnly?: boolean;
}): React.JSX.Element {
  const [expandedModules, setExpandedModules] = useState<Set<string>>(() => new Set());

  const toggleModule = (moduleKey: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(moduleKey)) {
        next.delete(moduleKey);
      } else {
        next.add(moduleKey);
      }
      return next;
    });
  };

  return (
    <div
      className="p-4 rounded-lg flex flex-col gap-3"
      style={{
        background: "var(--bg-surface, #FFFFFF)",
        border: "1px solid var(--line)",
      }}
    >
      <div
        className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b"
        style={{ borderColor: "var(--line)" }}
      >
        <div>
          <div className="flex items-center gap-2">
            <span
              className="mono font-semibold uppercase tracking-wider"
              style={{ fontSize: "var(--text-2xs)", color: "var(--ink-3)" }}
            >
              IAM Service Policy
            </span>
            {readOnly && (
              <span className="badge badge-neu" style={{ fontSize: "var(--text-2xs)" }}>
                Inspector Mode
              </span>
            )}
          </div>
          <h4
            className="text-base font-semibold"
            style={{ color: "var(--ink)", margin: "0.2rem 0 0 0" }}
          >
            {roleName}
          </h4>
        </div>
        <div className="text-xs font-medium" style={{ color: "var(--ink-2)" }}>
          {catalogs.length} Governed {catalogs.length === 1 ? "Service Module" : "Service Modules"}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {catalogs.map((catalog) => {
          const areaSwitches = switchesFromKeys(catalog, permissionKeys);
          const badge = moduleBadge(catalog, areaSwitches);
          const isExpanded = expandedModules.has(catalog.key);

          return (
            <div
              key={catalog.key}
              className="rounded-md border overflow-hidden transition-all"
              style={{
                borderColor: isExpanded ? "var(--line)" : "var(--line-subtle)",
                background: "var(--bg-panel, #FFFFFF)",
              }}
            >
              <button
                type="button"
                onClick={() => toggleModule(catalog.key)}
                className="w-full text-left p-3 flex flex-wrap items-center justify-between gap-3 transition-colors cursor-pointer select-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--brand)]"
                style={{
                  background: isExpanded ? "var(--bg-page, #F8F9FA)" : "transparent",
                }}
                aria-expanded={isExpanded}
                aria-controls={`module-panel-${catalog.key}`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    aria-hidden="true"
                    style={{
                      display: "inline-block",
                      transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                      transition: "transform 0.15s ease",
                      color: "var(--ink-3)",
                      fontSize: "var(--text-xs)",
                      lineHeight: 1,
                    }}
                  >
                    ▶
                  </span>
                  <div>
                    <div className="font-semibold text-sm" style={{ color: "var(--ink)" }}>
                      {catalog.title}
                    </div>
                    <div
                      className="text-xs truncate max-w-xl"
                      style={{ color: "var(--ink-2)", marginTop: "2px" }}
                    >
                      {catalog.description}
                    </div>
                  </div>
                </div>

                <span className={`badge ${moduleBadgeClass(badge)}`}>{moduleBadgeShortLabel(badge)}</span>
              </button>

              {isExpanded && (
                <div
                  id={`module-panel-${catalog.key}`}
                  className="p-3 border-t flex flex-col gap-1.5"
                  style={{
                    borderColor: "var(--line)",
                    background: "var(--bg-panel, #FFFFFF)",
                  }}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {catalog.areas.map((area) => {
                      const level = areaSwitches[area.key] ?? "none";
                      return (
                        <div
                          key={area.key}
                          data-area={area.key}
                          className="flex items-center justify-between px-3 py-2 rounded border"
                          style={{
                            borderColor: "var(--line-subtle)",
                            background: "var(--bg-page, #F8F9FA)",
                          }}
                        >
                          <span className="text-xs font-medium" style={{ color: "var(--ink)" }}>
                            {area.label}
                          </span>
                          <span className={`badge ${areaBadgeClass(level)}`}>
                            {AREA_SWITCH_LABEL[level]}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
"use client";

import { useState } from "react";
import {
  SERVICE_MODULES,
  CAPABILITY_META,
  getRoleModuleSummaries,
  type CapabilityGrid,
  type CapabilityLevel,
  type ModuleAccessLevel,
  type RoleModuleSummary,
} from "@/lib/capabilityMap";

function serviceBadge(level: ModuleAccessLevel) {
  switch (level) {
    case "full":
      return <span className="badge badge-pos">Full Access</span>;
    case "limited":
      return <span className="badge badge-warn">Limited</span>;
    case "read_only":
      return <span className="badge badge-neu">Read Only</span>;
    case "restricted":
      return <span className="badge badge-neg">Restricted</span>;
  }
}

function capabilityBadge(level: CapabilityLevel) {
  switch (level) {
    case "granted":
      return <span className="badge badge-pos">Granted</span>;
    case "read_only":
      return <span className="badge badge-neu">Read Only</span>;
    case "restricted":
      return <span className="badge badge-neg">Restricted</span>;
  }
}

function formatRatio(summary: RoleModuleSummary): string {
  const parts: string[] = [];
  if (summary.grantedCount > 0) parts.push(`${summary.grantedCount} Granted`);
  if (summary.readOnlyCount > 0) parts.push(`${summary.readOnlyCount} Read Only`);
  if (summary.restrictedCount > 0) parts.push(`${summary.restrictedCount} Restricted`);
  if (parts.length === 0) return "0 Granted";
  return parts.join(" · ");
}

export function RoleServiceInspector({
  grid,
  roleName,
  readOnly,
}: {
  grid: CapabilityGrid;
  roleName: string;
  readOnly?: boolean;
}): React.JSX.Element {
  const [expandedModules, setExpandedModules] = useState<Set<string>>(() => new Set());
  const summaries = getRoleModuleSummaries(grid);

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
      {/* Policy Summary Header */}
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
              <span className="badge badge-neu" style={{ fontSize: "10px" }}>
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
          {summaries.length} Governed {summaries.length === 1 ? "Service Module" : "Service Modules"}
        </div>
      </div>

      {/* Service Module Accordions */}
      <div className="flex flex-col gap-2">
        {summaries.map((summary) => {
          const isExpanded = expandedModules.has(summary.moduleKey);
          const modConfig = SERVICE_MODULES.find((m) => m.key === summary.moduleKey);
          const capabilities = modConfig?.capabilities ?? [];

          return (
            <div
              key={summary.moduleKey}
              className="rounded-md border overflow-hidden transition-all"
              style={{
                borderColor: isExpanded ? "var(--line)" : "var(--line-subtle)",
                background: "var(--bg-panel, #FFFFFF)",
              }}
            >
              {/* Accordion Trigger */}
              <button
                type="button"
                onClick={() => toggleModule(summary.moduleKey)}
                className="w-full text-left p-3 flex flex-wrap items-center justify-between gap-3 transition-colors cursor-pointer select-none"
                style={{
                  background: isExpanded ? "var(--bg-page, #F8F9FA)" : "transparent",
                }}
                aria-expanded={isExpanded}
                aria-controls={`module-panel-${summary.moduleKey}`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    style={{
                      display: "inline-block",
                      transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                      transition: "transform 0.15s ease",
                      color: "var(--ink-3)",
                      fontSize: "12px",
                      lineHeight: 1,
                    }}
                  >
                    ▶
                  </span>
                  <div>
                    <div className="font-semibold text-sm" style={{ color: "var(--ink)" }}>
                      {summary.title}
                    </div>
                    <div
                      className="text-xs truncate max-w-xl"
                      style={{ color: "var(--ink-2)", marginTop: "2px" }}
                    >
                      {summary.description}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 ml-auto">
                  <span className="mono text-xs font-medium" style={{ color: "var(--ink-2)" }}>
                    {formatRatio(summary)}
                  </span>
                  {serviceBadge(summary.level)}
                </div>
              </button>

              {/* Accordion Capability Details */}
              {isExpanded && (
                <div
                  id={`module-panel-${summary.moduleKey}`}
                  className="p-3 border-t flex flex-col gap-1.5"
                  style={{
                    borderColor: "var(--line)",
                    background: "var(--bg-panel, #FFFFFF)",
                  }}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {capabilities.map((cap) => {
                      const meta = CAPABILITY_META[cap];
                      const title = meta?.column ?? cap;
                      const level: CapabilityLevel = grid[cap] ?? "restricted";

                      return (
                        <div
                          key={cap}
                          data-capability={cap}
                          className="flex items-center justify-between px-3 py-2 rounded border"
                          style={{
                            borderColor: "var(--line-subtle)",
                            background: "var(--bg-page, #F8F9FA)",
                          }}
                        >
                          <span
                            className="text-xs font-medium"
                            style={{ color: "var(--ink)" }}
                          >
                            {title}
                          </span>
                          {capabilityBadge(level)}
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

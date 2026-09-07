"use client";

import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useIsOrgAdminOrAbove, useShellLoading } from "@/components/shell/AppShell";
import { TeamAccessProvider } from "@/components/team/TeamAccessProvider";
import { TeamDrawersProvider } from "@/components/team/TeamDrawers";
import { TeamHeaderContext, type TeamHeaderAction } from "@/components/team/teamHeader";
import { GovernanceTabs } from "@/components/team/GovernanceTabs";

const HEADINGS: Record<string, { title: string; subtitle: string }> = {
  "/team/members": {
    title: "Team Members Directory",
    subtitle: "Manage administrative team members, multi-role assignments, and chapter operational scopes.",
  },
  "/team/roles": {
    title: "Roles & Permissions Matrix",
    subtitle: "Configure granular capability privileges and operational access boundaries for system and custom roles.",
  },
  "/team/audit": {
    title: "Security & Operational Audit Log",
    subtitle: "Complete immutable chronological record of team administrative operations, role modifications, and security events.",
  },
};

export default function TeamLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/team/members";
  const shellLoading = useShellLoading();
  const isAdmin = useIsOrgAdminOrAbove();
  const [action, setAction] = useState<TeamHeaderAction | null>(null);
  const heading = HEADINGS[pathname] ?? HEADINGS["/team/members"];
  const headerValue = useMemo(() => ({ action, setAction }), [action]);

  if (shellLoading) {
    return (
      <div className="panel p-8 text-center">
        <p className="text-[var(--ink-3)] font-medium">
          Loading team access…
        </p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="panel p-8 text-center">
        <p className="text-[var(--ink-2)] font-medium">
          You need organization admin access to manage the team.
        </p>
      </div>
    );
  }

  return (
    <div>
      <GovernanceTabs />

      <TeamAccessProvider>
        <TeamDrawersProvider>
          <TeamHeaderContext.Provider value={headerValue}>
            <div className="space-y-6">
              <div className="page-header">
                <div>
                  <h1 className="page-title">{heading.title}</h1>
                  <div className="page-subtitle">{heading.subtitle}</div>
                </div>
                {action && (
                  <div className="page-toolbar">
                    <button
                      type="button"
                      className={`btn btn-${action.variant} btn-sm`}
                      onClick={action.onClick}
                    >
                      {action.label}
                    </button>
                  </div>
                )}
              </div>

              {children}
            </div>
          </TeamHeaderContext.Provider>
        </TeamDrawersProvider>
      </TeamAccessProvider>
    </div>
  );
}

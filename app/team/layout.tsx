"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useIsOrgAdminOrAbove } from "@/components/shell/AppShell";
import { TeamAccessProvider } from "@/components/team/TeamAccessProvider";
import { TeamHeaderContext, type TeamHeaderAction } from "@/components/team/teamHeader";

// TODO(task-5): replace with the real TeamDrawersProvider from "@/components/team/TeamDrawers"
function TeamDrawersProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

const TABS = [
  { href: "/team/members", label: "Team Members" },
  { href: "/team/roles", label: "Roles & Permissions" },
  { href: "/team/audit", label: "Audit Log" },
];

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
  const isAdmin = useIsOrgAdminOrAbove();
  const [action, setAction] = useState<TeamHeaderAction | null>(null);
  const heading = HEADINGS[pathname] ?? HEADINGS["/team/members"];
  const headerValue = useMemo(() => ({ action, setAction }), [action]);

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

            <nav className="module-nav-bar -mx-8 -mt-2 border-b border-[var(--line)] bg-white">
              <div className="module-nav-wrap">
                {TABS.map((tab) => (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    className={`module-tab ${pathname === tab.href ? "active" : ""}`}
                  >
                    <span>{tab.label}</span>
                  </Link>
                ))}
              </div>
            </nav>

            {children}
          </div>
        </TeamHeaderContext.Provider>
      </TeamDrawersProvider>
    </TeamAccessProvider>
  );
}

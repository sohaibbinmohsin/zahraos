"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { listApplications, listActivityHours } from "@/lib/youthRepublicFunctions";
import { useSelectedOrg, useShellStaffToken } from "@/components/shell/AppShell";
import { useCenterActiveTab } from "@/components/shell/useCenterActiveTab";
import { useStaffPermissions, type StaffPermissions } from "@/components/shell/useStaffPermissions";

type Badges = { applications: number; hours: number };

type TabMetaItem = {
  href: string;
  label: string;
  permission: keyof StaffPermissions;
  icon: React.ReactNode;
  key: "applications" | "hours" | null;
};

const TAB_META: TabMetaItem[] = [
  {
    href: "/youth-republic/dashboard",
    label: "Dashboard",
    permission: "canAccessDashboard",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
      </svg>
    ),
    key: null,
  },
  {
    href: "/youth-republic/drives",
    label: "Drives",
    permission: "canViewDrives",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    ),
    key: null,
  },
  {
    href: "/youth-republic/applications",
    label: "Applications",
    permission: "canViewApplications",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
    ),
    key: "applications",
  },
  {
    href: "/youth-republic/hours",
    label: "Hours",
    permission: "canViewHours",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
    key: "hours",
  },
  {
    href: "/youth-republic/volunteers",
    label: "Volunteers",
    permission: "canViewVolunteers",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    key: null,
  },
];

export default function YouthRepublicModuleLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const organizationId = useSelectedOrg();
  const staffToken = useShellStaffToken();
  const perms = useStaffPermissions();
  const [badges, setBadges] = useState<Badges | null>(null);
  const { wrapRef, onTabClick } = useCenterActiveTab(pathname);

  const visibleTabs = TAB_META.filter((tab) => Boolean(perms[tab.permission]));

  useEffect(() => {
    let cancelled = false;
    if (!organizationId || !staffToken) {
      setBadges(null);
      return;
    }
    (async () => {
      try {
        const token = staffToken;
        const appsPromise = perms.canViewApplications
          ? listApplications({ organizationId, limit: 100 }, token)
          : null;
        const hoursPromise = perms.canViewHours
          ? listActivityHours({ organizationId, limit: 100 }, token)
          : null;

        const [appsRes, hoursRes] = await Promise.allSettled([
          appsPromise ?? Promise.resolve(null),
          hoursPromise ?? Promise.resolve(null),
        ]);
        if (cancelled) return;

        const appsCount =
          appsPromise && appsRes.status === "fulfilled" && appsRes.value
            ? appsRes.value.applications.filter(
                (a) => a.status === "pending_review" || a.status === "submitted" || a.status === "under_review",
              ).length
            : 0;

        const hoursCount =
          hoursPromise && hoursRes.status === "fulfilled" && hoursRes.value
            ? hoursRes.value.activity.filter((h) => h.verificationStatus === "pending").length
            : 0;

        setBadges({
          applications: appsCount,
          hours: hoursCount,
        });
      } catch {
        if (!cancelled) setBadges(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [organizationId, staffToken, perms.canViewApplications, perms.canViewHours]);

  function badgeFor(key: string | null): string | null {
    if (!key || !badges) return null;
    if (key === "applications" && perms.canViewApplications) return badges.applications > 0 ? `${badges.applications} pending` : null;
    if (key === "hours" && perms.canViewHours) return badges.hours > 0 ? `${badges.hours} pending` : null;
    return null;
  }

  return (
    <div>
      {/* Contextual Sub-Nav Bar (Changes per Active Module — not sticky) */}
      <nav className="module-nav-bar">
        <div className="module-nav-wrap" ref={wrapRef}>
          {visibleTabs.map((tab) => {
            const isActive = pathname?.startsWith(tab.href);
            const badge = badgeFor(tab.key);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-label={tab.label}
                onClick={onTabClick}
                className={`module-tab ${isActive ? "active" : ""}`}
              >
                <span className="icon-svg" aria-hidden="true">{tab.icon}</span>
                <span>{tab.label}</span>
                {badge && <span className="count-badge" aria-hidden="true">{badge}</span>}
              </Link>
            );
          })}
        </div>
      </nav>
      {children}
    </div>
  );
}

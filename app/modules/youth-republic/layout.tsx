"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { fetchStaffToken } from "@/lib/staffToken";
import { listApplications, listActivityHours } from "@/lib/youthRepublicFunctions";
import { useSelectedOrg } from "@/components/shell/AppShell";

type Badges = { applications: number; hours: number };

const TAB_META = [
  {
    href: "/modules/youth-republic/dashboard",
    label: "Dashboard",
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
    href: "/modules/youth-republic/opportunities",
    label: "Opportunities",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    ),
    key: null,
  },
  {
    href: "/modules/youth-republic/applications",
    label: "Applications",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
    ),
    key: "applications" as const,
  },
  {
    href: "/modules/youth-republic/hours",
    label: "Hours",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
    key: "hours" as const,
  },
  {
    href: "/modules/youth-republic/volunteers",
    label: "Volunteers",
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
  const [badges, setBadges] = useState<Badges | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!organizationId) {
      setBadges(null);
      return;
    }
    (async () => {
      try {
        const supabase = getBrowserSupabaseClient();
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session) return;
        const token = await fetchStaffToken(sessionData.session.access_token);
        const [apps, hours] = await Promise.all([
          listApplications({ organizationId, limit: 100 }, token),
          listActivityHours({ organizationId, limit: 100 }, token),
        ]);
        if (cancelled) return;
        setBadges({
          applications: apps.applications.filter((a) => a.status === "submitted" || a.status === "under_review").length,
          hours: hours.activity.filter((h) => h.verificationStatus === "pending").length,
        });
      } catch {
        if (!cancelled) setBadges(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  function badgeFor(key: string | null): string | null {
    if (!key || !badges) return null;
    if (key === "applications") return badges.applications > 0 ? `${badges.applications} pending` : null;
    if (key === "hours") return badges.hours > 0 ? `${badges.hours} pending` : null;
    return null;
  }

  return (
    <div>
      {/* Contextual Sub-Nav Bar (Changes per Active Module — not sticky) */}
      <nav className="module-nav-bar mb-6 -mx-8 -mt-7 border-b border-[var(--line)] bg-white">
        <div className="module-nav-wrap">
          {TAB_META.map((tab) => {
            const isActive = pathname?.startsWith(tab.href);
            const badge = badgeFor(tab.key);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-label={tab.label}
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

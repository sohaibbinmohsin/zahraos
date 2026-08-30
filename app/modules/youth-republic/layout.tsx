"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
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
    badge: null,
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
    badge: "6",
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
    badge: "5 Pending",
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
    badge: "3 Pending",
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
    badge: null,
  },
];

export default function YouthRepublicModuleLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div>
      {/* Contextual Sub-Nav Bar (Changes per Active Module — not sticky) */}
      <nav className="module-nav-bar mb-6 -mx-8 -mt-7 border-b border-[var(--line)] bg-white">
        <div className="module-nav-wrap">
          {TABS.map((tab) => {
            const isActive = pathname?.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-label={tab.label}
                className={`module-tab ${isActive ? "active" : ""}`}
              >
                <span className="icon-svg" aria-hidden="true">{tab.icon}</span>
                <span>{tab.label}</span>
                {tab.badge && <span className="count-badge" aria-hidden="true">{tab.badge}</span>}
              </Link>
            );
          })}
        </div>
      </nav>
      {children}
    </div>
  );
}

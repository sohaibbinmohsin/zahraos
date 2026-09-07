"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  {
    href: "/organization",
    label: "Organization",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 21h18" /><path d="M5 21V7l8-4v18" /><path d="M19 21V11l-6-4" />
        <path d="M9 9v.01" /><path d="M9 12v.01" /><path d="M9 15v.01" /><path d="M9 18v.01" />
      </svg>
    ),
  },
  {
    href: "/team/members",
    label: "Team Members",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    href: "/team/roles",
    label: "Roles & Permissions",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
  {
    href: "/team/audit",
    label: "Audit Log",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
  {
    href: "#",
    label: "Data Controls",
    comingSoon: true,
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
      </svg>
    ),
  },
];

export function GovernanceTabs() {
  const pathname = usePathname() ?? "";

  return (
    <nav className="module-nav-bar mb-6 -mx-8 -mt-7 border-b border-[var(--line)] bg-white">
      <div className="module-nav-wrap">
        {TABS.map((tab) =>
          tab.comingSoon ? (
            <span key={tab.label} className="module-tab opacity-50 cursor-not-allowed">
              <span className="icon-svg" aria-hidden="true">{tab.icon}</span>
              <span>{tab.label}</span>
              <span className="coming-soon-badge text-[9px] ml-2 px-1.5 py-0.5 rounded-sm bg-[var(--ink-1)] text-white font-medium uppercase tracking-wider">Coming Soon</span>
            </span>
          ) : (
            <Link
              key={tab.href}
              href={tab.href}
              className={`module-tab ${pathname === tab.href ? "active" : ""}`}
            >
              <span className="icon-svg" aria-hidden="true">{tab.icon}</span>
              <span>{tab.label}</span>
            </Link>
          ),
        )}
      </div>
    </nav>
  );
}

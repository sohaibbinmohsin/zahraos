"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCenterActiveTab } from "@/components/shell/useCenterActiveTab";

interface TabItem {
  href: string;
  label: string;
  badge?: string | null;
  icon: React.ReactNode;
}

const TABS: TabItem[] = [
  {
    href: "/maseeha/dashboard",
    label: "Dashboard",
    badge: null,
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
      </svg>
    ),
  },
  {
    href: "/maseeha/cases",
    label: "Emergency Cases",
    badge: "12",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
        <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
        <path d="M9 14h6" />
        <path d="M12 11v6" />
      </svg>
    ),
  },
  {
    href: "/maseeha/zakat",
    label: "Zakat Relief Audit",
    badge: "4",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
        <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
        <path d="M7 21h10" />
        <path d="M12 3v18" />
        <path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />
      </svg>
    ),
  },
  {
    href: "/maseeha/fleet",
    label: "Ambulance Fleet",
    badge: null,
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M10 17h4V5H2v12h3" />
        <path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5v8h2" />
        <circle cx="7.5" cy="17.5" r="2.5" />
        <circle cx="17.5" cy="17.5" r="2.5" />
      </svg>
    ),
  },
  {
    href: "/maseeha/supplies",
    label: "Medical Supplies",
    badge: null,
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="m7.5 4.27 9 5.15" />
        <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
        <path d="m3.3 7 8.7 5 8.7-5" />
        <path d="M12 22V12" />
      </svg>
    ),
  },
];

export function MaseehaTabs() {
  const pathname = usePathname() ?? "";
  const { wrapRef, onTabClick } = useCenterActiveTab(pathname);

  return (
    <nav className="module-nav-bar" aria-label="Maseeha sub navigation">
      <div className="module-nav-wrap" ref={wrapRef}>
        {TABS.map((tab) => {
          const isActive =
            tab.href === "/maseeha/dashboard"
              ? pathname === "/maseeha" || pathname === "/maseeha/dashboard"
              : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              onClick={onTabClick}
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
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/modules/youth-republic/dashboard", label: "Dashboard" },
  { href: "/modules/youth-republic/volunteers", label: "Volunteers" },
  { href: "/modules/youth-republic/opportunities", label: "Opportunities" },
  { href: "/modules/youth-republic/applications", label: "Applications" },
  { href: "/modules/youth-republic/hours", label: "Hours" },
];

export default function YouthRepublicModuleLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div>
      <nav className="mb-6 flex gap-4 border-b border-gray-200 text-sm">
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={`border-b-2 pb-2 ${pathname?.startsWith(tab.href) ? "border-gray-900 font-medium" : "border-transparent text-gray-600"}`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}

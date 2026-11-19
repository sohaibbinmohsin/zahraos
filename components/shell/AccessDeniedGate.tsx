"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useLandingDestination } from "./useLandingDestination";

export interface AccessDeniedGateProps {
  allowed: boolean;
  sectionName?: string;
  fallbackRoute?: string;
  fallbackLabel?: string;
  children: ReactNode;
}

function linkLabel(label: string): string {
  const lower = label.toLowerCase();
  if (lower.startsWith("go to") || lower.startsWith("return") || lower.startsWith("back")) return label;
  return `Go to ${label}`;
}

export function AccessDeniedGate({
  allowed,
  sectionName,
  fallbackRoute,
  fallbackLabel,
  children,
}: AccessDeniedGateProps) {
  const landing = useLandingDestination();
  if (allowed) {
    return <>{children}</>;
  }

  const href = fallbackRoute ?? landing?.href;
  const name = fallbackLabel ?? landing?.label;
  const pathname = typeof window === "undefined" ? "" : window.location.pathname;
  const loops = Boolean(href && (pathname === href || pathname.startsWith(`${href}/`)));
  const showLink = Boolean(href && name && !loops);

  return (
    <div
      role="alert"
      aria-live="polite"
      className="panel p-8 text-center max-w-lg mx-auto my-12 flex flex-col items-center gap-4"
    >
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center"
        style={{
          backgroundColor: "var(--st-neg-bg)",
          color: "var(--st-neg-fg)",
          border: "1px solid var(--st-neg-bd)",
        }}
        aria-hidden="true"
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
        </svg>
      </div>

      <div className="space-y-1.5">
        <h2 className="panel-title text-xl text-[var(--ink)]">Access Denied</h2>
        <p className="text-sm text-[var(--ink-2)]">
          {sectionName
            ? `You do not have permission to view the ${sectionName} section.`
            : "You do not have permission to view this section."}
        </p>
      </div>

      {showLink && href && name && (
        <div className="pt-2">
          <Link href={href} className="btn btn-secondary inline-flex items-center gap-2">
            {linkLabel(name)}
          </Link>
        </div>
      )}
    </div>
  );
}

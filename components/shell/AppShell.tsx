"use client";

import { createContext, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { fetchStaffToken, decodeStaffTokenClaims, type StaffTokenClaims } from "@/lib/staffToken";
import { resolveOrgSwitcherOptions, pickInitialOrgId, readStoredOrgId, writeStoredOrgId } from "@/lib/selectedOrg";
import { MODULE_REGISTRY } from "@/registry/modules";
import { OrgSwitcher } from "./OrgSwitcher";
import { ToastProvider } from "./ToastContext";
import { ChangePasswordModal } from "./ChangePasswordModal";

type ShellLoadStatus = "loading" | "ready" | "error";

const CLAIMS_REFRESH_INTERVAL_MS = 45 * 60 * 1000;

interface ShellContextValue {
  selectedOrgId: string | null;
  staffClaims: StaffTokenClaims | null;
  orgTier: string | null;
  isOrgAdminOrAbove: boolean;
  accessToken: string | null;
}

const ShellContext = createContext<ShellContextValue>({
  selectedOrgId: null,
  staffClaims: null,
  orgTier: null,
  isOrgAdminOrAbove: false,
  accessToken: null,
});

export function useSelectedOrg() {
  return useContext(ShellContext).selectedOrgId;
}

export function useStaffClaims() {
  return useContext(ShellContext).staffClaims;
}

export function useOrgTier() {
  return useContext(ShellContext).orgTier;
}

export function useIsOrgAdminOrAbove() {
  return useContext(ShellContext).isOrgAdminOrAbove;
}

export function useShellAccessToken() {
  return useContext(ShellContext).accessToken;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  let pathname = "";
  try {
    pathname = usePathname() ?? "";
  } catch {
    // In unit test environment where usePathname is not provided
  }

  const [fullName, setFullName] = useState<string | null>(null);
  const [platformOwner, setPlatformOwner] = useState(false);
  const [claims, setClaims] = useState<StaffTokenClaims | null>(null);
  const [orgNames, setOrgNames] = useState<Record<string, string>>({});
  const [orgTiers, setOrgTiers] = useState<Record<string, string>>({});
  const [availableOrgIds, setAvailableOrgIds] = useState<string[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [status, setStatus] = useState<ShellLoadStatus>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // UI states
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);

  function resetShellState() {
    setFullName(null);
    setPlatformOwner(false);
    setClaims(null);
    setOrgNames({});
    setOrgTiers({});
    setAvailableOrgIds([]);
    setSelectedOrgId(null);
    setAccessToken(null);
    setUserDropdownOpen(false);
  }

  useEffect(() => {
    const supabase = getBrowserSupabaseClient();
    let cancelled = false;

    function clearClaims() {
      if (cancelled) return;
      resetShellState();
    }

    async function loadFromSession(session: { access_token: string; user?: { id?: string } } | null) {
      if (!session) {
        clearClaims();
        if (!cancelled) setStatus("ready");
        return;
      }

      try {
        const authUserId = session.user?.id;

        const staffToken = await fetchStaffToken(session.access_token);
        const decoded = decodeStaffTokenClaims(staffToken);
        if (cancelled) return;
        setClaims(decoded);
        setPlatformOwner(decoded.platformOwner);

        const { data: staffRow, error: staffError } = await supabase
          .from("staff")
          .select("full_name, platform_owner")
          .eq("auth_user_id", authUserId)
          .single();
        if (staffError) throw staffError;
        if (cancelled) return;
        if (staffRow) setFullName(staffRow.full_name);

        const { data: orgTierRows, error: orgTierError } = await supabase
          .from("staff_org_roles")
          .select("organization_id, org_tier")
          .eq("staff_id", decoded.staffId);
        if (orgTierError) throw orgTierError;
        if (cancelled) return;
        const tiersByOrg: Record<string, string> = {};
        for (const row of orgTierRows ?? []) {
          tiersByOrg[row.organization_id] = row.org_tier;
        }
        setOrgTiers(tiersByOrg);

        let orgIds: string[];
        if (decoded.platformOwner) {
          const { data: allOrgs, error: allOrgsError } = await supabase
            .from("organizations")
            .select("id, name");
          if (allOrgsError) throw allOrgsError;
          if (cancelled) return;
          orgIds = (allOrgs ?? []).map((org) => org.id as string);
          const names: Record<string, string> = {};
          for (const org of allOrgs ?? []) {
            names[org.id] = org.name;
          }
          setOrgNames(names);
        } else {
          orgIds = resolveOrgSwitcherOptions(decoded.orgRoles, decoded.moduleAccess);
          if (orgIds.length > 0) {
            const { data: organizations, error: organizationsError } = await supabase
              .from("organizations")
              .select("id, name")
              .in("id", orgIds);
            if (organizationsError) throw organizationsError;
            if (cancelled) return;
            const names: Record<string, string> = {};
            for (const org of organizations ?? []) {
              names[org.id] = org.name;
            }
            setOrgNames(names);
          }
        }
        setAvailableOrgIds(orgIds);
        const initialOrgId = pickInitialOrgId(orgIds, readStoredOrgId());
        setSelectedOrgId(initialOrgId);

        if (!cancelled) {
          setStatus("ready");
          setAccessToken(session.access_token);
        }
      } catch (err) {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : "Unknown error");
        setStatus("error");
      }
    }

    async function init() {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (cancelled) return;
        await loadFromSession(sessionData.session);
      } catch (err) {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : "Unknown error");
        setStatus("error");
      }
    }
    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        clearClaims();
        setStatus("ready");
        return;
      }
      if (session) {
        loadFromSession(session);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [reloadToken]);

  useEffect(() => {
    if (!accessToken) return;

    let cancelled = false;

    const intervalId = setInterval(async () => {
      try {
        const staffToken = await fetchStaffToken(accessToken);
        const decoded = decodeStaffTokenClaims(staffToken);
        if (cancelled) return;
        setClaims(decoded);
        setPlatformOwner(decoded.platformOwner);
      } catch (err) {
        console.error("Failed to refresh staff claims", err);
      }
    }, CLAIMS_REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [accessToken]);

  useEffect(() => {
    function handleClickOutside() {
      setUserDropdownOpen(false);
    }
    if (userDropdownOpen) {
      window.addEventListener("click", handleClickOutside);
      return () => window.removeEventListener("click", handleClickOutside);
    }
  }, [userDropdownOpen]);

  function handleSelectOrg(orgId: string) {
    setSelectedOrgId(orgId);
    writeStoredOrgId(orgId);
  }

  async function handleSignOut() {
    const supabase = getBrowserSupabaseClient();
    await supabase.auth.signOut();
    resetShellState();
    router.push("/login");
    router.refresh();
  }

  function handleRetry() {
    setLoadError(null);
    setStatus("loading");
    setReloadToken((t) => t + 1);
  }

  const orgTier = selectedOrgId ? orgTiers[selectedOrgId] ?? null : null;
  const isOrgAdminOrAbove = orgTier === "admin" || orgTier === "super_admin" || platformOwner;
  const moduleLinks = selectedOrgId
    ? MODULE_REGISTRY.filter((m) => claims?.moduleAccess.some((a) => a.organizationId === selectedOrgId && a.module === m.key))
    : [];

  const initials = fullName
    ? fullName
        .split(" ")
        .map((p) => p[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "SM";

  const isAuthPage = pathname === "/login" || pathname === "/set-password";

  if (isAuthPage) {
    return (
      <ShellContext.Provider value={{ selectedOrgId, staffClaims: claims, orgTier, isOrgAdminOrAbove, accessToken }}>
        <ToastProvider>{children}</ToastProvider>
      </ShellContext.Provider>
    );
  }

  return (
    <ShellContext.Provider value={{ selectedOrgId, staffClaims: claims, orgTier, isOrgAdminOrAbove, accessToken }}>
      <ToastProvider>
        <div className="app-shell">
          <div
            className={`sidebar-backdrop ${mobileSidebarOpen ? "open" : ""}`}
            onClick={() => setMobileSidebarOpen(false)}
          />

          {/* Left Collapsible Sidebar */}
          <aside className={`app-sidebar ${sidebarCollapsed ? "collapsed" : ""} ${mobileSidebarOpen ? "open" : ""}`}>
            <div>
              <div className="sidebar-header">
                <div
                  className="sidebar-brand-left"
                  onClick={() => {
                    router.push("/modules/youth-republic/dashboard");
                    setMobileSidebarOpen(false);
                  }}
                >
                  <div className="sidebar-logo-btn">
                    <span className="w-6 h-6 rounded bg-[var(--brand)] text-[var(--on-brand)] font-bold text-xs flex items-center justify-center tracking-tighter">
                      YR
                    </span>
                  </div>
                  <span className="sidebar-title">Youth Republic</span>
                </div>
                <button
                  type="button"
                  className="sidebar-toggle-btn"
                  onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                  title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                  aria-label="Toggle Sidebar"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className={`transition-transform duration-200 ${sidebarCollapsed ? "rotate-180" : ""}`}
                  >
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>
              </div>

              <nav className="sidebar-nav">
                <div className="nav-group-label">Core Operations</div>

                <Link
                  href="/modules/youth-republic/dashboard"
                  aria-label="Dashboard"
                  className={`sidebar-nav-item ${pathname?.includes("/dashboard") ? "active" : ""}`}
                  onClick={() => setMobileSidebarOpen(false)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="icon-svg flex-shrink-0" aria-hidden="true">
                    <rect x="3" y="3" width="7" height="7" />
                    <rect x="14" y="3" width="7" height="7" />
                    <rect x="14" y="14" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" />
                  </svg>
                  <span className="nav-label">Dashboard</span>
                </Link>

                <Link
                  href="/modules/youth-republic/opportunities"
                  aria-label="Opportunities"
                  className={`sidebar-nav-item ${pathname?.includes("/opportunities") ? "active" : ""}`}
                  onClick={() => setMobileSidebarOpen(false)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="icon-svg flex-shrink-0" aria-hidden="true">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                  </svg>
                  <span className="nav-label">Opportunities</span>
                </Link>

                <Link
                  href="/modules/youth-republic/applications"
                  aria-label="Applications"
                  className={`sidebar-nav-item ${pathname?.includes("/applications") ? "active" : ""}`}
                  onClick={() => setMobileSidebarOpen(false)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="icon-svg flex-shrink-0" aria-hidden="true">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  <span className="nav-label">Applications</span>
                </Link>

                <Link
                  href="/modules/youth-republic/hours"
                  aria-label="Hours"
                  className={`sidebar-nav-item ${pathname?.includes("/hours") ? "active" : ""}`}
                  onClick={() => setMobileSidebarOpen(false)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="icon-svg flex-shrink-0" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  <span className="nav-label">Hours</span>
                </Link>

                <Link
                  href="/modules/youth-republic/volunteers"
                  aria-label="Volunteers"
                  className={`sidebar-nav-item ${pathname?.includes("/volunteers") ? "active" : ""}`}
                  onClick={() => setMobileSidebarOpen(false)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="icon-svg flex-shrink-0" aria-hidden="true">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  <span className="nav-label">Volunteers</span>
                </Link>

                <div className="nav-group-label" style={{ marginTop: ".75rem" }}>Team & Access</div>

                {claims && isOrgAdminOrAbove && (
                  <>
                    <Link href="/team/members" aria-label="Team Members"
                      className={`sidebar-nav-item ${pathname === "/team/members" ? "active" : ""}`}
                      onClick={() => setMobileSidebarOpen(false)}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="icon-svg flex-shrink-0" aria-hidden="true">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                      <span className="nav-label">Team Members</span>
                      <span className="side-badge" aria-hidden="true" id="side-badge-team" />
                    </Link>
                    <Link href="/team/roles" aria-label="Roles & Permissions"
                      className={`sidebar-nav-item ${pathname === "/team/roles" ? "active" : ""}`}
                      onClick={() => setMobileSidebarOpen(false)}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="icon-svg flex-shrink-0" aria-hidden="true">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                      <span className="nav-label">Roles &amp; Permissions</span>
                    </Link>
                    <Link href="/team/audit" aria-label="Audit Log"
                      className={`sidebar-nav-item ${pathname === "/team/audit" ? "active" : ""}`}
                      onClick={() => setMobileSidebarOpen(false)}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="icon-svg flex-shrink-0" aria-hidden="true">
                        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                      </svg>
                      <span className="nav-label">Audit Log</span>
                    </Link>
                  </>
                )}

                {claims && platformOwner && (
                  <Link
                    href="/organizations"
                    aria-label="Organizations"
                    className={`sidebar-nav-item ${pathname === "/organizations" ? "active" : ""}`}
                    onClick={() => setMobileSidebarOpen(false)}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="icon-svg flex-shrink-0" aria-hidden="true">
                      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                    </svg>
                    <span className="nav-label">Organizations</span>
                  </Link>
                )}
              </nav>
            </div>

            <div className="sidebar-footer">
              <div className="sidebar-credit">
                <span className="sidebar-copy">Powered by ZahraOS</span>
                <span className="sidebar-project">A free software by The Mohsin Project</span>
              </div>
              <div className="sidebar-credit-collapsed">ZOS</div>
            </div>
          </aside>

          {/* App Main Layout Canvas */}
          <div className="app-main-layout">
            {/* Top Fixed Header */}
            <header className="admin-header">
              <div className="header-main">
                <div className="header-left">
                  <button
                    type="button"
                    className="mobile-menu-btn"
                    onClick={() => setMobileSidebarOpen(true)}
                    aria-label="Open navigation menu"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="3" y1="12" x2="21" y2="12" />
                      <line x1="3" y1="6" x2="21" y2="6" />
                      <line x1="3" y1="18" x2="21" y2="18" />
                    </svg>
                  </button>

                  <div className="brand-name-lockup" onClick={() => router.push("/modules/youth-republic/dashboard")}>
                    <span className="brand-title">Youth Republic</span>
                    <span className="brand-tagline">Volunteer Operations & Noticeboard</span>
                  </div>
                </div>

                <div className="header-actions">
                  {selectedOrgId && (
                    <OrgSwitcher
                      orgIds={availableOrgIds}
                      selectedOrgId={selectedOrgId}
                      orgNames={orgNames}
                      onSelect={handleSelectOrg}
                    />
                  )}

                  {/* Profile Pill */}
                  <div
                    className="user-pill"
                    onClick={(e) => {
                      e.stopPropagation();
                      setUserDropdownOpen(!userDropdownOpen);
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label="User Profile Menu"
                  >
                    <div className="avatar">{initials}</div>
                    <div className="user-text-info">
                      {fullName && <div style={{ fontWeight: 600, lineHeight: 1.1 }}>{fullName}</div>}
                      <div style={{ fontSize: "var(--text-2xs)", color: "var(--ink-2)" }}>
                        {platformOwner ? "Platform Owner" : orgTier ? orgTier.replace("_", " ").toUpperCase() : "Staff"}
                      </div>
                    </div>
                  </div>

                  {claims && (
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="btn btn-secondary btn-xs text-xs"
                      aria-label="Sign out"
                    >
                      Sign out
                    </button>
                  )}

                  {/* User Profile Dropdown Menu */}
                  {userDropdownOpen && (
                    <div
                      className="user-dropdown-menu open"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="user-dropdown-profile">
                        <div className="avatar-large">{initials}</div>
                        <div style={{ overflow: "hidden" }}>
                          <div style={{ fontWeight: 600, fontSize: "var(--text-base)", color: "var(--ink)", lineHeight: 1.2 }}>
                            {fullName ?? "Admin Staff"}
                          </div>
                          <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-2)", marginTop: "2px" }}>
                            {claims?.staffId ? `ID: ${claims.staffId.slice(0, 8)}` : "Verified Member"}
                          </div>
                          <div style={{ display: "flex", gap: ".35rem", marginTop: ".4rem", alignItems: "center" }}>
                            <span className="badge badge-pos" style={{ fontSize: "var(--text-2xs)", padding: ".1rem .35rem" }}>
                              {platformOwner ? "Platform Owner" : orgTier ? orgTier.replace("_", " ").toUpperCase() : "Active Staff"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="user-dropdown-items">
                        <button
                          type="button"
                          className="user-dropdown-item"
                          onClick={() => {
                            setUserDropdownOpen(false);
                            setPasswordModalOpen(true);
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: ".6rem" }}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                            </svg>
                            <span>Change Password</span>
                          </div>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--ink-3)" }}>
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        </button>

                        <div style={{ height: "1px", background: "var(--line-subtle)", margin: ".2rem 0" }} />

                        <button
                          type="button"
                          className="user-dropdown-item danger"
                          onClick={() => {
                            setUserDropdownOpen(false);
                            handleSignOut();
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: ".6rem" }}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                              <polyline points="16 17 21 12 16 7" />
                              <line x1="21" y1="12" x2="9" y2="12" />
                            </svg>
                            <span>Sign Out</span>
                          </div>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </header>

            {/* Main Application Container */}
            <main className="app-wrap">
              {status === "loading" && <p className="mb-4 text-sm text-gray-500">Loading your account…</p>}
              {status === "error" && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  <p className="font-semibold">We could not load your account. {loadError}</p>
                  <button type="button" onClick={handleRetry} className="mt-2 font-medium underline">
                    Retry
                  </button>
                </div>
              )}
              {children}
            </main>
          </div>
        </div>

        {/* Change Password Modal */}
        <ChangePasswordModal
          isOpen={passwordModalOpen}
          onClose={() => setPasswordModalOpen(false)}
        />
      </ToastProvider>
    </ShellContext.Provider>
  );
}

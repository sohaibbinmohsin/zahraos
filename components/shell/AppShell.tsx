"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { fetchStaffToken, decodeStaffTokenClaims, type StaffTokenClaims } from "@/lib/staffToken";
import { resolveOrgSwitcherOptions, pickInitialOrgId, readStoredOrgId, writeStoredOrgId } from "@/lib/selectedOrg";
import { MODULE_REGISTRY } from "@/registry/modules";
import { listApplications, listActivityHours } from "@/lib/youthRepublicFunctions";
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
  loading: boolean;
}

const ShellContext = createContext<ShellContextValue>({
  selectedOrgId: null,
  staffClaims: null,
  orgTier: null,
  isOrgAdminOrAbove: false,
  accessToken: null,
  loading: true,
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

export function useShellLoading() {
  return useContext(ShellContext).loading;
}

export function getRoleRank(roleName: string): number {
  const norm = roleName.trim().toLowerCase().replace(/[-_]/g, " ");
  if (norm === "platform owner") return 100;
  if (norm === "super admin") return 90;
  if (norm === "admin" || norm === "org admin" || norm === "organization admin") return 80;
  if (norm === "operations lead") return 70;
  if (norm === "drive coordinator") return 60;
  if (norm === "application reviewer") return 40;
  if (norm === "auditor") return 30;
  if (norm === "viewer") return 20;
  return 50;
}

export function formatRoleTitle(roleName: string): string {
  const norm = roleName.trim().replace(/[-_]/g, " ");
  return norm
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
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
  const [email, setEmail] = useState<string | null>(null);
  const [platformOwner, setPlatformOwner] = useState(false);
  const [claims, setClaims] = useState<StaffTokenClaims | null>(null);
  const [orgNames, setOrgNames] = useState<Record<string, string>>({});
  const [orgTiers, setOrgTiers] = useState<Record<string, string>>({});
  const [assignedRolesByOrg, setAssignedRolesByOrg] = useState<Record<string, string[]>>({});
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

  // Badge counts
  const [pendingApplicationsCount, setPendingApplicationsCount] = useState<number | null>(null);
  const [pendingHoursCount, setPendingHoursCount] = useState<number | null>(null);
  const [activeTeamCount, setActiveTeamCount] = useState<number | null>(null);

  function resetShellState() {
    setFullName(null);
    setEmail(null);
    setPlatformOwner(false);
    setClaims(null);
    setOrgNames({});
    setOrgTiers({});
    setAvailableOrgIds([]);
    setSelectedOrgId(null);
    setAccessToken(null);
    setUserDropdownOpen(false);
    setPendingApplicationsCount(null);
    setPendingHoursCount(null);
    setActiveTeamCount(null);
  }

  useEffect(() => {
    const supabase = getBrowserSupabaseClient();
    let cancelled = false;

    function clearClaims() {
      if (cancelled) return;
      resetShellState();
    }

    async function loadFromSession(session: { access_token: string; user?: { id?: string; email?: string } } | null) {
      if (!session) {
        clearClaims();
        if (!cancelled) setStatus("ready");
        return;
      }

      try {
        const authUserId = session.user?.id;
        const userEmail = session.user?.email ?? null;

        const staffToken = await fetchStaffToken(session.access_token);
        const decoded = decodeStaffTokenClaims(staffToken);
        if (cancelled) return;
        setClaims(decoded);
        setPlatformOwner(decoded.platformOwner);

        const { data: staffRow, error: staffError } = await supabase
          .from("staff")
          .select("full_name, platform_owner, email")
          .eq("auth_user_id", authUserId)
          .single();
        if (staffError) throw staffError;
        if (cancelled) return;
        if (staffRow) {
          setFullName(staffRow.full_name);
          setEmail(staffRow.email ?? userEmail);
        } else {
          setEmail(userEmail);
        }

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

        try {
          const { data: userAssignments } = await supabase
            .from("staff_role_assignments")
            .select("organization_id, roles(name)")
            .eq("staff_id", decoded.staffId);
          if (userAssignments && !cancelled) {
            const map: Record<string, string[]> = {};
            for (const a of userAssignments as any[]) {
              const rName = Array.isArray(a.roles) ? a.roles[0]?.name : a.roles?.name;
              if (rName && a.organization_id) {
                const list = map[a.organization_id] ?? [];
                if (!list.includes(rName)) list.push(rName);
                map[a.organization_id] = list;
              }
            }
            setAssignedRolesByOrg(map);
          }
        } catch {
          // Gracefully continue if role assignments join is not mock-configured
        }

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
    let cancelled = false;
    if (!selectedOrgId || !accessToken) {
      setPendingApplicationsCount(null);
      setPendingHoursCount(null);
      setActiveTeamCount(null);
      return;
    }

    async function loadBadges() {
      try {
        const staffToken = await fetchStaffToken(accessToken!);
        if (cancelled) return;

        const [appsRes, hoursRes] = await Promise.allSettled([
          listApplications({ organizationId: selectedOrgId!, limit: 100 }, staffToken),
          listActivityHours({ organizationId: selectedOrgId!, limit: 100 }, staffToken),
        ]);

        if (!cancelled) {
          if (appsRes.status === "fulfilled") {
            const count = appsRes.value.applications.filter(
              (a) => a.status === "submitted" || a.status === "under_review"
            ).length;
            setPendingApplicationsCount(count);
          }
          if (hoursRes.status === "fulfilled") {
            const count = hoursRes.value.activity.filter(
              (h) => h.verificationStatus === "pending"
            ).length;
            setPendingHoursCount(count);
          }
        }

        const supabase = getBrowserSupabaseClient();
        const { data: assignmentRows } = await supabase
          .from("staff_role_assignments")
          .select("staff_id")
          .eq("organization_id", selectedOrgId);

        if (cancelled) return;
        const staffIds = Array.from(
          new Set((assignmentRows ?? []).map((a: { staff_id: string }) => a.staff_id))
        );
        if (staffIds.length > 0) {
          const { data: staffRows } = await supabase
            .from("staff")
            .select("id")
            .in("id", staffIds)
            .eq("status", "active");
          if (!cancelled) {
            setActiveTeamCount((staffRows ?? []).length);
          }
        } else {
          if (!cancelled) {
            setActiveTeamCount(0);
          }
        }

        if (selectedOrgId && claims?.staffId) {
          try {
            const { data: userAssignments } = await supabase
              .from("staff_role_assignments")
              .select("organization_id, roles(name)")
              .eq("staff_id", claims.staffId);
            if (userAssignments && !cancelled) {
              const map: Record<string, string[]> = {};
              for (const a of userAssignments as any[]) {
                const rName = Array.isArray(a.roles) ? a.roles[0]?.name : a.roles?.name;
                if (rName && a.organization_id) {
                  const list = map[a.organization_id] ?? [];
                  if (!list.includes(rName)) list.push(rName);
                  map[a.organization_id] = list;
                }
              }
              setAssignedRolesByOrg((prev) => ({ ...prev, ...map }));
            }
          } catch {
            // Silently catch
          }
        }
      } catch {
        // Silently catch so shell loading is unaffected
      }
    }

    loadBadges();

    return () => {
      cancelled = true;
    };
  }, [selectedOrgId, accessToken, pathname]);

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

  const userRoles = useMemo(() => {
    const rawRoles: string[] = [];

    if (platformOwner) {
      rawRoles.push("Platform Owner");
    }

    if (orgTier === "super_admin") {
      rawRoles.push("Super Admin");
    } else if (orgTier === "admin") {
      rawRoles.push("Admin");
    }

    const assigned = (selectedOrgId ? assignedRolesByOrg[selectedOrgId] : []) ?? [];
    for (const r of assigned) {
      rawRoles.push(formatRoleTitle(r));
    }

    // If Super Admin is present, filter out generic "Admin"
    const hasSuperAdmin = rawRoles.some((r) => r.toLowerCase() === "super admin");
    const filtered = hasSuperAdmin ? rawRoles.filter((r) => r.toLowerCase() !== "admin") : rawRoles;

    const seen = new Set<string>();
    const uniqueRoles: string[] = [];
    for (const r of filtered) {
      const key = r.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        uniqueRoles.push(formatRoleTitle(r));
      }
    }

    uniqueRoles.sort((a, b) => getRoleRank(b) - getRoleRank(a));

    if (uniqueRoles.length === 0) {
      return ["Staff"];
    }
    return uniqueRoles;
  }, [platformOwner, orgTier, selectedOrgId, assignedRolesByOrg]);

  const primaryRole = userRoles[0];
  const isOrgAdminOrAbove =
    orgTier === "admin" ||
    orgTier === "super_admin" ||
    platformOwner ||
    userRoles.some((r) => ["super admin", "admin"].includes(r.toLowerCase()));
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
      <ShellContext.Provider value={{ selectedOrgId, staffClaims: claims, orgTier, isOrgAdminOrAbove, accessToken, loading: status === "loading" }}>
        <ToastProvider>{children}</ToastProvider>
      </ShellContext.Provider>
    );
  }

  return (
    <ShellContext.Provider value={{ selectedOrgId, staffClaims: claims, orgTier, isOrgAdminOrAbove, accessToken, loading: status === "loading" }}>
      <ToastProvider>
        <div className="app-shell">
          <div
            className={`sidebar-backdrop ${mobileSidebarOpen ? "open" : ""}`}
            onClick={() => setMobileSidebarOpen(false)}
          />

          {/* Left Collapsible Sidebar */}
          <aside
            className={`app-sidebar ${sidebarCollapsed ? "collapsed" : ""} ${mobileSidebarOpen ? "open" : ""}`}
            onClick={(e) => {
              if (sidebarCollapsed) {
                const target = e.target as HTMLElement;
                const clickedInteractive = target.closest("a, button, input, [role='button'], .sidebar-nav-item, .sidebar-toggle-btn, .sidebar-logo-btn");
                if (!clickedInteractive) {
                  setSidebarCollapsed(false);
                }
              }
            }}
          >
            <div>
              <div className="sidebar-header">
                <div
                  className="sidebar-brand-left"
                  onClick={() => {
                    if (sidebarCollapsed) {
                      setSidebarCollapsed(false);
                    } else {
                      router.push("/modules/youth-republic/dashboard");
                      setMobileSidebarOpen(false);
                    }
                  }}
                >
                  <button
                    type="button"
                    className="sidebar-logo-btn"
                    title={sidebarCollapsed ? "Expand Sidebar" : "Rizq"}
                    aria-label={sidebarCollapsed ? "Expand Sidebar" : "Rizq"}
                    onClick={(e) => {
                      if (sidebarCollapsed) {
                        e.stopPropagation();
                        setSidebarCollapsed(false);
                      }
                    }}
                  >
                    <img
                      src="/assets/rizq-symbol.png"
                      alt="Rizq Logo"
                      className="sidebar-logo-img"
                    />
                    <span className="collapsed-hover-icon" title="Expand Sidebar">
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <rect width="18" height="18" x="3" y="3" rx="3" />
                        <path d="M9 3v18" />
                      </svg>
                    </span>
                  </button>
                  <span className="sidebar-title">Rizq</span>
                </div>
                <button
                  type="button"
                  className="sidebar-toggle-btn"
                  onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                  title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                  aria-label="Toggle Sidebar"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <rect width="18" height="18" x="3" y="3" rx="3" />
                    <path d="M9 3v18" />
                  </svg>
                </button>
              </div>

              <nav className="sidebar-nav">
                <div className="nav-group-label">Youth Republic</div>

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
                  {pendingApplicationsCount !== null && pendingApplicationsCount > 0 && (
                    <span className="side-badge" id="side-badge-apps">{pendingApplicationsCount}</span>
                  )}
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
                  <span className="nav-label">Hours Verification</span>
                  {pendingHoursCount !== null && pendingHoursCount > 0 && (
                    <span className="side-badge" id="side-badge-hours">{pendingHoursCount}</span>
                  )}
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

                <div className="sidebar-module-divider" role="separator" aria-hidden="true" />
                <div className="nav-group-label" style={{ marginTop: ".75rem" }}>Team & Governance</div>

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
                      {activeTeamCount !== null && activeTeamCount > 0 && (
                        <span className="side-badge" id="side-badge-team">{activeTeamCount}</span>
                      )}
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
                    <div
                      className="sidebar-nav-item coming-soon-nav-item cursor-not-allowed opacity-65"
                      title="Data Controls (Coming Soon)"
                      aria-label="Data Controls"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="icon-svg flex-shrink-0" aria-hidden="true">
                        <ellipse cx="12" cy="5" rx="9" ry="3" />
                        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                      </svg>
                      <span className="nav-label">Data Controls</span>
                      <span className="coming-soon-badge">Coming Soon</span>
                    </div>
                  </>
                )}

                {claims && platformOwner && (
                  <>
                    <div className="sidebar-module-divider" role="separator" aria-hidden="true" />
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
                  </>
                )}
              </nav>
            </div>

            <div className="sidebar-footer">
              <div className="sidebar-credit">
                <div className="sidebar-copy">ZahraOS &copy; 2026</div>
                <div className="sidebar-project">
                  <span>A free software by The Mohsin Project</span>
                  <img
                    src="/assets/mohsin-project-white-bird.png"
                    alt="The Mohsin Project"
                    className="mohsin-white-bird-img"
                  />
                </div>
              </div>
              <div className="sidebar-credit-collapsed" title="Copyright ZahraOS · The Mohsin Project">
                ZOS &copy;
              </div>
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

                  <div
                    className="brand-name-lockup"
                    onClick={() => router.push(pathname?.startsWith("/team") ? "/team/members" : "/modules/youth-republic/dashboard")}
                  >
                    <span className="brand-title">
                      {pathname?.startsWith("/team") ? "Team & Governance" : "Youth Republic"}
                    </span>
                    <span className="brand-tagline">
                      {pathname?.startsWith("/team")
                        ? "Administrative Roles & Permissions Management"
                        : "Volunteer Operations & Noticeboard"}
                    </span>
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
                      <div style={{ fontSize: "var(--text-2xs)", color: "var(--ink-2)", fontWeight: 500 }}>
                        {primaryRole}
                      </div>
                    </div>
                  </div>

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
                          {email && (
                            <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-2)", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {email}
                            </div>
                          )}
                          <div style={{ display: "flex", flexWrap: "wrap", gap: ".35rem", marginTop: ".45rem", alignItems: "center" }}>
                            {userRoles.map((role) => (
                              <span
                                key={role}
                                className="badge badge-pos"
                                style={{
                                  fontSize: "var(--text-2xs)",
                                  padding: ".15rem .45rem",
                                  fontWeight: 500,
                                  textTransform: "none",
                                  letterSpacing: "normal",
                                }}
                              >
                                {role}
                              </span>
                            ))}
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

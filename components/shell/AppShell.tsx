"use client";

import { createContext, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { fetchStaffToken, decodeStaffTokenClaims, type StaffTokenClaims } from "@/lib/staffToken";
import { resolveOrgSwitcherOptions, pickInitialOrgId, readStoredOrgId, writeStoredOrgId } from "@/lib/selectedOrg";
import { MODULE_REGISTRY } from "@/registry/modules";
import { OrgSwitcher } from "./OrgSwitcher";

type ShellLoadStatus = "loading" | "ready" | "error";

// mintStaffToken sets a 1-hour expiry (exp: getNumericDate(60 * 60)) server-side.
// Refresh well inside that window so a long-lived session's claims never go
// stale in practice, even accounting for a slow network or a missed tick.
const CLAIMS_REFRESH_INTERVAL_MS = 45 * 60 * 1000;

interface ShellContextValue {
  selectedOrgId: string | null;
  staffClaims: StaffTokenClaims | null;
  orgTier: string | null;
}

const ShellContext = createContext<ShellContextValue>({ selectedOrgId: null, staffClaims: null, orgTier: null });

export function useSelectedOrg() {
  return useContext(ShellContext).selectedOrgId;
}

export function useStaffClaims() {
  return useContext(ShellContext).staffClaims;
}

export function useOrgTier() {
  return useContext(ShellContext).orgTier;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
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

  function resetShellState() {
    setFullName(null);
    setPlatformOwner(false);
    setClaims(null);
    setOrgNames({});
    setOrgTiers({});
    setAvailableOrgIds([]);
    setSelectedOrgId(null);
    setAccessToken(null);
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

        // A platform_owner's authority is the global flag, not a per-org
        // affiliation — mintStaffToken() never populates org_roles/
        // module_access from platform_owner alone, so the claims-derived
        // list would always be empty for them otherwise. They can manage
        // every organization, so fetch all of them directly instead.
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

  // Keep the Youth Republic staff JWT's claims from going stale for a long-lived session:
  // re-mint and re-decode it well before its 1-hour server-side expiry, for as
  // long as the shell stays mounted with a loaded session. Additive to the
  // load-on-mount/auth-state-change effect above — doesn't touch it.
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
        // A transient refresh failure shouldn't disrupt an already-loaded shell;
        // the previous claims simply remain in effect until the next tick.
        console.error("Failed to refresh staff claims", err);
      }
    }, CLAIMS_REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [accessToken]);

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
  // A platform_owner bypasses per-org tier checks entirely — same authority
  // as super_admin everywhere, without ever holding a staff_org_roles row.
  const isOrgAdminOrAbove = orgTier === "admin" || orgTier === "super_admin" || platformOwner;
  const moduleLinks = selectedOrgId
    ? MODULE_REGISTRY.filter((m) => claims?.moduleAccess.some((a) => a.organizationId === selectedOrgId && a.module === m.key))
    : [];

  return (
    <ShellContext.Provider value={{ selectedOrgId, staffClaims: claims, orgTier }}>
      <div className="min-h-screen">
        <header className="border-b border-gray-200">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <div className="flex items-center gap-4">
              <Link href="/" className="font-semibold">Admin Hub</Link>
              <nav className="flex gap-4 text-sm">
                {platformOwner && <Link href="/organizations">Organizations</Link>}
                {isOrgAdminOrAbove && <Link href="/staff">Staff</Link>}
                {isOrgAdminOrAbove && <Link href="/roles">Roles</Link>}
                {moduleLinks.map((m) => (
                  <Link key={m.key} href={m.route}>{m.navLabel}</Link>
                ))}
              </nav>
            </div>
            <div className="flex items-center gap-3 text-sm">
              {selectedOrgId && (
                <OrgSwitcher orgIds={availableOrgIds} selectedOrgId={selectedOrgId} orgNames={orgNames} onSelect={handleSelectOrg} />
              )}
              {fullName && <span>{fullName}</span>}
              {claims && (
                <button type="button" onClick={handleSignOut} className="text-sm underline">
                  Sign out
                </button>
              )}
            </div>
          </div>
        </header>
        <div className="mx-auto max-w-5xl px-4 py-6">
          {status === "loading" && <p className="mb-4 text-sm text-gray-500">Loading your account…</p>}
          {status === "error" && (
            <div className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
              <p>We could not load your account. {loadError}</p>
              <button type="button" onClick={handleRetry} className="mt-2 underline">
                Retry
              </button>
            </div>
          )}
          {children}
        </div>
      </div>
    </ShellContext.Provider>
  );
}

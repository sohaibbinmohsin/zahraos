"use client";

import { createContext, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { fetchStaffToken, decodeStaffTokenClaims, type StaffTokenClaims } from "@/lib/staffToken";
import { resolveOrgSwitcherOptions, pickInitialOrgId, readStoredOrgId, writeStoredOrgId } from "@/lib/selectedOrg";
import { MODULE_REGISTRY } from "@/registry/modules";
import { OrgSwitcher } from "./OrgSwitcher";

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
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);

  function resetShellState() {
    setFullName(null);
    setPlatformOwner(false);
    setClaims(null);
    setOrgNames({});
    setOrgTiers({});
    setSelectedOrgId(null);
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
        return;
      }

      const authUserId = session.user?.id;

      const staffToken = await fetchStaffToken(session.access_token);
      const decoded = decodeStaffTokenClaims(staffToken);
      if (cancelled) return;
      setClaims(decoded);
      setPlatformOwner(decoded.platformOwner);

      const { data: staffRow } = await supabase
        .from("staff")
        .select("full_name, platform_owner")
        .eq("auth_user_id", authUserId)
        .single();
      if (cancelled) return;
      if (staffRow) setFullName(staffRow.full_name);

      const { data: orgTierRows } = await supabase
        .from("staff_org_roles")
        .select("organization_id, org_tier")
        .eq("staff_id", decoded.staffId);
      if (cancelled) return;
      const tiersByOrg: Record<string, string> = {};
      for (const row of orgTierRows ?? []) {
        tiersByOrg[row.organization_id] = row.org_tier;
      }
      setOrgTiers(tiersByOrg);

      const availableOrgIds = resolveOrgSwitcherOptions(decoded.orgRoles, decoded.moduleAccess);
      const initialOrgId = pickInitialOrgId(availableOrgIds, readStoredOrgId());
      setSelectedOrgId(initialOrgId);

      if (availableOrgIds.length > 0) {
        const { data: organizations } = await supabase.from("organizations").select("id, name").in("id", availableOrgIds);
        if (cancelled) return;
        const names: Record<string, string> = {};
        for (const org of organizations ?? []) {
          names[org.id] = org.name;
        }
        setOrgNames(names);
      }
    }

    async function init() {
      const { data: sessionData } = await supabase.auth.getSession();
      if (cancelled) return;
      await loadFromSession(sessionData.session);
    }
    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        clearClaims();
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
  }, []);

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

  const availableOrgIds = claims ? resolveOrgSwitcherOptions(claims.orgRoles, claims.moduleAccess) : [];
  const orgTier = selectedOrgId ? orgTiers[selectedOrgId] ?? null : null;
  const isOrgAdminOrAbove = orgTier === "admin" || orgTier === "super_admin";
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
        <div className="mx-auto max-w-5xl px-4 py-6">{children}</div>
      </div>
    </ShellContext.Provider>
  );
}

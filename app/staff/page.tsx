"use client";

import { useCallback, useEffect, useState } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { useSelectedOrg } from "@/components/shell/AppShell";
import { StaffList, type StaffSummary } from "@/components/StaffList";
import { CreateStaffForm } from "@/components/CreateStaffForm";

export default function StaffPage() {
  const organizationId = useSelectedOrg();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [staff, setStaff] = useState<StaffSummary[]>([]);

  const load = useCallback(async () => {
    if (!organizationId) return;
    const supabase = getBrowserSupabaseClient();
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) return;
    setAccessToken(sessionData.session.access_token);

    const { data: orgTierRows } = await supabase
      .from("staff_org_roles")
      .select("staff_id, org_tier")
      .eq("organization_id", organizationId);
    const { data: moduleRoleRows } = await supabase
      .from("staff_module_roles")
      .select("staff_id")
      .eq("organization_id", organizationId);

    const tierByStaffId = new Map((orgTierRows ?? []).map((r) => [r.staff_id, r.org_tier as string]));
    const staffIds = new Set<string>([
      ...(orgTierRows ?? []).map((r) => r.staff_id),
      ...(moduleRoleRows ?? []).map((r) => r.staff_id),
    ]);
    if (staffIds.size === 0) {
      setStaff([]);
      return;
    }

    const { data: staffRows } = await supabase
      .from("staff")
      .select("id, full_name, email, status")
      .in("id", Array.from(staffIds));

    setStaff(
      (staffRows ?? []).map((row) => ({
        id: row.id,
        fullName: row.full_name,
        email: row.email,
        status: row.status,
        orgTier: tierByStaffId.get(row.id) ?? null,
      })),
    );
  }, [organizationId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!organizationId) {
    return <p>Select an organization to manage its staff.</p>;
  }

  if (!accessToken) {
    return <p>Loading…</p>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="mb-4 text-xl font-semibold">Staff</h1>
        <StaffList staff={staff} accessToken={accessToken} onDeactivated={load} />
      </div>
      <div>
        <h2 className="mb-2 text-lg font-medium">Create staff</h2>
        <CreateStaffForm organizationId={organizationId} accessToken={accessToken} onCreated={load} />
      </div>
    </div>
  );
}

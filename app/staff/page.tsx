"use client";

import { useCallback, useEffect, useState } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { useSelectedOrg } from "@/components/shell/AppShell";
import { StaffList, type StaffSummary } from "@/components/StaffList";
import { CreateStaffForm } from "@/components/CreateStaffForm";
import { AssignStaffOrgRoleForm } from "@/components/AssignStaffOrgRoleForm";

export default function StaffPage() {
  const organizationId = useSelectedOrg();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [staff, setStaff] = useState<StaffSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
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
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!organizationId) {
    return (
      <div className="panel p-8 text-center">
        <p className="text-[var(--ink-2)] font-medium">Select an organization to manage its staff members.</p>
      </div>
    );
  }

  if (!accessToken && loading) {
    return <p className="p-8 text-center text-[var(--ink-3)] font-medium">Loading staff directory…</p>;
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Staff &amp; Team Members</h1>
          <div className="page-subtitle">
            Manage organization members, assign role permissions, and control administrative access.
          </div>
        </div>
      </div>

      {/* Staff Table */}
      <StaffList staff={staff} accessToken={accessToken ?? ""} onDeactivated={load} />

      {/* 2-Column Grid for Create Staff & Assign Org Role */}
      <div className="panel-grid">
        <div className="panel p-5 space-y-3">
          <h2 className="panel-title">Create Staff Member</h2>
          <p className="text-xs text-[var(--ink-2)]">Add a new team member and generate their temporary password.</p>
          {accessToken && (
            <CreateStaffForm organizationId={organizationId} accessToken={accessToken} onCreated={load} />
          )}
        </div>

        <div className="panel p-5 space-y-3">
          <h2 className="panel-title">Assign Organization Role</h2>
          <p className="text-xs text-[var(--ink-2)]">Upgrade staff access permissions within this organization.</p>
          {staff.length === 0 ? (
            <p className="text-xs text-[var(--ink-3)]">No staff in this organization yet — create one first.</p>
          ) : (
            accessToken && (
              <AssignStaffOrgRoleForm
                organizationId={organizationId}
                staffOptions={staff.map((s) => ({ id: s.id, fullName: s.fullName }))}
                accessToken={accessToken}
                onAssigned={load}
              />
            )
          )}
        </div>
      </div>
    </div>
  );
}

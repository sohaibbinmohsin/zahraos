"use client";

import { useState } from "react";
import { assignStaffOrgRole } from "@/lib/platformFunctions";

export interface StaffOption {
  id: string;
  fullName: string;
}

export function AssignStaffOrgRoleForm({
  organizationId,
  staffOptions,
  accessToken,
  onAssigned,
}: {
  organizationId: string;
  staffOptions: StaffOption[];
  accessToken: string;
  onAssigned: () => void;
}) {
  const [staffId, setStaffId] = useState(staffOptions[0]?.id ?? "");
  const [orgTier, setOrgTier] = useState<"admin" | "super_admin">("admin");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await assignStaffOrgRole({ staffId, organizationId, orgTier }, accessToken);
      onAssigned();
    } catch (err) {
      setError(err instanceof Error ? err.message : "unknown_error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2">
      <div>
        <label htmlFor="orgRoleStaff" className="block text-sm">Staff member</label>
        <select id="orgRoleStaff" className="mt-1 rounded border px-3 py-2" value={staffId} onChange={(e) => setStaffId(e.target.value)}>
          {staffOptions.map((s) => (
            <option key={s.id} value={s.id}>{s.fullName}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="orgRoleTier" className="block text-sm">Org role</label>
        <select
          id="orgRoleTier"
          className="mt-1 rounded border px-3 py-2"
          value={orgTier}
          onChange={(e) => setOrgTier(e.target.value as "admin" | "super_admin")}
        >
          <option value="admin">Admin</option>
          <option value="super_admin">Super admin</option>
        </select>
      </div>
      <button type="submit" disabled={submitting || !staffId} className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-50">
        Assign org role
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}

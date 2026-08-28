"use client";

import { useState } from "react";
import { assignStaffModuleRole } from "@/lib/platformFunctions";

export interface StaffOption {
  id: string;
  fullName: string;
}
export interface ModuleOption {
  id: string;
  key: string;
}
export interface RoleOption {
  id: string;
  name: string;
}

export function AssignStaffModuleRoleForm({
  organizationId,
  staffOptions,
  moduleOptions,
  roleOptionsByModuleId,
  accessToken,
  onAssigned,
}: {
  organizationId: string;
  staffOptions: StaffOption[];
  moduleOptions: ModuleOption[];
  roleOptionsByModuleId: Record<string, RoleOption[]>;
  accessToken: string;
  onAssigned: () => void;
}) {
  const [staffId, setStaffId] = useState(staffOptions[0]?.id ?? "");
  const [moduleId, setModuleId] = useState(moduleOptions[0]?.id ?? "");
  const [roleId, setRoleId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const availableRoles = roleOptionsByModuleId[moduleId] ?? [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await assignStaffModuleRole({ staffId, organizationId, moduleId, roleId }, accessToken);
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
        <label htmlFor="assignStaff" className="block text-sm">Staff member</label>
        <select id="assignStaff" className="mt-1 rounded border px-3 py-2" value={staffId} onChange={(e) => setStaffId(e.target.value)}>
          {staffOptions.map((s) => (
            <option key={s.id} value={s.id}>{s.fullName}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="assignModule" className="block text-sm">Module</label>
        <select
          id="assignModule"
          className="mt-1 rounded border px-3 py-2"
          value={moduleId}
          onChange={(e) => { setModuleId(e.target.value); setRoleId(""); }}
        >
          {moduleOptions.map((m) => (
            <option key={m.id} value={m.id}>{m.key}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="assignRole" className="block text-sm">Role</label>
        <select id="assignRole" className="mt-1 rounded border px-3 py-2" value={roleId} onChange={(e) => setRoleId(e.target.value)}>
          <option value="">Select a role</option>
          {availableRoles.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      </div>
      <button type="submit" disabled={submitting || !roleId} className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-50">
        Assign role
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}

"use client";

import { useState } from "react";
import { createCustomRole } from "@/lib/platformFunctions";

export interface ModuleOption {
  id: string;
  key: string;
}
export interface PermissionOption {
  id: string;
  resource: string;
  action: string;
}

export function CreateCustomRoleForm({
  organizationId,
  modules,
  permissionsByModuleId,
  accessToken,
  onCreated,
}: {
  organizationId: string;
  modules: ModuleOption[];
  permissionsByModuleId: Record<string, PermissionOption[]>;
  accessToken: string;
  onCreated: () => void;
}) {
  const [moduleId, setModuleId] = useState(modules[0]?.id ?? "");
  const [name, setName] = useState("");
  const [checkedPermissionIds, setCheckedPermissionIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const availablePermissions = permissionsByModuleId[moduleId] ?? [];

  function togglePermission(permissionId: string) {
    setCheckedPermissionIds((prev) => {
      const next = new Set(prev);
      if (next.has(permissionId)) next.delete(permissionId);
      else next.add(permissionId);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await createCustomRole(
        { organizationId, moduleId, name, permissionIds: Array.from(checkedPermissionIds) },
        accessToken,
      );
      setName("");
      setCheckedPermissionIds(new Set());
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "unknown_error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label htmlFor="roleModule" className="block text-sm">Module</label>
        <select
          id="roleModule"
          className="mt-1 rounded border px-3 py-2"
          value={moduleId}
          onChange={(e) => { setModuleId(e.target.value); setCheckedPermissionIds(new Set()); }}
        >
          {modules.map((m) => (
            <option key={m.id} value={m.id}>{m.key}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="roleName" className="block text-sm">Role name</label>
        <input id="roleName" className="mt-1 w-full rounded border px-3 py-2" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <fieldset className="space-y-1">
        <legend className="text-sm">Permissions</legend>
        {availablePermissions.map((perm) => {
          const label = `${perm.resource}:${perm.action}`;
          return (
            <label key={perm.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                aria-label={label}
                checked={checkedPermissionIds.has(perm.id)}
                onChange={() => togglePermission(perm.id)}
              />
              {label}
            </label>
          );
        })}
      </fieldset>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={submitting} className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-50">
        Create role
      </button>
    </form>
  );
}

"use client";

import { useState } from "react";
import { createStaff, assignStaffOrgRole } from "@/lib/platformFunctions";

export function CreateStaffForm({
  organizationId,
  accessToken,
  onCreated,
}: {
  organizationId: string;
  accessToken: string;
  onCreated: () => void;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [orgTier, setOrgTier] = useState<"" | "admin" | "super_admin">("");
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await createStaff({ fullName, email, organizationId }, accessToken);
      // A brand-new staff row has no org_tier or module role yet, so it
      // wouldn't show up as an assignable option anywhere else in the UI —
      // granting the org role here, with the id createStaff just returned,
      // is what actually makes them reachable/usable afterward.
      if (orgTier !== "") {
        await assignStaffOrgRole({ staffId: result.staffId, organizationId, orgTier }, accessToken);
      }
      setTemporaryPassword(result.temporaryPassword);
      setFullName("");
      setEmail("");
      setOrgTier("");
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "unknown_error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-3">
      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        <div>
          <label htmlFor="staffFullName" className="block text-sm">Full name</label>
          <input id="staffFullName" className="mt-1 rounded border px-3 py-2" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div>
          <label htmlFor="staffEmail" className="block text-sm">Email</label>
          <input id="staffEmail" type="email" className="mt-1 rounded border px-3 py-2" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label htmlFor="staffOrgTier" className="block text-sm">Org role (optional)</label>
          <select
            id="staffOrgTier"
            className="mt-1 rounded border px-3 py-2"
            value={orgTier}
            onChange={(e) => setOrgTier(e.target.value as "" | "admin" | "super_admin")}
          >
            <option value="">None</option>
            <option value="admin">Admin</option>
            <option value="super_admin">Super admin</option>
          </select>
        </div>
        <button type="submit" disabled={submitting} className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-50">
          Create staff
        </button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {temporaryPassword && (
        <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">
          Temporary password (shown once, share it securely — it cannot be retrieved again): <code>{temporaryPassword}</code>
        </p>
      )}
    </div>
  );
}

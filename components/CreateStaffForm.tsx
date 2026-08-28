"use client";

import { useState } from "react";
import { createStaff } from "@/lib/platformFunctions";

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
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await createStaff({ fullName, email, organizationId }, accessToken);
      setTemporaryPassword(result.temporaryPassword);
      setFullName("");
      setEmail("");
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

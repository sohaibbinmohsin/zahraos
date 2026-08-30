"use client";

import { useState } from "react";
import { createOpportunity } from "@/lib/youthRepublicFunctions";

export function CreateOpportunityForm({
  organizationId,
  staffToken,
  onCreated,
}: {
  organizationId: string;
  staffToken: string;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState("environment");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await createOpportunity({ organizationId, name, type }, staffToken);
      setName("");
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "unknown_error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2">
      <div>
        <label htmlFor="oppName" className="block text-sm">Name</label>
        <input id="oppName" className="mt-1 rounded border px-3 py-2" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <label htmlFor="oppType" className="block text-sm">Type</label>
        <select id="oppType" className="mt-1 rounded border px-3 py-2" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="environment">Environment</option>
          <option value="health">Health</option>
          <option value="education">Education</option>
          <option value="community">Community</option>
        </select>
      </div>
      <button type="submit" disabled={submitting} className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-50">
        Create opportunity
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}

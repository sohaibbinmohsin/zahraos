"use client";

import { useState } from "react";
import { createOrganization } from "@/lib/platformFunctions";
import { LoadingButton } from "@/components/ui/LoadingButton";

function slugify(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function CreateOrganizationForm({ accessToken, onCreated }: { accessToken: string; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await createOrganization({ name, slug: slugify(name) }, accessToken);
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
      <div className="flex-1">
        <label htmlFor="orgName" className="block text-sm">Organization name</label>
        <input id="orgName" className="mt-1 w-full rounded border px-3 py-2" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <LoadingButton type="submit" loading={submitting} loadingText="Creating…" className="inline-flex items-center gap-2 rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-50">
        Create organization
      </LoadingButton>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}

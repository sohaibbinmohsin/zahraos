"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { fetchStaffToken } from "@/lib/staffToken";
import { listVolunteers, exportVmsCsv, type VolunteerSummary } from "@/lib/vmsFunctions";
import { useSelectedOrg } from "@/components/shell/AppShell";

export default function VmsVolunteersPage() {
  const organizationId = useSelectedOrg();
  const [volunteers, setVolunteers] = useState<VolunteerSummary[]>([]);
  const [search, setSearch] = useState("");
  const [staffToken, setStaffToken] = useState<string | null>(null);

  const load = useCallback(async (searchTerm: string) => {
    if (!organizationId) return;
    const supabase = getBrowserSupabaseClient();
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) return;
    const token = await fetchStaffToken(sessionData.session.access_token);
    setStaffToken(token);
    const result = await listVolunteers({ organizationId, search: searchTerm || undefined }, token);
    setVolunteers(result.volunteers);
  }, [organizationId]);

  useEffect(() => {
    load("");
  }, [load]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    await load(search);
  }

  async function handleExport() {
    if (!organizationId || !staffToken) return;
    const csv = await exportVmsCsv({ organizationId, entity: "volunteers" }, staffToken);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "volunteers.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!organizationId) return <p>Select an organization to see its volunteers.</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Volunteers</h1>
        <button type="button" onClick={handleExport} className="rounded border px-3 py-1.5 text-sm">
          Export CSV
        </button>
      </div>
      <form onSubmit={handleSearch} className="flex gap-2">
        <div>
          <label htmlFor="volunteerSearch" className="block text-sm">Search</label>
          <input id="volunteerSearch" className="mt-1 rounded border px-3 py-2" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button type="submit" className="mt-auto rounded bg-gray-900 px-4 py-2 text-white">Search</button>
      </form>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-gray-600">
              <th className="py-2 pr-4">Name</th>
              <th className="py-2 pr-4">City</th>
              <th className="py-2 pr-4">Institution</th>
              <th className="py-2 pr-4">Status</th>
            </tr>
          </thead>
          <tbody>
            {volunteers.map((v) => (
              <tr key={v.id} className="border-b border-gray-100">
                <td className="py-2 pr-4">
                  <Link href={`/modules/vms/volunteers/${v.id}`} className="underline">{v.fullName}</Link>
                </td>
                <td className="py-2 pr-4">{v.city}</td>
                <td className="py-2 pr-4">{v.institution}</td>
                <td className="py-2 pr-4">{v.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

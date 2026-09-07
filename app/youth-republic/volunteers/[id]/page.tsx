"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { fetchStaffToken } from "@/lib/staffToken";
import { getVolunteerDetail, type VolunteerDetail } from "@/lib/youthRepublicFunctions";
import { useSelectedOrg } from "@/components/shell/AppShell";
import { DetailSkeleton } from "@/components/ui/skeletons";

export default function YouthRepublicVolunteerDetailPage() {
  const organizationId = useSelectedOrg();
  const { id } = useParams<{ id: string }>();
  const [detail, setDetail] = useState<VolunteerDetail | null>(null);

  useEffect(() => {
    async function load() {
      if (!organizationId) return;
      const supabase = getBrowserSupabaseClient();
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return;
      const staffToken = await fetchStaffToken(sessionData.session.access_token);
      const result = await getVolunteerDetail({ organizationId, volunteerId: id }, staffToken);
      setDetail(result);
    }
    load();
  }, [organizationId, id]);

  if (!organizationId) return <p>Select an organization to see this volunteer.</p>;
  if (!detail) return <DetailSkeleton />;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">{detail.fullName}</h1>
        <p className="text-sm text-gray-600">{detail.email} · {detail.phone}</p>
        <p className="text-sm text-gray-600">{detail.city}, {detail.province} · {detail.institution}</p>
      </div>

      <div>
        <h2 className="mb-2 text-lg font-medium">Applications</h2>
        <ul className="space-y-2">
          {detail.applications.map((a) => (
            <li key={a.id} className="rounded border border-gray-200 p-3 text-sm">
              {a.opportunityName} — {a.status}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h2 className="mb-2 text-lg font-medium">Participations</h2>
        <ul className="space-y-2">
          {detail.participations.map((p) => (
            <li key={p.id} className="rounded border border-gray-200 p-3 text-sm">
              {p.opportunityName} — {p.status}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h2 className="mb-2 text-lg font-medium">Activity history</h2>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-gray-600">
              <th className="py-2 pr-4">Activity</th>
              <th className="py-2 pr-4">Role</th>
              <th className="py-2 pr-4">Date</th>
              <th className="py-2 pr-4">Hours</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4">Admin notes</th>
            </tr>
          </thead>
          <tbody>
            {detail.activity.map((a) => (
              <tr key={a.id} className="border-b border-gray-100">
                <td className="py-2 pr-4">{a.opportunityName}</td>
                <td className="py-2 pr-4">{a.role}</td>
                <td className="py-2 pr-4">{a.activityDate}</td>
                <td className="py-2 pr-4">{a.hoursVerified ?? a.hoursSubmitted}</td>
                <td className="py-2 pr-4">{a.verificationStatus}</td>
                <td className="py-2 pr-4">{a.adminNotes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

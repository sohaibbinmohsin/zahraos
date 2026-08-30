"use client";

import { useState } from "react";
import { bulkAssignHours } from "@/lib/vmsFunctions";

export interface ParticipantOption {
  participationId: string;
  volunteerName: string;
}

export function BulkAssignHoursForm({
  organizationId,
  opportunityId,
  participants,
  staffToken,
  onAssigned,
}: {
  organizationId: string;
  opportunityId: string;
  participants: ParticipantOption[];
  staffToken: string;
  onAssigned: () => void;
}) {
  const [activityDate, setActivityDate] = useState("");
  const [hours, setHours] = useState("");
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function toggle(participationId: string) {
    setCheckedIds((prev) =>
      prev.includes(participationId) ? prev.filter((id) => id !== participationId) : [...prev, participationId],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await bulkAssignHours(
        { organizationId, opportunityId, activityDate, hoursSubmitted: Number(hours), participationIds: checkedIds },
        staffToken,
      );
      setActivityDate("");
      setHours("");
      setCheckedIds([]);
      onAssigned();
    } catch (err) {
      setError(err instanceof Error ? err.message : "unknown_error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex items-end gap-2">
        <div>
          <label htmlFor="bulkActivityDate" className="block text-sm">Activity date</label>
          <input id="bulkActivityDate" type="date" className="mt-1 rounded border px-3 py-2" value={activityDate} onChange={(e) => setActivityDate(e.target.value)} />
        </div>
        <div>
          <label htmlFor="bulkHours" className="block text-sm">Hours</label>
          <input id="bulkHours" type="number" className="mt-1 w-24 rounded border px-3 py-2" value={hours} onChange={(e) => setHours(e.target.value)} />
        </div>
      </div>
      <fieldset>
        <legend className="text-sm">Participants</legend>
        {participants.map((p) => (
          <label key={p.participationId} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={checkedIds.includes(p.participationId)}
              onChange={() => toggle(p.participationId)}
            />
            {p.volunteerName}
          </label>
        ))}
      </fieldset>
      <button type="submit" disabled={submitting || checkedIds.length === 0} className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-50">
        Bulk-assign hours
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}

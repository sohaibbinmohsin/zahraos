"use client";

import { useState } from "react";
import { bulkAssignHours } from "@/lib/youthRepublicFunctions";
import { LoadingButton } from "@/components/ui/LoadingButton";

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
  onCancel,
}: {
  organizationId: string;
  opportunityId: string;
  participants: ParticipantOption[];
  staffToken: string;
  onAssigned: () => void;
  onCancel?: () => void;
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

  const allChecked = participants.length > 0 && checkedIds.length === participants.length;
  function toggleAll() {
    setCheckedIds(allChecked ? [] : participants.map((p) => p.participationId));
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

  const canSubmit = !submitting && checkedIds.length > 0 && activityDate !== "" && Number(hours) > 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="form-group">
          <label htmlFor="bulkActivityDate" className="form-label">Activity date</label>
          <input
            id="bulkActivityDate"
            type="date"
            className="form-input"
            value={activityDate}
            onChange={(e) => setActivityDate(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label htmlFor="bulkHours" className="form-label">Hours per volunteer</label>
          <input
            id="bulkHours"
            type="number"
            step="0.5"
            min="0.5"
            className="form-input"
            placeholder="e.g. 4"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
          />
        </div>
      </div>

      <div className="form-group">
        <div className="flex items-center justify-between">
          <label className="form-label mb-0">Participants ({participants.length})</label>
          {participants.length > 0 && (
            <button
              type="button"
              className="text-xs font-semibold text-[var(--ink-2)] hover:text-[var(--ink)]"
              onClick={toggleAll}
            >
              {allChecked ? "Clear all" : "Select all"}
            </button>
          )}
        </div>

        {participants.length === 0 ? (
          <p className="text-xs text-[var(--ink-2)] mt-1">
            No confirmed participants for this opportunity yet.
          </p>
        ) : (
          <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-[var(--line)] divide-y divide-[var(--line-subtle)]">
            {participants.map((p) => (
              <label
                key={p.participationId}
                className="flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer hover:bg-[var(--bg-page)]"
              >
                <input
                  type="checkbox"
                  checked={checkedIds.includes(p.participationId)}
                  onChange={() => toggle(p.participationId)}
                />
                <span className="font-medium text-[var(--ink)]">{p.volunteerName}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {error && (
        <p className="text-xs font-semibold text-red-600 bg-red-50 p-2.5 rounded border border-red-200">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-1">
        {onCancel && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
        )}
        <LoadingButton
          type="submit"
          className="btn btn-primary btn-sm"
          loading={submitting}
          loadingText="Assigning hours…"
          disabled={!canSubmit}
        >
          Assign hours to {checkedIds.length || ""} {checkedIds.length === 1 ? "volunteer" : "volunteers"}
        </LoadingButton>
      </div>
    </form>
  );
}

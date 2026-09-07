"use client";

import { useState } from "react";
import type { ApplicationListRow, DecideApplicationPayload } from "@/lib/youthRepublicFunctions";

type Decision = DecideApplicationPayload["decision"];

const PENDING_STATUSES = ["pending_review", "submitted", "under_review"];

const DECISION_META: Record<Decision, { label: string; loadingLabel: string; variant: string }> = {
  selected: { label: "Select", loadingLabel: "Selecting…", variant: "btn-primary" },
  waitlisted: { label: "Waitlist", loadingLabel: "Waitlisting…", variant: "btn-secondary" },
  rejected: { label: "Reject", loadingLabel: "Rejecting…", variant: "btn-danger" },
  pending_review: { label: "Reconsider", loadingLabel: "Moving to review…", variant: "btn-primary" },
};

interface ApplicationReviewDrawerProps {
  application: ApplicationListRow | null;
  isOpen: boolean;
  onClose: () => void;
  onDecide: (applicationId: string, decision: DecideApplicationPayload["decision"]) => Promise<void>;
}

export function ApplicationReviewDrawer({
  application,
  isOpen,
  onClose,
  onDecide,
}: ApplicationReviewDrawerProps) {
  const [pending, setPending] = useState<Decision | null>(null);
  // Local-only reveal of the decision buttons on an already-decided
  // application. Scoped to an application id so it clears itself when the
  // drawer opens for a different candidate.
  const [reconsideringFor, setReconsideringFor] = useState<string | null>(null);
  const submitting = pending !== null;

  if (!isOpen || !application) return null;

  const reconsidering = reconsideringFor === application.id;

  async function handleDecision(decision: Decision) {
    if (!application) return;
    setPending(decision);
    try {
      await onDecide(application.id, decision);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setPending(null);
    }
  }

  const isPending = PENDING_STATUSES.includes(application.status);

  const answersObj = (application.answers ?? {}) as Record<string, unknown>;
  const answerEntries = Object.entries(answersObj);

  return (
    <>
      <div className="drawer-backdrop open" onClick={onClose} />
      <div className="drawer open" role="dialog" aria-modal="true" aria-labelledby="review-drawer-title">
        {/* Drawer Header */}
        <div className="drawer-header">
          <div>
            <div id="review-drawer-title" className="drawer-title">
              Candidate Application Review
            </div>
            <div className="text-xs text-[var(--ink-2)] mt-0.5">
              Target Drive: <b className="text-[var(--ink)]">{application.opportunityName}</b>
            </div>
          </div>
          <button
            type="button"
            className="text-[var(--ink-2)] hover:text-[var(--ink)] cursor-pointer p-1"
            onClick={onClose}
            aria-label="Close drawer"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Drawer Body */}
        <div className="drawer-body">
          {/* Candidate Profile Summary Card */}
          <div className="p-4 rounded-xl bg-white border border-[var(--line)] shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-[var(--text-2xs)] font-bold text-[var(--ink-3)]">
                  Applicant Profile
                </span>
                <div className="text-lg font-bold text-[var(--ink)] mt-0.5">
                  {application.applicantName || application.volunteerName}
                </div>
                <div className="text-xs text-[var(--ink-2)] mt-0.5">
                  {application.applicantEmail && <span>{application.applicantEmail}</span>}
                  {application.applicantPhone && <span> · {application.applicantPhone}</span>}
                </div>
              </div>
              <span
                className={`badge ${
                  application.status === "selected"
                    ? "badge-pos"
                    : application.status === "waitlisted"
                    ? "badge-prog"
                    : application.status === "rejected"
                    ? "badge-neg"
                    : "badge-pend"
                }`}
              >
                {isPending ? "pending review" : application.status}
              </span>
            </div>

            <div className="mt-3 pt-3 border-t border-[var(--line-subtle)] flex flex-wrap gap-4 text-xs text-[var(--ink-2)]">
              <div>
                <span className="text-[var(--ink-3)] block text-[10px] font-semibold">Applied Timestamp</span>
                <span className="font-mono">
                  {new Date(application.appliedAt).toLocaleDateString("en-PK", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <div>
                <span className="text-[var(--ink-3)] block text-[10px] font-semibold">Security Clearance</span>
                <span className="font-semibold text-emerald-700">CNIC Verified</span>
              </div>
            </div>
          </div>

          {/* Submitted Q&A Responses */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-[var(--ink-2)]">
              Candidate Submitted Responses
            </div>

            {answerEntries.length > 0 ? (
              answerEntries.map(([questionKey, answerVal], idx) => {
                const formattedKey = questionKey.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
                const displayVal =
                  Array.isArray(answerVal)
                    ? answerVal.join(", ")
                    : typeof answerVal === "object" && answerVal !== null
                    ? JSON.stringify(answerVal)
                    : String(answerVal ?? "—");

                return (
                  <div key={idx} className="p-3.5 rounded-lg bg-white border border-[var(--line)] shadow-sm space-y-1">
                    <div className="text-xs font-semibold text-[var(--ink-3)]">
                      Q{idx + 1}: {formattedKey}
                    </div>
                    <div className="text-sm font-medium text-[var(--ink)] bg-[var(--bg-page)] p-2.5 rounded border border-[var(--line-subtle)]">
                      {displayVal}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-4 rounded-lg bg-white border border-[var(--line)] text-center text-xs text-[var(--ink-3)]">
                Standard volunteer application responses filed with profile.
              </div>
            )}

            {/* Document Attachments */}
            {application.attachmentIdsByField && Object.keys(application.attachmentIdsByField).length > 0 && (
              <div className="p-3.5 rounded-lg bg-white border border-[var(--line)] shadow-sm space-y-2">
                <div className="text-xs font-semibold text-[var(--ink-3)]">
                  Verified Attachments ({Object.keys(application.attachmentIdsByField).length})
                </div>
                <div className="space-y-1.5">
                  {Object.entries(application.attachmentIdsByField).map(([fieldName, fileIds], idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded bg-[var(--bg-page)] border border-[var(--line-subtle)] text-xs">
                      <span className="font-medium text-[var(--ink)]">📎 {fieldName.replace(/_/g, " ")}</span>
                      <span className="font-mono text-xs text-[var(--ink-3)]">{fileIds.length} document(s)</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Drawer Footer Decision Bar */}
        <div className="drawer-footer">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onClose}
            disabled={submitting}
          >
            Close
          </button>

          <div className="flex items-center gap-2">
            {isPending || reconsidering ? (
              <>
                {(["rejected", "waitlisted", "selected"] as const).map((decision) => {
                  const meta = DECISION_META[decision];
                  const loading = pending === decision;
                  return (
                    <button
                      key={decision}
                      type="button"
                      className={`btn ${meta.variant} btn-sm`}
                      onClick={() => handleDecision(decision)}
                      disabled={submitting}
                      aria-busy={loading || undefined}
                    >
                      {loading ? (
                        <>
                          <span className="btn-spinner" aria-hidden="true" />
                          {meta.loadingLabel}
                        </>
                      ) : (
                        meta.label
                      )}
                    </button>
                  );
                })}
                {reconsidering && !isPending && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setReconsideringFor(null)}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                )}
              </>
            ) : (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setReconsideringFor(application.id)}
              >
                Reconsider
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

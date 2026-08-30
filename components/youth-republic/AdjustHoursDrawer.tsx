"use client";

import { useState, useEffect } from "react";
import type { ActivityListRow, VerifyHoursPayload } from "@/lib/youthRepublicFunctions";

interface AdjustHoursDrawerProps {
  activityRow: ActivityListRow | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (payload: VerifyHoursPayload) => Promise<void>;
}

export function AdjustHoursDrawer({
  activityRow,
  isOpen,
  onClose,
  onSave,
}: AdjustHoursDrawerProps) {
  const [hoursAssigned, setHoursAssigned] = useState<number>(6.0);
  const [decision, setDecision] = useState<"verified" | "rejected">("verified");
  const [adminNotes, setAdminNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (activityRow) {
      setHoursAssigned(activityRow.hoursVerified ?? activityRow.hoursSubmitted ?? 6.0);
      setDecision(activityRow.verificationStatus === "rejected" ? "rejected" : "verified");
      setAdminNotes(activityRow.adminNotes ?? "");
    }
  }, [activityRow]);

  if (!isOpen || !activityRow) return null;

  const originalHours = activityRow.hoursSubmitted;
  const delta = Number((hoursAssigned - originalHours).toFixed(1));

  function stepHours(step: number) {
    setHoursAssigned((prev) => Math.max(0.5, Math.min(24, Number((prev + step).toFixed(1)))));
  }

  function setPreset(val: number) {
    if (val === 0.5) {
      setHoursAssigned(Number((originalHours * 0.5).toFixed(1)));
    } else if (val < 0) {
      setHoursAssigned(Math.max(0.5, Number((originalHours + val).toFixed(1))));
    } else {
      setHoursAssigned(val);
    }
  }

  async function handleConfirm() {
    if (!activityRow) return;
    setSubmitting(true);
    try {
      await onSave({
        activityHoursId: activityRow.id,
        decision,
        hoursVerified: decision === "verified" ? hoursAssigned : 0,
        adminNotes: adminNotes.trim() || undefined,
      });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="drawer-backdrop open" onClick={onClose} />
      <div className="drawer open" role="dialog" aria-modal="true" aria-labelledby="adjust-drawer-title">
        {/* Drawer Header */}
        <div className="drawer-header">
          <div>
            <div id="adjust-drawer-title" className="drawer-title">
              Adjust &amp; Accredit Volunteer Hours
            </div>
            <div className="text-xs text-[var(--ink-2)] mt-0.5">
              Shift ID: <span className="font-mono">{activityRow.id.slice(0, 8)}</span>
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
          {/* Volunteer & Shift Summary Card */}
          <div className="p-4 rounded-xl bg-white border border-[var(--line)] shadow-sm">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <span className="text-[var(--text-2xs)] font-bold uppercase tracking-wider text-[var(--ink-3)]">
                  Volunteer Information
                </span>
                <div className="text-lg font-bold text-[var(--ink)] mt-0.5">{activityRow.volunteerName}</div>
                <div className="text-xs font-mono text-[var(--ink-2)] mt-0.5">Role: {activityRow.role ?? "Drive Volunteer"}</div>
              </div>
              <div className="text-right">
                <span className="text-[var(--text-2xs)] font-bold uppercase tracking-wider text-[var(--ink-3)]">
                  Claimed Hours
                </span>
                <div className="font-mono text-xl font-bold text-[var(--ink)]">{originalHours.toFixed(1)} hrs</div>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-[var(--line-subtle)] grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[var(--ink-3)] block text-[10px] uppercase font-semibold">Opportunity / Drive</span>
                <span className="font-semibold text-[var(--ink)]">{activityRow.opportunityName}</span>
              </div>
              <div>
                <span className="text-[var(--ink-3)] block text-[10px] uppercase font-semibold">Shift Date</span>
                <span className="font-mono text-[var(--ink-2)]">{activityRow.activityDate}</span>
              </div>
            </div>
          </div>

          {/* Decision Mode Selection */}
          <div className="grid grid-cols-2 gap-3">
            <div
              className={`decision-mode-card ${decision === "verified" ? "active" : ""}`}
              onClick={() => setDecision("verified")}
            >
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full border border-emerald-600 bg-emerald-100 flex items-center justify-center">
                  {decision === "verified" && <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />}
                </span>
                <span className="font-bold text-xs uppercase text-emerald-900">Approve / Accredit</span>
              </div>
              <div className="text-[11px] text-[var(--ink-2)] mt-1">Issue official student service credit</div>
            </div>

            <div
              className={`decision-mode-card reject-mode ${decision === "rejected" ? "active" : ""}`}
              onClick={() => setDecision("rejected")}
            >
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full border border-red-600 bg-red-100 flex items-center justify-center">
                  {decision === "rejected" && <span className="w-1.5 h-1.5 rounded-full bg-red-600" />}
                </span>
                <span className="font-bold text-xs uppercase text-red-900">Reject Shift</span>
              </div>
              <div className="text-[11px] text-[var(--ink-2)] mt-1">Decline unverified attendance</div>
            </div>
          </div>

          {decision === "verified" && (
            <div className="p-4 rounded-xl bg-white border border-[var(--line)] shadow-sm space-y-3">
              <label className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]">
                  Admin Assigned Accredited Hours
                </span>
                <span className="text-xs text-[var(--ink-2)]">
                  Original: <b className="font-mono text-[var(--ink)]">{originalHours.toFixed(1)} hrs</b>
                </span>
              </label>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="btn btn-secondary text-lg font-bold px-4"
                  onClick={() => stepHours(-0.5)}
                >
                  −
                </button>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="24"
                  className="form-input text-center font-mono text-xl font-bold py-1.5"
                  value={hoursAssigned}
                  onChange={(e) => setHoursAssigned(Number(e.target.value))}
                />
                <button
                  type="button"
                  className="btn btn-secondary text-lg font-bold px-4"
                  onClick={() => stepHours(0.5)}
                >
                  +
                </button>
              </div>

              {/* Quick Deduction Presets */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                <button
                  type="button"
                  className="btn btn-secondary btn-xs"
                  onClick={() => setPreset(0.5)}
                >
                  50% Half Shift
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-xs"
                  onClick={() => setPreset(-1)}
                >
                  −1.0 Hour
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-xs"
                  onClick={() => setPreset(-2)}
                >
                  −2.0 Hours
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-xs"
                  onClick={() => setHoursAssigned(originalHours)}
                >
                  Reset Claim
                </button>
              </div>

              {/* Deduction Delta Alert */}
              {delta !== 0 && (
                <div className={`p-2.5 rounded-lg text-xs font-medium flex items-center justify-between ${
                  delta < 0 ? "bg-amber-50 border border-amber-200 text-amber-900" : "bg-blue-50 border border-blue-200 text-blue-900"
                }`}>
                  <span>{delta < 0 ? "⚠️ Deduction Applied:" : "ℹ️ Bonus Hours Added:"}</span>
                  <span className="font-mono font-bold">{delta > 0 ? `+${delta}` : delta} Hours</span>
                </div>
              )}
            </div>
          )}

          {/* Admin Note & Preset Chips */}
          <div className="p-4 rounded-xl bg-white border border-[var(--line)] shadow-sm space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]">
              Admin Verification Justification &amp; Notes
            </div>

            <div className="flex flex-wrap gap-1.5">
              {[
                "Supervisor verified headcount on site",
                "Break time deduction (-0.5h)",
                "Late arrival / Early departure",
                "Full shift completed with exemplary conduct",
              ].map((chip, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="reason-chip text-xs"
                  onClick={() => setAdminNotes((prev) => (prev ? `${prev} · ${chip}` : chip))}
                >
                  + {chip}
                </button>
              ))}
            </div>

            <textarea
              rows={3}
              className="form-textarea text-xs"
              placeholder="Enter administrative accreditation notes (recorded in volunteer ledger)..."
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
            />
          </div>
        </div>

        {/* Drawer Footer */}
        <div className="drawer-footer">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>

          <button
            type="button"
            className={`btn btn-sm ${decision === "verified" ? "btn-primary" : "btn-danger"}`}
            onClick={handleConfirm}
            disabled={submitting}
          >
            {submitting
              ? "Recording..."
              : decision === "verified"
              ? "Approve & Accredit Hours"
              : "Reject Shift"}
          </button>
        </div>
      </div>
    </>
  );
}

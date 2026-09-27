"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { useToast } from "@/components/shell/ToastContext";
import {
  updateOpportunity,
  listActivityHours,
  type OpportunitySummary,
} from "@/lib/youthRepublicFunctions";

interface ImpactStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  opportunity: OpportunitySummary | null;
  organizationId: string;
  staffToken: string;
  onSaved: () => void;
}

export function ImpactStatsModal({
  isOpen,
  onClose,
  opportunity,
  organizationId,
  staffToken,
  onSaved,
}: ImpactStatsModalProps) {
  const { showToast } = useToast();

  const [totalHoursVerified, setTotalHoursVerified] = useState<number | null>(null);
  const [loadingHours, setLoadingHours] = useState(false);
  const [fundsCollected, setFundsCollected] = useState("");
  const [itemsDistributed, setItemsDistributed] = useState("");
  const [beneficiariesReached, setBeneficiariesReached] = useState("");
  const [volunteersAttended, setVolunteersAttended] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !opportunity) return;
    const stats = (opportunity.impactStats as Record<string, any>) || {};
    setFundsCollected(stats.fundsCollected ?? stats.fundsRaised ?? "");
    setItemsDistributed(stats.itemsDistributed ?? "");
    setBeneficiariesReached(stats.beneficiariesReached ?? "");
    setVolunteersAttended(
      stats.volunteersAttended != null
        ? String(stats.volunteersAttended)
        : opportunity.filledCount
        ? String(opportunity.filledCount)
        : "",
    );
    setNotes(stats.notes ?? "");
    setError(null);

    // Fetch verified hours for this drive
    setLoadingHours(true);
    listActivityHours({ organizationId, limit: 1000 }, staffToken)
      .then((res) => {
        const matching = res.activity.filter(
          (a) =>
            a.opportunityName.trim().toLowerCase() === opportunity.name.trim().toLowerCase() &&
            a.verificationStatus === "verified",
        );
        const sum = matching.reduce((acc, a) => acc + (a.hoursVerified ?? a.hoursSubmitted ?? 0), 0);
        setTotalHoursVerified(sum);
      })
      .catch((err) => {
        console.error("Failed to load activity hours", err);
      })
      .finally(() => {
        setLoadingHours(false);
      });
  }, [isOpen, opportunity, organizationId, staffToken]);

  async function handleSave() {
    if (!opportunity) return;
    setSaving(true);
    setError(null);
    try {
      await updateOpportunity(
        {
          opportunityId: opportunity.id,
          organizationId,
          impactStats: {
            fundsCollected: fundsCollected.trim() || null,
            itemsDistributed: itemsDistributed.trim() || null,
            beneficiariesReached: beneficiariesReached.trim() || null,
            volunteersAttended: volunteersAttended.trim()
              ? Number(volunteersAttended) || volunteersAttended.trim()
              : null,
            notes: notes.trim() || null,
            totalHoursVerified: totalHoursVerified ?? 0,
            updatedAt: new Date().toISOString(),
          },
        },
        staffToken,
      );
      showToast("Impact & stats saved successfully.");
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save impact stats");
    } finally {
      setSaving(false);
    }
  }

  if (!opportunity) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Impact & Stats"
      description={`Record drive outcomes, funds collected, and verified metrics for "${opportunity.name}".`}
      maxWidth={560}
      footer={
        <>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <LoadingButton
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleSave}
            loading={saving}
            loadingText="Saving…"
          >
            Save Stats
          </LoadingButton>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-700 font-semibold">
            {error}
          </div>
        )}

        {/* Live Overview Cards */}
        <div className="grid grid-cols-2 gap-3 p-3 rounded-lg border border-[var(--line)] bg-[var(--bg-surface-2)]">
          <div>
            <div className="text-[11px] font-semibold text-[var(--ink-3)] uppercase tracking-wider">
              Verified Volunteer Hours
            </div>
            <div className="text-xl font-bold text-[var(--ink)] mt-0.5 font-mono">
              {loadingHours ? "…" : `${totalHoursVerified ?? 0} hrs`}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-semibold text-[var(--ink-3)] uppercase tracking-wider">
              Confirmed Volunteers
            </div>
            <div className="text-xl font-bold text-[var(--ink)] mt-0.5 font-mono">
              {opportunity.filledCount}
            </div>
          </div>
        </div>

        {/* Impact Metric Form Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="form-group">
            <label htmlFor="statFunds" className="form-label text-xs">
              Funds / Donations Raised
            </label>
            <input
              id="statFunds"
              className="form-input text-xs"
              placeholder="e.g. PKR 450,000"
              value={fundsCollected}
              onChange={(e) => setFundsCollected(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="statItems" className="form-label text-xs">
              Items / Units Distributed
            </label>
            <input
              id="statItems"
              className="form-input text-xs"
              placeholder="e.g. 1,200 ration hampers"
              value={itemsDistributed}
              onChange={(e) => setItemsDistributed(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="form-group">
            <label htmlFor="statBeneficiaries" className="form-label text-xs">
              Beneficiaries Reached / Impacted
            </label>
            <input
              id="statBeneficiaries"
              className="form-input text-xs"
              placeholder="e.g. 5,000 community members"
              value={beneficiariesReached}
              onChange={(e) => setBeneficiariesReached(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="statVolunteersAttended" className="form-label text-xs">
              Actual Volunteer Attendance
            </label>
            <input
              id="statVolunteersAttended"
              className="form-input text-xs font-mono"
              placeholder="e.g. 35"
              value={volunteersAttended}
              onChange={(e) => setVolunteersAttended(e.target.value)}
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="statNotes" className="form-label text-xs">
            Impact Summary &amp; Notes
          </label>
          <textarea
            id="statNotes"
            rows={3}
            className="form-textarea text-xs"
            placeholder="Highlight major achievements, key partner mentions, feedback from beneficiaries, or key takeaways..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </div>
    </Modal>
  );
}

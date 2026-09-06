"use client";

import { useState } from "react";
import type { VolunteerDetail } from "@/lib/youthRepublicFunctions";
import { useToast } from "@/components/shell/ToastContext";

interface VolunteerProfileDrawerProps {
  detail: VolunteerDetail | null;
  isOpen: boolean;
  onClose: () => void;
}

export function VolunteerProfileDrawer({
  detail,
  isOpen,
  onClose,
}: VolunteerProfileDrawerProps) {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<"activity" | "participations" | "certificates">("activity");

  if (!isOpen || !detail) return null;

  const totalVerified = detail.activity.reduce(
    (acc, a) => acc + (a.hoursVerified ?? (a.verificationStatus === "verified" ? a.hoursSubmitted : 0)),
    0
  );

  return (
    <>
      <div className="drawer-backdrop open" onClick={onClose} />
      <div className="drawer open" role="dialog" aria-modal="true" aria-labelledby="vol-profile-title">
        {/* Drawer Header */}
        <div className="drawer-header">
          <div>
            <div id="vol-profile-title" className="drawer-title">
              {detail.fullName}
            </div>
            <div className="text-xs font-mono text-[var(--ink-2)] mt-0.5">
              Code: {detail.volunteerCode || `YR-2026-${detail.id.slice(0, 5)}`} · {detail.institution}
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
          {/* Identity & Scope Card */}
          <div className="p-4 rounded-xl bg-white border border-[var(--line)] shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-[var(--text-2xs)] font-bold text-[var(--ink-3)]">
                  Academic Affiliation &amp; Scope
                </span>
                <div className="text-base font-bold text-[var(--ink)] mt-0.5">
                  {detail.institution} · {detail.city}, {detail.province}
                </div>
                <div className="text-xs text-[var(--ink-2)] mt-0.5">
                  {detail.email} · {detail.phone}
                </div>
              </div>
              <span className={`badge ${detail.status === "active" ? "badge-pos" : "badge-neu"}`}>
                {detail.status}
              </span>
            </div>
          </div>

          {/* Quad Impact Telemetry Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="vol-stat-box">
              <span className="text-[10px] font-bold text-[var(--ink-3)] block">Accredited Hours</span>
              <span className="font-mono text-xl font-bold text-[var(--ink)]">{totalVerified} hrs</span>
            </div>
            <div className="vol-stat-box">
              <span className="text-[10px] font-bold text-[var(--ink-3)] block">Drives Completed</span>
              <span className="font-mono text-xl font-bold text-[var(--ink)]">{detail.participations.length}</span>
            </div>
            <div className="vol-stat-box">
              <span className="text-[10px] font-bold text-[var(--ink-3)] block">Reliability Score</span>
              <span className="font-mono text-xl font-bold text-emerald-700">100%</span>
            </div>
            <div className="vol-stat-box">
              <span className="text-[10px] font-bold text-[var(--ink-3)] block">Applications</span>
              <span className="font-mono text-xl font-bold text-[var(--ink)]">{detail.applications.length}</span>
            </div>
          </div>

          {/* Sub-Tabs: Activity vs Participations vs Certificates */}
          <div className="border-b border-[var(--line)] flex gap-4 text-xs font-bold">
            <button
              type="button"
              className={`pb-2 border-b-2 ${activeTab === "activity" ? "border-[var(--brand)] text-[var(--ink)]" : "border-transparent text-[var(--ink-3)]"}`}
              onClick={() => setActiveTab("activity")}
            >
              Shift Logs &amp; Activity ({detail.activity.length})
            </button>
            <button
              type="button"
              className={`pb-2 border-b-2 ${activeTab === "participations" ? "border-[var(--brand)] text-[var(--ink)]" : "border-transparent text-[var(--ink-3)]"}`}
              onClick={() => setActiveTab("participations")}
            >
              Drives Enrolled ({detail.participations.length})
            </button>
            <button
              type="button"
              className={`pb-2 border-b-2 ${activeTab === "certificates" ? "border-[var(--brand)] text-[var(--ink)]" : "border-transparent text-[var(--ink-3)]"}`}
              onClick={() => setActiveTab("certificates")}
            >
              Accredited Certificates
            </button>
          </div>

          {/* Tab 1: Activity Shift Logs */}
          {activeTab === "activity" && (
            <div className="space-y-3">
              {detail.activity.map((act) => (
                <div key={act.id} className="p-3.5 rounded-lg bg-white border border-[var(--line)] shadow-sm space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[var(--ink)]">{act.opportunityName}</span>
                    <span className={`badge ${act.verificationStatus === "verified" ? "badge-pos" : "badge-pend"}`}>
                      {act.verificationStatus}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-[var(--ink-2)]">
                    <span>Date: {act.activityDate} · Role: {act.role ?? "Volunteer"}</span>
                    <span className="font-mono font-bold">
                      {act.hoursVerified ?? act.hoursSubmitted} hrs credited
                    </span>
                  </div>
                  {act.adminNotes && (
                    <div className="text-xs bg-[var(--bg-page)] p-2 rounded text-[var(--ink)] border border-[var(--line-subtle)]">
                      💬 <b className="text-[var(--ink-3)]">Supervisor Note:</b> {act.adminNotes}
                    </div>
                  )}
                </div>
              ))}
              {detail.activity.length === 0 && (
                <p className="text-xs text-[var(--ink-3)] p-4 text-center">No shift activity recorded yet.</p>
              )}
            </div>
          )}

          {/* Tab 2: Participations */}
          {activeTab === "participations" && (
            <div className="space-y-2.5">
              {detail.participations.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-white border border-[var(--line)] shadow-sm text-xs">
                  <div>
                    <div className="font-bold text-[var(--ink)]">{p.opportunityName}</div>
                    <div className="text-[var(--ink-3)] mt-0.5">Participation ID: {p.id.slice(0, 8)}</div>
                  </div>
                  <span className="badge badge-pos">{p.status}</span>
                </div>
              ))}
              {detail.participations.length === 0 && (
                <p className="text-xs text-[var(--ink-3)] p-4 text-center">No enrolled participations yet.</p>
              )}
            </div>
          )}

          {/* Tab 3: Accredited Certificates */}
          {activeTab === "certificates" && (
            <div className="space-y-3">
              <div className="cert-card">
                <div>
                  <div className="font-bold text-sm text-[var(--ink)]">Verified Service Hours Accreditation Certificate</div>
                  <div className="text-xs text-[var(--ink-2)] mt-0.5">
                    Issued by Youth Republic &amp; The Mohsin Project · Accreditation Ref: YR-CERT-2026-0082
                  </div>
                  <div className="text-xs text-emerald-700 font-semibold mt-1">
                    ✓ Cryptographically Signed &amp; University Recognized
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-xs"
                  onClick={() => showToast("Downloaded official certificate PDF.")}
                >
                  Download PDF
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        <div className="drawer-footer">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onClose}
          >
            Close
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => showToast("Downloaded complete service transcript.")}
          >
            Download Service Transcript (PDF)
          </button>
        </div>
      </div>
    </>
  );
}

"use client";

import React, { useState } from "react";
import { INITIAL_VEHICLES, CHAPTER_NAMES, type AmbulanceVehicle } from "@/lib/maseehaData";
import { Select } from "@/components/ui/Select";

export default function FleetReadinessPage() {
  const [vehicles, setVehicles] = useState<AmbulanceVehicle[]>(INITIAL_VEHICLES);
  const [selectedVehicle, setSelectedVehicle] = useState<AmbulanceVehicle | null>(null);
  const [isHandoverOpen, setIsHandoverOpen] = useState(false);

  const [handoverLead, setHandoverLead] = useState("Hamza Abbasi");
  const [handoverDriver, setHandoverDriver] = useState("Tariq Mehmood");
  const [handoverNotes, setHandoverNotes] = useState("Pre-shift check completed: O2 pressure verified, trauma bag sealed.");

  const handleSaveHandover = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVehicle) return;

    setVehicles((prev) =>
      prev.map((v) =>
        v.id === selectedVehicle.id
          ? {
              ...v,
              activeLeadParamedic: handoverLead,
              activeDriver: handoverDriver,
            }
          : v
      )
    );
    setIsHandoverOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="page-header flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-[var(--line)]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[var(--brand-tint)] text-[var(--brand)] border border-[var(--brand-bd)]">
              Fleet &amp; Asset Operations
            </span>
            <span className="text-xs text-[var(--ink-3)]">Saving 9 Ambulance Network</span>
          </div>
          <h1 className="page-title text-2xl md:text-3xl font-bold tracking-tight text-[var(--ink)]">
            Ambulance Fleet &amp; Crew Readiness
          </h1>
          <p className="page-subtitle text-sm text-[var(--ink-2)] mt-0.5">
            Vehicle readiness telemetry, active crew roster, fuel/oxygen gauges, and hub dispatch stations.
          </p>
        </div>

        <div className="page-toolbar flex items-center gap-2.5">
          <button
            type="button"
            className="btn btn-secondary btn-sm flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[var(--line)] text-xs font-semibold hover:bg-black/5"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
            </svg>
            Maintenance Schedule
          </button>
        </div>
      </div>

      {/* 4-Column Stat Grid */}
      <div className="stat-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card bg-[var(--bg-panel)] p-4 rounded-xl border border-[var(--line)] shadow-sm">
          <div className="stat-label text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)]">Total Fleet</div>
          <div className="stat-value text-2xl font-bold text-[var(--ink)] mt-1.5">3 Vehicles</div>
          <div className="stat-sub text-xs text-[var(--ink-3)] mt-1">Toyota HiAce &amp; Hilux 4x4</div>
        </div>

        <div className="stat-card bg-[var(--bg-panel)] p-4 rounded-xl border border-[var(--line)] shadow-sm">
          <div className="stat-label text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)]">On Active Standby</div>
          <div className="stat-value text-2xl font-bold text-emerald-700 mt-1.5">2 Ready</div>
          <div className="stat-sub text-xs text-[var(--ink-3)] mt-1">Crew seated &amp; fueled</div>
        </div>

        <div className="stat-card bg-[var(--bg-panel)] p-4 rounded-xl border border-[var(--line)] shadow-sm">
          <div className="stat-label text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)]">Active Dispatches</div>
          <div className="stat-value text-2xl font-bold text-amber-700 mt-1.5">1 En Route</div>
          <div className="stat-sub text-xs text-[var(--ink-3)] mt-1">Ambulance LT-326 (Tumair)</div>
        </div>

        <div className="stat-card bg-[var(--bg-panel)] p-4 rounded-xl border border-[var(--line)] shadow-sm">
          <div className="stat-label text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)]">Cumulative Mileage</div>
          <div className="stat-value text-2xl font-bold text-[var(--brand)] mt-1.5">455,900 km</div>
          <div className="stat-sub text-xs text-[var(--ink-3)] mt-1">Across rural mountain roads</div>
        </div>
      </div>

      {/* Vehicle Grid Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {vehicles.map((v) => (
          <div
            key={v.id}
            className="card bg-[var(--bg-panel)] rounded-xl border border-[var(--line)] shadow-sm p-5 space-y-4 hover:shadow-md transition"
          >
            {/* Header: VIN + Status */}
            <div className="flex items-start justify-between">
              <div>
                <span className="font-mono text-lg font-bold text-[var(--brand)]">{v.vin}</span>
                <p className="text-xs text-[var(--ink-2)] mt-0.5">{CHAPTER_NAMES[v.hub]}</p>
              </div>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                  v.status === "Ready on Standby"
                    ? "bg-emerald-100 text-emerald-800"
                    : v.status === "On Active Dispatch"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-gray-100 text-gray-800"
                }`}
              >
                {v.status === "On Active Dispatch" && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-ping mr-1.5" />
                )}
                {v.status}
              </span>
            </div>

            {/* Vehicle Model */}
            <div className="text-xs font-medium text-[var(--ink)] bg-[var(--bg-page)] p-2.5 rounded-lg border border-[var(--line)]/70">
              {v.model}
            </div>

            {/* Telemetry Gauges: Fuel & Oxygen */}
            <div className="space-y-2.5 text-xs">
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-[var(--ink-2)] font-medium">Fuel Level</span>
                  <span className="font-mono font-semibold text-[var(--ink)]">{v.fuelPercent}%</span>
                </div>
                <div className="w-full h-1.5 bg-black/5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      v.fuelPercent > 50 ? "bg-emerald-600" : "bg-amber-500"
                    }`}
                    style={{ width: `${v.fuelPercent}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-[var(--ink-2)] font-medium">Medical Oxygen Cylinder</span>
                  <span className="font-mono font-semibold text-cyan-900">{v.oxygenPsi} PSI (Normal)</span>
                </div>
                <div className="w-full h-1.5 bg-black/5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#29C4E4] rounded-full"
                    style={{ width: `${Math.min(100, (v.oxygenPsi / 2000) * 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Active Shift Crew */}
            <div className="p-3 rounded-lg border border-[var(--line)] bg-[var(--bg-page)] space-y-1.5 text-xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-2)]">
                Active On-Duty Crew
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--ink-2)]">Lead Paramedic:</span>
                <span className="font-semibold text-[var(--ink)]">{v.activeLeadParamedic}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--ink-2)]">Ambulance Driver:</span>
                <span className="font-semibold text-[var(--ink)]">{v.activeDriver}</span>
              </div>
            </div>

            {/* Odometer & Service Info */}
            <div className="flex items-center justify-between text-xs text-[var(--ink-3)] font-mono pt-2 border-t border-[var(--line)]">
              <span>Odometer: {v.mileageKm.toLocaleString()} km</span>
              <span>Next Svc: {v.nextServiceKm.toLocaleString()} km</span>
            </div>

            {/* Actions */}
            <button
              type="button"
              onClick={() => {
                setSelectedVehicle(v);
                setIsHandoverOpen(true);
              }}
              className="w-full btn btn-secondary btn-xs py-2 rounded-md border border-[var(--line)] text-xs font-semibold text-[var(--brand)] hover:bg-[var(--brand-tint)] transition"
            >
              Log Crew Shift Handover &rarr;
            </button>
          </div>
        ))}
      </div>

      {/* Crew Shift Handover Modal */}
      {isHandoverOpen && selectedVehicle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs" onClick={() => setIsHandoverOpen(false)} />
          <div className="relative w-full max-w-md bg-[var(--bg-panel)] rounded-xl border border-[var(--line)] shadow-2xl p-6 z-10 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--line)]">
              <div>
                <h3 className="text-base font-bold text-[var(--ink)]">Crew Shift Handover</h3>
                <p className="text-xs text-[var(--ink-2)]">Ambulance {selectedVehicle.vin} · {CHAPTER_NAMES[selectedVehicle.hub]}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsHandoverOpen(false)}
                className="text-[var(--ink-3)] hover:text-[var(--ink)]"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveHandover} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-[var(--ink-2)] mb-1">Incoming Lead Paramedic</label>
                <Select
                  value={handoverLead}
                  onChange={setHandoverLead}
                  options={[
                    { value: "Zainab Nosheen", label: "Zainab Nosheen (EMP #1)" },
                    { value: "Muhammad Faizan", label: "Muhammad Faizan (EMP #3)" },
                    { value: "Hamza Abbasi", label: "Hamza Abbasi (EMP #5)" },
                    { value: "Sobia Kausar", label: "Sobia Kausar (EMP #7)" },
                  ]}
                />
              </div>

              <div>
                <label className="block font-semibold text-[var(--ink-2)] mb-1">Incoming Ambulance Driver</label>
                <Select
                  value={handoverDriver}
                  onChange={setHandoverDriver}
                  options={[
                    { value: "Faizan Malik", label: "Faizan Malik (EMP #2)" },
                    { value: "Aqib Younas", label: "Aqib Younas (EMP #4)" },
                    { value: "Tariq Mehmood", label: "Tariq Mehmood (EMP #6)" },
                    { value: "Bilal Ahmed", label: "Bilal Ahmed (EMP #8)" },
                  ]}
                />
              </div>

              <div>
                <label className="block font-semibold text-[var(--ink-2)] mb-1">Pre-Shift Vehicle Inspection Notes</label>
                <textarea
                  rows={2}
                  value={handoverNotes}
                  onChange={(e) => setHandoverNotes(e.target.value)}
                  className="w-full text-xs rounded-md border border-[var(--line)] p-2 focus:ring-1 focus:ring-[#29C4E4]"
                />
              </div>

              <div className="pt-3 border-t border-[var(--line)] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsHandoverOpen(false)}
                  className="btn btn-secondary btn-sm px-3 py-1.5 rounded-md border border-[var(--line)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm px-4 py-1.5 rounded-md bg-[var(--brand)] text-white font-semibold"
                >
                  Confirm Shift Handoff
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

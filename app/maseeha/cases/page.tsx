"use client";

import React, { useState, useMemo } from "react";
import { INITIAL_CASES, CHAPTER_NAMES, type EmergencyCase, type Vitals } from "@/lib/maseehaData";
import { Select } from "@/components/ui/Select";

const CHAPTER_FILTER_OPTIONS = [
  { value: "all", label: "All Operational Hubs" },
  { value: "pind_begwal", label: "Pind Begwal Hub" },
  { value: "tumair", label: "Tumair Hub" },
  { value: "jheeng", label: "Jheeng Hub" },
];

const SEVERITY_FILTER_OPTIONS = [
  { value: "all", label: "All Severities" },
  { value: "Critical", label: "Critical Priority" },
  { value: "Major", label: "Major Emergency" },
  { value: "Minor", label: "Minor / Routine" },
];

const CATEGORY_FILTER_OPTIONS = [
  { value: "all", label: "All Call Categories" },
  { value: "Trauma", label: "Trauma & Accident" },
  { value: "Cardiac", label: "Cardiac Distress" },
  { value: "Medical", label: "General Medical" },
  { value: "Gynae", label: "Gynae & Obstetric" },
  { value: "Respiratory", label: "Acute Respiratory" },
];

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All Review Statuses" },
  { value: "Needs Review", label: "Needs Supervisor Review" },
  { value: "Verified", label: "Verified & Certified" },
  { value: "Flagged", label: "Flagged for Follow-up" },
];

const PAYMENT_FILTER_OPTIONS = [
  { value: "all", label: "All Fare Statuses" },
  { value: "Paid", label: "Paid in Full" },
  { value: "Partial", label: "Partial Cash Paid" },
  { value: "Zakat Requested", label: "Zakat Subsidy Requested" },
  { value: "Zakat Approved", label: "Zakat Approved (Free)" },
];

export default function EmergencyCasesPage() {
  const [cases, setCases] = useState<EmergencyCase[]>(INITIAL_CASES);
  const [selectedCase, setSelectedCase] = useState<EmergencyCase | null>(null);
  const [isBackfillOpen, setIsBackfillOpen] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [chapterFilter, setChapterFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");

  // New Case Form state
  const [newCase, setNewCase] = useState<Partial<EmergencyCase>>({
    patient: "",
    gender: "Male",
    age: 30,
    contactPhone: "+92 300 0000000",
    chapter: "pind_begwal",
    location: "",
    hospital: "PIMS Hospital",
    category: "Medical",
    severity: "Major",
    chiefComplaint: "",
    emp1: "Zainab Nosheen",
    emp2: "Faizan Malik",
    vin: "LEA 7221",
    fareBilled: 1200,
    paymentStatus: "Paid",
    amtPaid: 1200,
  });

  const filteredCases = useMemo(() => {
    return cases.filter((c) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        c.patient.toLowerCase().includes(q) ||
        c.id.toString().includes(q) ||
        c.location.toLowerCase().includes(q) ||
        c.hospital.toLowerCase().includes(q) ||
        c.emp1.toLowerCase().includes(q) ||
        c.emp2.toLowerCase().includes(q);

      const matchesChapter = chapterFilter === "all" || c.chapter === chapterFilter;
      const matchesSeverity = severityFilter === "all" || c.severity === severityFilter;
      const matchesCategory = categoryFilter === "all" || c.category === categoryFilter;
      const matchesStatus = statusFilter === "all" || c.reviewStatus === statusFilter;
      const matchesPayment = paymentFilter === "all" || c.paymentStatus === paymentFilter;

      return matchesSearch && matchesChapter && matchesSeverity && matchesCategory && matchesStatus && matchesPayment;
    });
  }, [cases, searchQuery, chapterFilter, severityFilter, categoryFilter, statusFilter, paymentFilter]);

  // Handle Verify Case in Drawer
  const handleVerifyCase = (id: number) => {
    setCases((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              reviewStatus: "Verified",
              verifiedBy: "Saima Sayyed (Director)",
              verifiedAt: new Date().toISOString().slice(0, 16).replace("T", " "),
            }
          : c
      )
    );
    if (selectedCase && selectedCase.id === id) {
      setSelectedCase((prev) =>
        prev
          ? {
              ...prev,
              reviewStatus: "Verified",
              verifiedBy: "Saima Sayyed (Director)",
              verifiedAt: new Date().toISOString().slice(0, 16).replace("T", " "),
            }
          : null
      );
    }
  };

  // Handle Export CSV
  const handleExportCSV = () => {
    const headers = [
      "Case ID",
      "Date",
      "Call Time",
      "Patient Name",
      "Age",
      "Gender",
      "Chapter",
      "Origin Location",
      "Destination Hospital",
      "Category",
      "Severity",
      "Lead Paramedic",
      "Ambulance VIN",
      "Fare Billed (PKR)",
      "Payment Status",
      "Review Status",
    ];

    const rows = filteredCases.map((c) => [
      c.id,
      c.date,
      c.callTime,
      `"${c.patient}"`,
      c.age,
      c.gender,
      `"${CHAPTER_NAMES[c.chapter] || c.chapter}"`,
      `"${c.location}"`,
      `"${c.hospital}"`,
      c.category,
      c.severity,
      `"${c.emp1}"`,
      c.vin,
      c.fareBilled,
      c.paymentStatus,
      c.reviewStatus,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `maseeha_saving9_cases_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle Submit Backfill Case
  const handleSaveBackfill = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCase.patient || !newCase.location) return;

    const newId = Math.max(...cases.map((c) => c.id), 1466) + 1;
    const created: EmergencyCase = {
      id: newId,
      date: new Date().toISOString().slice(0, 10),
      callTime: "12:00",
      enRouteTime: "12:03",
      sceneArrivalTime: "12:15",
      hospitalArrivalTime: "12:45",
      clearToBaseTime: "13:15",
      patient: newCase.patient || "Anonymous Patient",
      gender: newCase.gender as "Male" | "Female",
      age: Number(newCase.age) || 35,
      contactPhone: newCase.contactPhone || "+92 300 1234567",
      chapter: (newCase.chapter as "pind_begwal" | "tumair" | "jheeng") || "pind_begwal",
      location: newCase.location || "Pind Begwal Main",
      hospital: newCase.hospital || "PIMS Hospital",
      category: (newCase.category as "Trauma" | "Cardiac" | "Medical" | "Gynae" | "Respiratory") || "Medical",
      severity: (newCase.severity as "Critical" | "Major" | "Minor") || "Major",
      chiefComplaint: newCase.chiefComplaint || "Retrospectively backfilled by supervisor",
      vitals: { bp: "120/80", pulse: 80, spO2: 98, temp: "37.0°C", avpu: "Alert" },
      emp1: newCase.emp1 || "Zainab Nosheen",
      emp2: newCase.emp2 || "Faizan Malik",
      vin: newCase.vin || "LEA 7221",
      consumables: [{ name: "4\" Crepe Bandage", qty: 1 }],
      distanceKm: 32,
      fareBilled: Number(newCase.fareBilled) || 1200,
      paymentStatus: (newCase.paymentStatus as any) || "Paid",
      amtPaid: Number(newCase.amtPaid) || 1200,
      reviewStatus: "Needs Review",
      supervisorNotes: "Entered via Admin Console backfill.",
    };

    setCases([created, ...cases]);
    setIsBackfillOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="page-header flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-[var(--line)]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[var(--brand-tint)] text-[var(--brand)] border border-[var(--brand-bd)]">
              Registry: {filteredCases.length} Cases
            </span>
            <span className="text-xs text-[var(--ink-3)]">Saving 9 Operations Ledger</span>
          </div>
          <h1 className="page-title text-2xl md:text-3xl font-bold tracking-tight text-[var(--ink)]">
            Emergency Cases Ledger
          </h1>
          <p className="page-subtitle text-sm text-[var(--ink-2)] mt-0.5">
            Full clinical audit trail of all rural emergency runs, patient vitals, telemetry milestones, and pre-hospital care.
          </p>
        </div>

        <div className="page-toolbar flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportCSV}
            className="btn btn-secondary btn-sm flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[var(--line)] text-xs font-semibold hover:bg-black/5 transition"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export CSV
          </button>

          <button
            type="button"
            onClick={() => setIsBackfillOpen(true)}
            className="btn btn-primary btn-sm flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-[var(--brand)] text-white text-xs font-semibold hover:bg-[var(--brand-hover)] transition shadow-sm"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            + Backfill / Log Case
          </button>
        </div>
      </div>

      {/* Filter Toolbar (Using Strict @/components/ui/Select) */}
      <div className="card bg-[var(--bg-panel)] rounded-xl border border-[var(--line)] p-4 shadow-sm space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Search Box */}
          <div className="lg:col-span-2">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-2)] mb-1">
              Search Cases
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search by patient, ID, village, hospital, crew..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs rounded-md border border-[var(--line)] px-3 py-2 pl-8 focus:outline-none focus:ring-1 focus:ring-[#29C4E4]"
              />
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="absolute left-2.5 top-2.5 text-[var(--ink-3)]"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
          </div>

          {/* Chapter Filter */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-2)] mb-1">
              Hub / Chapter
            </label>
            <Select
              value={chapterFilter}
              onChange={setChapterFilter}
              options={CHAPTER_FILTER_OPTIONS}
              aria-label="Filter by chapter"
            />
          </div>

          {/* Severity Filter */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-2)] mb-1">
              Severity
            </label>
            <Select
              value={severityFilter}
              onChange={setSeverityFilter}
              options={SEVERITY_FILTER_OPTIONS}
              aria-label="Filter by severity"
            />
          </div>

          {/* Category Filter */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-2)] mb-1">
              Category
            </label>
            <Select
              value={categoryFilter}
              onChange={setCategoryFilter}
              options={CATEGORY_FILTER_OPTIONS}
              aria-label="Filter by category"
            />
          </div>

          {/* Review Status Filter */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-2)] mb-1">
              Review Status
            </label>
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              options={STATUS_FILTER_OPTIONS}
              aria-label="Filter by review status"
            />
          </div>
        </div>

        {/* Secondary Filter Row: Active Badges / Reset */}
        {(searchQuery || chapterFilter !== "all" || severityFilter !== "all" || categoryFilter !== "all" || statusFilter !== "all" || paymentFilter !== "all") && (
          <div className="flex items-center justify-between pt-2 border-t border-[var(--line)] text-xs text-[var(--ink-2)]">
            <span>
              Showing <strong>{filteredCases.length}</strong> of {cases.length} cases
            </span>
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setChapterFilter("all");
                setSeverityFilter("all");
                setCategoryFilter("all");
                setStatusFilter("all");
                setPaymentFilter("all");
              }}
              className="text-xs text-[#29C4E4] font-semibold hover:underline"
            >
              Reset all filters
            </button>
          </div>
        )}
      </div>

      {/* High-Density Data Table */}
      <div className="card bg-[var(--bg-panel)] rounded-xl border border-[var(--line)] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[var(--bg-page)] border-b border-[var(--line)] text-[var(--ink-2)] font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-3.5">Case #</th>
                <th className="py-3 px-3.5">Date &amp; Time</th>
                <th className="py-3 px-3.5">Patient Details</th>
                <th className="py-3 px-3.5">Triage Severity</th>
                <th className="py-3 px-3.5">Hub &amp; Transit Route</th>
                <th className="py-3 px-3.5">Lead Paramedic</th>
                <th className="py-3 px-3.5">Fare Status</th>
                <th className="py-3 px-3.5">Review Status</th>
                <th className="py-3 px-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)] text-[var(--ink)]">
              {filteredCases.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-sm text-[var(--ink-3)]">
                    No emergency cases match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredCases.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => setSelectedCase(c)}
                    className="hover:bg-black/[0.02] cursor-pointer transition"
                  >
                    <td className="py-3 px-3.5 font-mono font-semibold text-[var(--brand)]">
                      #{c.id}
                    </td>
                    <td className="py-3 px-3.5">
                      <div className="font-medium text-[var(--ink)]">{c.date}</div>
                      <div className="text-[11px] text-[var(--ink-3)] font-mono">{c.callTime} PKT</div>
                    </td>
                    <td className="py-3 px-3.5">
                      <div className="font-semibold text-[var(--ink)]">{c.patient}</div>
                      <div className="text-[11px] text-[var(--ink-3)]">
                        {c.age} yrs · {c.gender} · {c.category}
                      </div>
                    </td>
                    <td className="py-3 px-3.5">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                          c.severity === "Critical"
                            ? "bg-red-50 text-red-700 border border-red-200"
                            : c.severity === "Major"
                            ? "bg-amber-50 text-amber-800 border border-amber-200"
                            : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                        }`}
                      >
                        {c.severity}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 max-w-[200px]">
                      <div className="font-medium truncate text-[var(--ink)]">{c.location}</div>
                      <div className="text-[11px] text-[var(--ink-3)] truncate">&rarr; {c.hospital}</div>
                    </td>
                    <td className="py-3 px-3.5">
                      <div className="font-medium text-[var(--ink)]">{c.emp1}</div>
                      <div className="text-[11px] text-[var(--ink-3)] font-mono">VIN {c.vin}</div>
                    </td>
                    <td className="py-3 px-3.5">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                          c.paymentStatus === "Paid"
                            ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                            : c.paymentStatus === "Zakat Approved"
                            ? "bg-cyan-50 text-cyan-900 border border-cyan-200"
                            : c.paymentStatus === "Zakat Requested"
                            ? "bg-amber-50 text-amber-800 border border-amber-200"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {c.paymentStatus}
                      </span>
                    </td>
                    <td className="py-3 px-3.5">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${
                          c.reviewStatus === "Needs Review"
                            ? "bg-amber-50 text-amber-800 border border-amber-200 font-semibold"
                            : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                        }`}
                      >
                        {c.reviewStatus}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCase(c);
                        }}
                        className="btn btn-secondary btn-xs px-2.5 py-1 rounded border border-[var(--line)] text-xs font-semibold text-[var(--brand)] hover:bg-[var(--brand-tint)]"
                      >
                        Inspect Dossier &rarr;
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slide-over Case Dossier Drawer */}
      {selectedCase && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={() => setSelectedCase(null)}
          />

          <div className="relative w-full max-w-xl bg-[var(--bg-panel)] h-full shadow-2xl flex flex-col z-10 border-l border-[var(--line)] overflow-hidden">
            {/* Drawer Header */}
            <div className="p-4 border-b border-[var(--line)] bg-[var(--bg-page)] flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-sm font-bold text-[var(--brand)]">
                    Case #{selectedCase.id}
                  </span>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                      selectedCase.severity === "Critical"
                        ? "bg-red-50 text-red-700 border border-red-200"
                        : "bg-amber-50 text-amber-800 border border-amber-200"
                    }`}
                  >
                    {selectedCase.severity} Priority
                  </span>
                  <span className="text-xs text-[var(--ink-3)] font-mono">{selectedCase.date}</span>
                </div>
                <h2 className="text-lg font-bold text-[var(--ink)]">{selectedCase.patient}</h2>
                <p className="text-xs text-[var(--ink-2)]">
                  {selectedCase.age} yrs · {selectedCase.gender} · {CHAPTER_NAMES[selectedCase.chapter]}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedCase(null)}
                className="p-1.5 rounded-md hover:bg-black/5 text-[var(--ink-2)]"
                title="Close Drawer"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Drawer Body Scroll */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6 text-xs">
              {/* Chief Clinical Complaint */}
              <div className="p-3.5 rounded-lg bg-[var(--bg-page)] border border-[var(--line)] space-y-1">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-2)]">
                  Chief Complaint &amp; Incident Scene Assessment
                </div>
                <p className="text-sm font-medium text-[var(--ink)] leading-relaxed">
                  {selectedCase.chiefComplaint}
                </p>
                <div className="text-[11px] text-[var(--ink-3)] mt-2">
                  Location: {selectedCase.location} {selectedCase.gpsCoords ? `(GPS: ${selectedCase.gpsCoords.lat}, ${selectedCase.gpsCoords.lng})` : ""}
                </div>
              </div>

              {/* Pre-Hospital Vitals Panel */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--ink-2)] flex items-center justify-between">
                  <span>Pre-Hospital Clinical Vitals</span>
                  <span className="text-[10px] font-normal text-[var(--ink-3)]">Recorded On-Scene</span>
                </h4>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="p-2.5 rounded-lg border border-[var(--line)] bg-[var(--bg-panel)]">
                    <div className="text-[10px] text-[var(--ink-3)] uppercase font-semibold">Blood Pressure</div>
                    <div className="text-sm font-bold font-mono text-[var(--ink)] mt-1">{selectedCase.vitals.bp}</div>
                    <div className="text-[10px] text-[var(--ink-3)]">mmHg</div>
                  </div>

                  <div className="p-2.5 rounded-lg border border-[var(--line)] bg-[var(--bg-panel)]">
                    <div className="text-[10px] text-[var(--ink-3)] uppercase font-semibold">Pulse / HR</div>
                    <div className={`text-sm font-bold font-mono mt-1 ${selectedCase.vitals.pulse > 100 ? "text-red-600" : "text-[var(--ink)]"}`}>
                      {selectedCase.vitals.pulse}
                    </div>
                    <div className="text-[10px] text-[var(--ink-3)]">bpm</div>
                  </div>

                  <div className="p-2.5 rounded-lg border border-[var(--line)] bg-[var(--bg-panel)]">
                    <div className="text-[10px] text-[var(--ink-3)] uppercase font-semibold">SpO2 Oxygen</div>
                    <div className={`text-sm font-bold font-mono mt-1 ${selectedCase.vitals.spO2 < 95 ? "text-amber-600 font-bold" : "text-emerald-700"}`}>
                      {selectedCase.vitals.spO2}%
                    </div>
                    <div className="text-[10px] text-[var(--ink-3)]">{selectedCase.vitals.spO2 < 95 ? "Hypoxic" : "Normal"}</div>
                  </div>

                  <div className="p-2.5 rounded-lg border border-[var(--line)] bg-[var(--bg-panel)]">
                    <div className="text-[10px] text-[var(--ink-3)] uppercase font-semibold">AVPU State</div>
                    <div className="text-sm font-bold mt-1 text-[var(--ink)]">{selectedCase.vitals.avpu}</div>
                    <div className="text-[10px] text-[var(--ink-3)]">{selectedCase.vitals.temp}</div>
                  </div>
                </div>
              </div>

              {/* Transit & Telemetry Timeline */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--ink-2)]">
                  Mission Telemetry &amp; Durations
                </h4>
                <div className="p-3.5 rounded-lg border border-[var(--line)] space-y-2 font-mono text-xs">
                  <div className="flex justify-between items-center text-[var(--ink)]">
                    <span>Call Received</span>
                    <span className="font-semibold">{selectedCase.callTime} PKT</span>
                  </div>
                  <div className="flex justify-between items-center text-[var(--ink)]">
                    <span>En Route Dispatched</span>
                    <span className="font-semibold">{selectedCase.enRouteTime} PKT</span>
                  </div>
                  <div className="flex justify-between items-center text-emerald-800 font-semibold bg-emerald-50 px-2 py-1 rounded">
                    <span>Scene Arrival (Response Time)</span>
                    <span>{selectedCase.sceneArrivalTime} PKT (11 min)</span>
                  </div>
                  <div className="flex justify-between items-center text-[var(--ink)]">
                    <span>Destination Hospital Handover ({selectedCase.hospital})</span>
                    <span className="font-semibold">{selectedCase.hospitalArrivalTime} PKT</span>
                  </div>
                  <div className="flex justify-between items-center text-[var(--ink-3)] pt-1 border-t border-[var(--line)]">
                    <span>Total Mission Distance</span>
                    <span>{selectedCase.distanceKm} km</span>
                  </div>
                </div>
              </div>

              {/* Consumables Used */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--ink-2)]">
                  Medical Consumables Deducted
                </h4>
                <div className="p-3 rounded-lg border border-[var(--line)] space-y-1.5">
                  {selectedCase.consumables.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center text-xs">
                      <span className="font-medium text-[var(--ink)]">{item.name}</span>
                      <span className="font-mono font-bold text-[var(--ink-2)]">x{item.qty}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Fare & Zakat Relief */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--ink-2)]">
                  Financial Settlement &amp; Subsidy
                </h4>
                <div className="p-3.5 rounded-lg border border-[var(--line)] bg-[var(--bg-page)] space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[var(--ink-2)]">Total Standard Fare:</span>
                    <span className="font-mono font-bold text-sm text-[var(--ink)]">Rs. {selectedCase.fareBilled.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[var(--ink-2)]">Cash Paid by Family:</span>
                    <span className="font-mono font-bold text-sm text-emerald-700">Rs. {selectedCase.amtPaid.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-[var(--line)]">
                    <span className="text-[var(--ink-2)]">Payment Classification:</span>
                    <span className="font-semibold text-cyan-900">{selectedCase.paymentStatus}</span>
                  </div>
                  {selectedCase.zakatReason && (
                    <div className="mt-2 p-2 rounded bg-amber-50 border border-amber-200 text-amber-900 text-[11px]">
                      <strong>Zakat Justification:</strong> {selectedCase.zakatReason}
                    </div>
                  )}
                </div>
              </div>

              {/* Crew Attribution */}
              <div className="p-3 rounded-lg border border-[var(--line)] flex justify-between items-center text-xs text-[var(--ink-2)]">
                <div>
                  <span className="font-semibold text-[var(--ink)]">Lead Paramedic:</span> {selectedCase.emp1}
                </div>
                <div>
                  <span className="font-semibold text-[var(--ink)]">Driver:</span> {selectedCase.emp2}
                </div>
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-4 border-t border-[var(--line)] bg-[var(--bg-page)] flex items-center justify-between gap-3">
              <div className="text-xs text-[var(--ink-3)]">
                {selectedCase.reviewStatus === "Verified" ? (
                  <span className="text-emerald-700 font-semibold flex items-center gap-1">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                    Certified by {selectedCase.verifiedBy}
                  </span>
                ) : (
                  <span>Status: Awaiting supervisor certification</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {selectedCase.reviewStatus !== "Verified" && (
                  <button
                    type="button"
                    onClick={() => handleVerifyCase(selectedCase.id)}
                    className="btn btn-primary btn-sm px-4 py-2 rounded-md bg-emerald-700 text-white font-semibold hover:bg-emerald-800 transition"
                  >
                    ✓ Certify &amp; Verify Case
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedCase(null)}
                  className="btn btn-secondary btn-sm px-3 py-2 rounded-md border border-[var(--line)] font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Backfill Emergency Case Modal */}
      {isBackfillOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs" onClick={() => setIsBackfillOpen(false)} />
          <div className="relative w-full max-w-lg bg-[var(--bg-panel)] rounded-xl border border-[var(--line)] shadow-2xl p-6 z-10 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--line)]">
              <div>
                <h3 className="text-base font-bold text-[var(--ink)]">+ Backfill Emergency Case</h3>
                <p className="text-xs text-[var(--ink-2)]">Log an emergency run retroactively for field crew</p>
              </div>
              <button
                type="button"
                onClick={() => setIsBackfillOpen(false)}
                className="text-[var(--ink-3)] hover:text-[var(--ink)]"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveBackfill} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[var(--ink-2)] mb-1">Patient Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Asad Mehmood"
                    value={newCase.patient}
                    onChange={(e) => setNewCase({ ...newCase, patient: e.target.value })}
                    className="w-full text-xs rounded-md border border-[var(--line)] p-2 focus:ring-1 focus:ring-[#29C4E4]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[var(--ink-2)] mb-1">Age &amp; Gender</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      required
                      placeholder="Age"
                      value={newCase.age}
                      onChange={(e) => setNewCase({ ...newCase, age: Number(e.target.value) })}
                      className="w-20 text-xs rounded-md border border-[var(--line)] p-2"
                    />
                    <div className="flex-1">
                      <Select
                        value={newCase.gender || "Male"}
                        onChange={(val) => setNewCase({ ...newCase, gender: val as any })}
                        options={[
                          { value: "Male", label: "Male" },
                          { value: "Female", label: "Female" },
                        ]}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[var(--ink-2)] mb-1">Hub Chapter</label>
                  <Select
                    value={newCase.chapter || "pind_begwal"}
                    onChange={(val) => setNewCase({ ...newCase, chapter: val as any })}
                    options={[
                      { value: "pind_begwal", label: "Pind Begwal Hub" },
                      { value: "tumair", label: "Tumair Hub" },
                      { value: "jheeng", label: "Jheeng Hub" },
                    ]}
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[var(--ink-2)] mb-1">Triage Severity</label>
                  <Select
                    value={newCase.severity || "Major"}
                    onChange={(val) => setNewCase({ ...newCase, severity: val as any })}
                    options={[
                      { value: "Critical", label: "Critical Priority" },
                      { value: "Major", label: "Major Emergency" },
                      { value: "Minor", label: "Minor / Routine" },
                    ]}
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[var(--ink-2)] mb-1">Incident Origin Location</label>
                <input
                  type="text"
                  required
                  placeholder="Village / Road name (e.g. Dhok Sayyedan, Simly Dam Rd)"
                  value={newCase.location}
                  onChange={(e) => setNewCase({ ...newCase, location: e.target.value })}
                  className="w-full text-xs rounded-md border border-[var(--line)] p-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[var(--ink-2)] mb-1">Destination Hospital</label>
                  <Select
                    value={newCase.hospital || "PIMS Hospital"}
                    onChange={(val) => setNewCase({ ...newCase, hospital: val })}
                    options={[
                      { value: "PIMS Hospital", label: "PIMS Hospital" },
                      { value: "Polyclinic Hospital", label: "Polyclinic Hospital" },
                      { value: "Holy Family Hospital", label: "Holy Family Hospital" },
                      { value: "Razi Hospital", label: "Razi Hospital" },
                    ]}
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[var(--ink-2)] mb-1">Assigned Ambulance</label>
                  <Select
                    value={newCase.vin || "LEA 7221"}
                    onChange={(val) => setNewCase({ ...newCase, vin: val })}
                    options={[
                      { value: "LEA 7221", label: "LEA 7221 (Pind Begwal)" },
                      { value: "LT-326", label: "LT-326 (Tumair)" },
                      { value: "RWP-901", label: "RWP-901 (Jheeng)" },
                    ]}
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[var(--ink-2)] mb-1">Chief Complaint &amp; Clinical Notes</label>
                <textarea
                  rows={2}
                  placeholder="Brief summary of trauma or medical condition on scene..."
                  value={newCase.chiefComplaint}
                  onChange={(e) => setNewCase({ ...newCase, chiefComplaint: e.target.value })}
                  className="w-full text-xs rounded-md border border-[var(--line)] p-2"
                />
              </div>

              <div className="pt-3 border-t border-[var(--line)] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsBackfillOpen(false)}
                  className="btn btn-secondary btn-sm px-3 py-1.5 rounded-md border border-[var(--line)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm px-4 py-1.5 rounded-md bg-[var(--brand)] text-white font-semibold"
                >
                  Save &amp; Enter Case
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

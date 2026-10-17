"use client";

import React, { useState } from "react";
import { INITIAL_SUPPLIES, CHAPTER_NAMES, type MedicalSupplyItem } from "@/lib/maseehaData";
import { Select } from "@/components/ui/Select";

export default function MedicalSuppliesPage() {
  const [supplies, setSupplies] = useState<MedicalSupplyItem[]>(INITIAL_SUPPLIES);
  const [hubFilter, setHubFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [restockItem, setRestockItem] = useState<MedicalSupplyItem | null>(null);
  const [restockQty, setRestockQty] = useState(20);

  const filteredSupplies = supplies.filter((item) => {
    const matchesHub = hubFilter === "all" || item.hub === hubFilter;
    const matchesCat = categoryFilter === "all" || item.category === categoryFilter;
    return matchesHub && matchesCat;
  });

  const lowStockCount = supplies.filter((s) => s.currentStock <= s.minThreshold).length;

  const handleConfirmRestock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!restockItem) return;

    setSupplies((prev) =>
      prev.map((s) =>
        s.id === restockItem.id
          ? {
              ...s,
              currentStock: s.currentStock + Number(restockQty),
              lastRestocked: new Date().toISOString().slice(0, 10),
            }
          : s
      )
    );
    setRestockItem(null);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="page-header flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-[var(--line)]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[var(--brand-tint)] text-[var(--brand)] border border-[var(--brand-bd)]">
              Dispensary &amp; Fleet Inventory
            </span>
            <span className="text-xs text-[var(--ink-3)]">Saving 9 Trauma Supplies</span>
          </div>
          <h1 className="page-title text-2xl md:text-3xl font-bold tracking-tight text-[var(--ink)]">
            Medical Consumables &amp; Supplies
          </h1>
          <p className="page-subtitle text-sm text-[var(--ink-2)] mt-0.5">
            Real-time pre-hospital trauma stock levels, oxygen cylinder replenishment, and hub depot inventory.
          </p>
        </div>

        <div className="page-toolbar flex items-center gap-2.5">
          <button
            type="button"
            className="btn btn-secondary btn-sm flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[var(--line)] text-xs font-semibold hover:bg-black/5"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export Stock Audit
          </button>
        </div>
      </div>

      {/* 4-Column Stat Grid */}
      <div className="stat-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card bg-[var(--bg-panel)] p-4 rounded-xl border border-[var(--line)] shadow-sm">
          <div className="stat-label text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)]">Tracked Items</div>
          <div className="stat-value text-2xl font-bold text-[var(--ink)] mt-1.5">{supplies.length} SKUs</div>
          <div className="stat-sub text-xs text-[var(--ink-3)] mt-1">Across 3 dispatch hub depots</div>
        </div>

        <div className="stat-card bg-[var(--bg-panel)] p-4 rounded-xl border border-[var(--line)] shadow-sm">
          <div className="stat-label text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)]">Sufficient Stock</div>
          <div className="stat-value text-2xl font-bold text-emerald-700 mt-1.5">
            {supplies.length - lowStockCount} SKUs
          </div>
          <div className="stat-sub text-xs text-[var(--ink-3)] mt-1">Above safety threshold</div>
        </div>

        <div className="stat-card bg-[var(--bg-panel)] p-4 rounded-xl border border-[var(--line)] shadow-sm">
          <div className="stat-label text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)]">Low Stock Alerts</div>
          <div className="stat-value text-2xl font-bold text-red-600 mt-1.5">
            {lowStockCount} Items
          </div>
          <div className="stat-sub text-xs text-[var(--ink-3)] mt-1">Requires urgent dispensary replenishment</div>
        </div>

        <div className="stat-card bg-[var(--bg-panel)] p-4 rounded-xl border border-[var(--line)] shadow-sm">
          <div className="stat-label text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)]">Consumables Logged</div>
          <div className="stat-value text-2xl font-bold text-[var(--brand)] mt-1.5">284 Units</div>
          <div className="stat-sub text-xs text-[var(--ink-3)] mt-1">Deducted from emergency cases this month</div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="card bg-[var(--bg-panel)] rounded-xl border border-[var(--line)] p-4 shadow-sm flex flex-col sm:flex-row gap-3">
        <div className="w-full sm:w-64">
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-2)] mb-1">
            Hub Depot
          </label>
          <Select
            value={hubFilter}
            onChange={setHubFilter}
            options={[
              { value: "all", label: "All Operational Hubs" },
              { value: "pind_begwal", label: "Pind Begwal Hub" },
              { value: "tumair", label: "Tumair Hub" },
              { value: "jheeng", label: "Jheeng Hub" },
            ]}
          />
        </div>

        <div className="w-full sm:w-64">
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-2)] mb-1">
            Category
          </label>
          <Select
            value={categoryFilter}
            onChange={setCategoryFilter}
            options={[
              { value: "all", label: "All Medical Categories" },
              { value: "Trauma & Dressing", label: "Trauma & Dressing" },
              { value: "Airway & Oxygen", label: "Airway & Oxygen" },
              { value: "Diagnostics", label: "Diagnostics" },
              { value: "Personal Protection", label: "Personal Protection" },
              { value: "Splints & Immobilization", label: "Splints & Immobilization" },
            ]}
          />
        </div>
      </div>

      {/* Supplies Table */}
      <div className="card bg-[var(--bg-panel)] rounded-xl border border-[var(--line)] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[var(--bg-page)] border-b border-[var(--line)] text-[var(--ink-2)] font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-3.5">Supply Item &amp; Spec</th>
                <th className="py-3 px-3.5">Category</th>
                <th className="py-3 px-3.5">Depot Location</th>
                <th className="py-3 px-3.5">Current Stock</th>
                <th className="py-3 px-3.5">Safety Min</th>
                <th className="py-3 px-3.5">Inventory Status</th>
                <th className="py-3 px-3.5">Last Restocked</th>
                <th className="py-3 px-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)] text-[var(--ink)]">
              {filteredSupplies.map((item) => {
                const isLow = item.currentStock <= item.minThreshold;
                return (
                  <tr key={item.id} className="hover:bg-black/[0.015] transition">
                    <td className="py-3.5 px-3.5 font-semibold text-[var(--ink)]">
                      {item.name}
                    </td>
                    <td className="py-3.5 px-3.5 text-[var(--ink-2)]">
                      {item.category}
                    </td>
                    <td className="py-3.5 px-3.5 font-medium">
                      {CHAPTER_NAMES[item.hub]}
                    </td>
                    <td className="py-3.5 px-3.5 font-mono text-sm font-bold text-[var(--ink)]">
                      {item.currentStock} <span className="text-xs font-normal text-[var(--ink-3)]">{item.unit}</span>
                    </td>
                    <td className="py-3.5 px-3.5 font-mono text-xs text-[var(--ink-3)]">
                      {item.minThreshold} {item.unit}
                    </td>
                    <td className="py-3.5 px-3.5">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                          isLow
                            ? "bg-red-50 text-red-700 border border-red-200"
                            : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                        }`}
                      >
                        {isLow ? "Low Stock Warning" : "Optimal Stock"}
                      </span>
                    </td>
                    <td className="py-3.5 px-3.5 text-[var(--ink-3)] font-mono">
                      {item.lastRestocked}
                    </td>
                    <td className="py-3.5 px-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => setRestockItem(item)}
                        className="btn btn-secondary btn-xs px-2.5 py-1 rounded border border-[var(--line)] text-xs font-semibold text-[var(--brand)] hover:bg-[var(--brand-tint)]"
                      >
                        + Restock
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Restock Modal */}
      {restockItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs" onClick={() => setRestockItem(null)} />
          <div className="relative w-full max-w-sm bg-[var(--bg-panel)] rounded-xl border border-[var(--line)] shadow-2xl p-6 z-10 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--line)]">
              <div>
                <h3 className="text-base font-bold text-[var(--ink)]">Receive Stock Shipment</h3>
                <p className="text-xs text-[var(--ink-2)]">{restockItem.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setRestockItem(null)}
                className="text-[var(--ink-3)] hover:text-[var(--ink)]"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmRestock} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-[var(--ink-2)] mb-1">
                  Quantity to Add ({restockItem.unit})
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  value={restockQty}
                  onChange={(e) => setRestockQty(Number(e.target.value))}
                  className="w-full text-xs rounded-md border border-[var(--line)] p-2 focus:ring-1 focus:ring-[#29C4E4]"
                />
              </div>

              <div className="p-2.5 rounded bg-[var(--bg-page)] border border-[var(--line)] text-[11px] text-[var(--ink-2)]">
                Depot: <strong>{CHAPTER_NAMES[restockItem.hub]}</strong>
                <br />
                New stock total will be: <strong>{restockItem.currentStock + Number(restockQty)} {restockItem.unit}</strong>
              </div>

              <div className="pt-3 border-t border-[var(--line)] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRestockItem(null)}
                  className="btn btn-secondary btn-sm px-3 py-1.5 rounded-md border border-[var(--line)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm px-4 py-1.5 rounded-md bg-[var(--brand)] text-white font-semibold"
                >
                  Confirm Restock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

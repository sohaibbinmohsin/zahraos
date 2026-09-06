"use client";

import { useState } from "react";
import { useTeamAccess } from "./TeamAccessProvider";
import { useToast } from "@/components/shell/ToastContext";
import { createChapter, updateChapter } from "@/lib/youthRepublicFunctions";

export function ChaptersPanel() {
  const { organizationId, staffToken, chapters, refresh } = useTeamAccess();
  const { showToast } = useToast();
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!organizationId || !staffToken || !name.trim()) return;
    setBusy(true);
    try {
      await createChapter(
        { organizationId, name: name.trim(), ...(city.trim() ? { city: city.trim() } : {}) },
        staffToken,
      );
      setName(""); setCity("");
      await refresh();
      showToast(`Added chapter "${name.trim()}".`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to add chapter.");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(chapterId: string, current: string) {
    if (!organizationId || !staffToken) return;
    const next = current === "active" ? "inactive" : "active";
    try {
      await updateChapter({ chapterId, organizationId, status: next }, staffToken);
      await refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to update chapter.");
    }
  }

  return (
    <div className="table-card" style={{ padding: "1rem 1.25rem" }}>
      <h2 className="panel-title" style={{ marginBottom: ".75rem" }}>Operational Chapters</h2>
      <p style={{ fontSize: "var(--text-xs)", color: "var(--ink-2)", marginBottom: ".75rem" }}>
        City teams that scope a staff member&apos;s access to their chapter&apos;s data. Used by every role scope dropdown.
      </p>

      <div className="table-responsive-wrapper">
        <table className="data-table">
          <thead>
            <tr><th>Chapter</th><th>City</th><th>Status</th><th style={{ textAlign: "right" }}>Actions</th></tr>
          </thead>
          <tbody>
            {chapters.length === 0 ? (
              <tr><td colSpan={4} style={{ textAlign: "center", padding: "1.5rem", color: "var(--ink-3)" }}>No chapters yet.</td></tr>
            ) : chapters.map((c) => (
              <tr key={c.id}>
                <td style={{ fontWeight: 600 }}>{c.name}</td>
                <td>{c.city ?? "—"}</td>
                <td>
                  <span className={`badge ${c.status === "active" ? "badge-pos" : "badge-neg"}`}>
                    {c.status === "active" ? "Active" : "Inactive"}
                  </span>
                </td>
                <td style={{ textAlign: "right" }}>
                  <button type="button" className="btn btn-secondary btn-xs" onClick={() => toggle(c.id, c.status)}>
                    {c.status === "active" ? "Deactivate" : "Reactivate"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="role-repeater-row" style={{ marginTop: ".85rem" }}>
        <input aria-label="Chapter name" className="form-input" placeholder="Chapter name" value={name} onChange={(e) => setName(e.target.value)} />
        <input aria-label="City" className="form-input" placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} />
        <button type="button" className="btn btn-primary btn-xs" disabled={busy} onClick={add}>Add Chapter</button>
      </div>
    </div>
  );
}

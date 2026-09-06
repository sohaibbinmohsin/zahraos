"use client";
import { useState } from "react";
import { useToast } from "@/components/shell/ToastContext";
import { createChapter, updateChapter, type ChapterRow } from "@/lib/platformFunctions";

export function ChaptersPanel({
  organizationId, accessToken, chapters, onChanged,
}: {
  organizationId: string;
  accessToken: string;
  chapters: ChapterRow[];
  onChanged: () => void;
}) {
  const { showToast } = useToast();
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      await createChapter({ organizationId, name: name.trim(), ...(city.trim() ? { city: city.trim() } : {}) }, accessToken);
      setName(""); setCity("");
      onChanged();
      showToast(`Added chapter "${name.trim()}".`);
    } catch (err) {
      showToast(err instanceof Error && err.message === "chapter_name_taken"
        ? "A chapter with that name already exists." : "Failed to add chapter.");
    } finally { setBusy(false); }
  }

  async function toggle(chapterId: string, current: string) {
    if (busy) return;
    setBusy(true);
    try {
      await updateChapter({ chapterId, status: current === "active" ? "inactive" : "active" }, accessToken);
      onChanged();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to update chapter.");
    } finally { setBusy(false); }
  }

  return (
    <div className="table-card" style={{ padding: "1rem 1.25rem" }}>
      <h2 className="panel-title" style={{ marginBottom: ".75rem" }}>Chapters</h2>
      <p style={{ fontSize: "var(--text-xs)", color: "var(--ink-2)", marginBottom: ".75rem" }}>
        Sub-divisions of the organization. Assigning a role a chapter scope limits that admin to the chapter&apos;s opportunities.
      </p>
      <div className="table-responsive-wrapper">
        <table className="data-table">
          <thead><tr><th>Chapter</th><th>City</th><th>Status</th><th style={{ textAlign: "right" }}>Actions</th></tr></thead>
          <tbody>
            {chapters.length === 0 ? (
              <tr><td colSpan={4} style={{ textAlign: "center", padding: "1.5rem", color: "var(--ink-3)" }}>No chapters yet.</td></tr>
            ) : chapters.map((c) => (
              <tr key={c.id}>
                <td style={{ fontWeight: 600 }}>{c.name}</td>
                <td>{c.city ?? "—"}</td>
                <td><span className={`badge ${c.status === "active" ? "badge-pos" : "badge-neg"}`}>{c.status === "active" ? "Active" : "Inactive"}</span></td>
                <td style={{ textAlign: "right" }}>
                  <button type="button" className="btn btn-secondary btn-xs" disabled={busy} onClick={() => toggle(c.id, c.status)}>
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

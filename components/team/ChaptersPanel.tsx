"use client";
import { useState } from "react";
import { useToast } from "@/components/shell/ToastContext";
import { createChapter, updateChapter, type ChapterRow } from "@/lib/platformFunctions";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { Card } from "@/components/ui/Card";

export function ChaptersPanel({
  organizationId, accessToken, chapters, onChanged,
}: {
  organizationId: string;
  accessToken: string;
  chapters: ChapterRow[];
  onChanged: () => void;
}) {
  const { showToast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [busy, setBusy] = useState<"add" | string | null>(null);

  function closeForm() {
    setShowForm(false);
    setName("");
    setCity("");
  }

  async function add() {
    if (!name.trim() || busy !== null) return;
    setBusy("add");
    try {
      await createChapter({ organizationId, name: name.trim(), ...(city.trim() ? { city: city.trim() } : {}) }, accessToken);
      showToast(`Added chapter "${name.trim()}".`);
      closeForm();
      onChanged();
    } catch (err) {
      showToast(err instanceof Error && err.message === "chapter_name_taken"
        ? "A chapter with that name already exists." : "Failed to add chapter.");
    } finally { setBusy(null); }
  }

  async function toggle(chapterId: string, current: string) {
    if (busy !== null) return;
    setBusy(chapterId);
    try {
      await updateChapter({ chapterId, status: current === "active" ? "inactive" : "active" }, accessToken);
      onChanged();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to update chapter.");
    } finally { setBusy(null); }
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-3" style={{ marginBottom: ".75rem" }}>
        <div>
          <h2 className="panel-title">Chapters</h2>
          <p style={{ fontSize: "var(--text-xs)", color: "var(--ink-2)", marginTop: ".35rem" }}>
            Sub-divisions of the organization. Assigning a role a chapter scope limits that admin to the chapter&apos;s opportunities.
          </p>
        </div>
        {!showForm && (
          <button type="button" className="btn btn-primary btn-sm flex-shrink-0" onClick={() => setShowForm(true)}>
            Add Chapter
          </button>
        )}
      </div>

      {showForm && (
        <div className="rounded-lg border border-[var(--line)] bg-[var(--bg-page)] p-3 flex flex-wrap items-end gap-2" style={{ marginBottom: ".85rem" }}>
          <div className="form-group" style={{ margin: 0, flex: "1 1 200px" }}>
            <label className="form-label" htmlFor="chapter-name">Chapter name</label>
            <input id="chapter-name" aria-label="Chapter name" className="form-input" placeholder="Rizq LUMS Society"
              value={name} autoFocus onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="form-group" style={{ margin: 0, flex: "1 1 150px" }}>
            <label className="form-label" htmlFor="chapter-city">City</label>
            <input id="chapter-city" aria-label="City" className="form-input" placeholder="Lahore"
              value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <LoadingButton className="btn btn-primary btn-sm" disabled={busy !== null || !name.trim()} loading={busy === "add"} loadingText="Adding…" onClick={add}>Add</LoadingButton>
          <button type="button" className="btn btn-secondary btn-sm" disabled={busy !== null} onClick={closeForm}>Cancel</button>
        </div>
      )}

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
                  <LoadingButton className="btn btn-secondary btn-xs" disabled={busy !== null} loading={busy === c.id} loadingText={c.status === "active" ? "Deactivating…" : "Reactivating…"} onClick={() => toggle(c.id, c.status)}>
                    {c.status === "active" ? "Deactivate" : "Reactivate"}
                  </LoadingButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

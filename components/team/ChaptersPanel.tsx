"use client";

import { useState, useMemo } from "react";
import { useToast } from "@/components/shell/ToastContext";
import { createChapter, updateChapter, type ChapterRow } from "@/lib/platformFunctions";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { useStaffPermissions } from "@/components/shell/useStaffPermissions";
import { EditChapterDrawer } from "./EditChapterDrawer";

export function ChaptersPanel({
  organizationId, accessToken, chapters, onChanged,
}: {
  organizationId: string;
  accessToken: string;
  chapters: ChapterRow[];
  onChanged: () => void;
}) {
  const { showToast } = useToast();
  const perms = useStaffPermissions();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [busy, setBusy] = useState<"add" | string | null>(null);
  const [editingChapter, setEditingChapter] = useState<ChapterRow | null>(null);
  const [isDrawerReadOnly, setIsDrawerReadOnly] = useState(false);
  const [nameQuery, setNameQuery] = useState("");
  const [cityFilter, setCityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const sortedChapters = useMemo(() => {
    return [...chapters].sort((a, b) => {
      const aCanEdit = perms.canEditChapter(a.id) ? 1 : 0;
      const bCanEdit = perms.canEditChapter(b.id) ? 1 : 0;
      if (aCanEdit !== bCanEdit) {
        return bCanEdit - aCanEdit;
      }
      return a.name.localeCompare(b.name);
    });
  }, [chapters, perms]);

  const cityOptions = useMemo(() => {
    const cities = [...new Set(chapters.map((c) => c.city?.trim()).filter((c): c is string => Boolean(c)))];
    cities.sort((a, b) => a.localeCompare(b));
    return [{ value: "all", label: "All cities" }, ...cities.map((city) => ({ value: city, label: city }))];
  }, [chapters]);

  const visibleChapters = useMemo(() => {
    const q = nameQuery.trim().toLowerCase();
    return sortedChapters.filter((c) => {
      if (q && !c.name.toLowerCase().includes(q)) return false;
      if (cityFilter !== "all" && (c.city ?? "") !== cityFilter) return false;
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      return true;
    });
  }, [sortedChapters, nameQuery, cityFilter, statusFilter]);

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
      <div className="flex items-center justify-between gap-3" style={{ marginBottom: ".85rem", flexWrap: "wrap" }}>
        <h2 className="panel-title" style={{ margin: 0 }}>Chapters</h2>
        <div className="page-toolbar" style={{ marginLeft: "auto", flexWrap: "nowrap" }}>
          <input
            type="search"
            className="search-input"
            aria-label="Search chapters by name"
            placeholder="Search chapter name..."
            value={nameQuery}
            onChange={(e) => setNameQuery(e.target.value)}
          />
          <Select
            aria-label="Filter chapters by city"
            value={cityFilter}
            onChange={setCityFilter}
            options={cityOptions}
          />
          <Select
            aria-label="Filter chapters by status"
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: "all", label: "All statuses" },
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
            ]}
          />
          {perms.canCreateChapters && !showForm && (
            <button type="button" className="btn btn-primary btn-sm flex-shrink-0" onClick={() => setShowForm(true)}>
              Add Chapter
            </button>
          )}
        </div>
      </div>

      {perms.canCreateChapters && showForm && (
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
            ) : visibleChapters.length === 0 ? (
              <tr><td colSpan={4} style={{ textAlign: "center", padding: "1.5rem", color: "var(--ink-3)" }}>No chapters match these filters.</td></tr>
            ) : visibleChapters.map((c) => {
              const canEdit = perms.canEditChapter(c.id);
              const canDeactivate = canEdit && !perms.isChapterScoped;
              return (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600 }}>{c.name}</td>
                  <td>{c.city ?? "—"}</td>
                  <td><span className={`badge ${c.status === "active" ? "badge-pos" : "badge-neg"}`}>{c.status === "active" ? "Active" : "Inactive"}</span></td>
                  <td style={{ textAlign: "right" }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: ".4rem", justifyContent: "flex-end" }}>
                      {canEdit ? (
                        <>
                          <button
                            type="button"
                            className="btn btn-secondary btn-xs"
                            onClick={() => {
                              setEditingChapter(c);
                              setIsDrawerReadOnly(false);
                            }}
                          >
                            Edit
                          </button>
                          {canDeactivate && (
                            <LoadingButton className="btn btn-secondary btn-xs" disabled={busy !== null} loading={busy === c.id} loadingText={c.status === "active" ? "Deactivating…" : "Reactivating…"} onClick={() => toggle(c.id, c.status)}>
                              {c.status === "active" ? "Deactivate" : "Reactivate"}
                            </LoadingButton>
                          )}
                        </>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-secondary btn-xs"
                          onClick={() => {
                            setEditingChapter(c);
                            setIsDrawerReadOnly(true);
                          }}
                        >
                          View Details
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <EditChapterDrawer
        open={editingChapter !== null}
        chapter={editingChapter}
        readOnly={isDrawerReadOnly}
        organizationId={organizationId}
        accessToken={accessToken}
        onClose={() => setEditingChapter(null)}
        onSuccess={() => {
          setEditingChapter(null);
          onChanged();
        }}
      />
    </Card>
  );
}

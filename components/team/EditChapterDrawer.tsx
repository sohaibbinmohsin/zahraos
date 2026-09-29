"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useToast } from "@/components/shell/ToastContext";
import { LoadingButton } from "@/components/ui/LoadingButton";
import {
  listChapterTeamMembers,
  lookupYouthRepublicMember,
  searchYouthRepublicMembers,
  requestPublicAssetUpload,
  updateChapter,
  type ChapterRow,
  type ChapterTeamMemberPayload,
  type ChapterTeamMemberRow,
  type YouthRepublicMemberLookupResult,
} from "@/lib/platformFunctions";

export interface ChapterRecord {
  id: string;
  name: string;
  city?: string | null;
  status?: string;
  logoUrl?: string | null;
  logo_url?: string | null;
  about?: string | null;
}

export interface EditChapterDrawerProps {
  open: boolean;
  onClose: () => void;
  chapter: ChapterRow | ChapterRecord | null;
  readOnly?: boolean;
  organizationId: string;
  accessToken: string;
  onSuccess?: () => void;
}

interface LocalRosterMember {
  id?: string;
  volunteerCode: string;
  fullName: string;
  email: string | null;
  avatarUrl: string | null;
  designation: string;
  term: string | null;
  status: "active" | "alumni";
}

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function getDefaultTerm(): string {
  const currentYear = new Date().getFullYear();
  return `${currentYear}-${currentYear + 1}`;
}

export function EditChapterDrawer({
  open,
  onClose,
  chapter,
  readOnly = false,
  organizationId,
  accessToken,
  onSuccess,
}: EditChapterDrawerProps) {
  const { showToast } = useToast();
  const fileInputId = useId();

  // Profile state
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [about, setAbout] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [logoUploading, setLogoUploading] = useState(false);

  // Roster state
  const [roster, setRoster] = useState<LocalRosterMember[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"active" | "alumni">("active");

  // Add Member state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<YouthRepublicMemberLookupResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [yrVerifying, setYrVerifying] = useState(false);
  const [verifiedVolunteer, setVerifiedVolunteer] = useState<YouthRepublicMemberLookupResult | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [designationInput, setDesignationInput] = useState("");
  const [termInput, setTermInput] = useState(getDefaultTerm);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Submission state
  const [saving, setSaving] = useState(false);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Debounced search autocomplete (300ms)
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (verifiedVolunteer && `${verifiedVolunteer.fullName} (${verifiedVolunteer.volunteerCode})` === trimmed) {
      setIsDropdownOpen(false);
      return;
    }

    if (trimmed.length < 2 || !organizationId) {
      setSearchResults([]);
      setIsSearching(false);
      setIsDropdownOpen(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await searchYouthRepublicMembers(
          { organizationId, query: trimmed },
          accessToken
        );
        setSearchResults(res.members || []);
        setIsDropdownOpen(true);
      } catch {
        setSearchResults([]);
        setIsDropdownOpen(true);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, organizationId, accessToken, verifiedVolunteer]);

  useEffect(() => {
    if (open && chapter) {
      setName(chapter.name ?? "");
      setCity(chapter.city ?? "");
      setAbout(chapter.about ?? "");
      const existingLogo = chapter.logoUrl ?? (chapter as { logo_url?: string | null }).logo_url ?? "";
      setLogoUrl(existingLogo);
      setVerifiedVolunteer(null);
      setLookupError(null);
      setSearchQuery("");
      setSearchResults([]);
      setIsSearching(false);
      setIsDropdownOpen(false);
      setDesignationInput("");
      setTermInput(getDefaultTerm());
      setActiveTab("active");

      // Load roster
      setRosterLoading(true);
      listChapterTeamMembers({ chapterId: chapter.id }, accessToken)
        .then((res) => {
          setRoster(
            (res.teamMembers ?? []).map((m: ChapterTeamMemberRow) => ({
              id: m.id,
              volunteerCode: m.volunteerCode,
              fullName: m.fullName,
              email: m.email ?? null,
              avatarUrl: m.avatarUrl ?? null,
              designation: m.designation,
              term: m.term ?? null,
              status: m.status,
            }))
          );
        })
        .catch(() => {
          showToast("Failed to load chapter team members.");
        })
        .finally(() => {
          setRosterLoading(false);
        });
    }
  }, [open, chapter, accessToken, showToast]);

  if (!open || !chapter) return null;

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !organizationId || !chapter) return;
    if (!file.type.startsWith("image/")) {
      showToast("Please choose an image file.");
      return;
    }
    setLogoUploading(true);
    try {
      const { uploadUrl, publicUrl } = await requestPublicAssetUpload(
        { domain: "logo", contentType: file.type },
        accessToken,
      );
      const res = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!res.ok) {
        throw new Error("Failed to upload image file to storage.");
      }
      setLogoUrl(publicUrl);
      showToast("Logo uploaded successfully.");
    } catch (err) {
      showToast(err instanceof Error ? `Logo upload failed: ${err.message}` : "Logo upload failed.");
    } finally {
      setLogoUploading(false);
    }
  }

  function handleSelectMember(selected: YouthRepublicMemberLookupResult) {
    setVerifiedVolunteer(selected);
    setSearchQuery(`${selected.fullName} (${selected.volunteerCode})`);
    setIsDropdownOpen(false);
    setLookupError(null);
    const designationInputEl = document.getElementById("designation-input");
    designationInputEl?.focus();
  }

  async function handleVerifyId() {
    const query = searchQuery.trim();
    if (!query || !organizationId) return;

    setYrVerifying(true);
    setLookupError(null);
    setVerifiedVolunteer(null);
    setIsDropdownOpen(false);

    try {
      const codeMatch = query.match(/\((YR-[^)]+)\)/i);
      const youthRepublicId = codeMatch ? codeMatch[1] : query;

      const res = await lookupYouthRepublicMember(
        { organizationId, youthRepublicId },
        accessToken
      );
      if (!res || !res.volunteerCode) {
        setLookupError("No verified Youth Republic account found with this ID.");
      } else {
        setVerifiedVolunteer(res);
      }
    } catch (err) {
      if (err instanceof Error && err.message === "volunteer_pending_verification") {
        setLookupError(
          "This Youth Republic account has pending verification. Only verified members can be added to chapter leadership."
        );
      } else {
        setLookupError("No verified Youth Republic account found with this ID.");
      }
    } finally {
      setYrVerifying(false);
    }
  }

  function handleAddMember() {
    if (!verifiedVolunteer || !designationInput.trim()) return;

    const newMember: LocalRosterMember = {
      volunteerCode: verifiedVolunteer.volunteerCode,
      fullName: verifiedVolunteer.fullName,
      email: verifiedVolunteer.email ?? null,
      avatarUrl: verifiedVolunteer.avatarUrl ?? null,
      designation: designationInput.trim(),
      term: termInput.trim() || null,
      status: "active",
    };

    setRoster((prev) => [...prev, newMember]);
    setVerifiedVolunteer(null);
    setSearchQuery("");
    setSearchResults([]);
    setIsDropdownOpen(false);
    setDesignationInput("");
    setActiveTab("active");
  }

  function handleTransitionStatus(targetIndex: number, newStatus: "active" | "alumni") {
    setRoster((prev) =>
      prev.map((item, idx) => (idx === targetIndex ? { ...item, status: newStatus } : item))
    );
  }

  function handleRemoveMember(targetIndex: number) {
    setRoster((prev) => prev.filter((_, idx) => idx !== targetIndex));
  }

  async function handleSave() {
    if (!name.trim() || saving || !chapter) return;
    setSaving(true);
    try {
      const teamMembersPayload: ChapterTeamMemberPayload[] = roster.map((m) => ({
        volunteerCode: m.volunteerCode,
        fullName: m.fullName,
        email: m.email ?? null,
        avatarUrl: m.avatarUrl ?? null,
        designation: m.designation,
        term: m.term ?? null,
        status: m.status,
      }));

      await updateChapter(
        {
          chapterId: chapter.id,
          name: name.trim(),
          city: city.trim() || null,
          logoUrl: logoUrl.trim() || null,
          about: about.trim() || null,
          teamMembers: teamMembersPayload,
        },
        accessToken
      );

      showToast("Chapter saved successfully.");
      onSuccess?.();
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to save chapter.");
    } finally {
      setSaving(false);
    }
  }

  const activeMembersWithIdx = roster
    .map((member, originalIndex) => ({ member, originalIndex }))
    .filter(({ member }) => member.status === "active");

  const alumniMembersWithIdx = roster
    .map((member, originalIndex) => ({ member, originalIndex }))
    .filter(({ member }) => member.status === "alumni");

  const displayedMembers =
    activeTab === "active" ? activeMembersWithIdx : alumniMembersWithIdx;

  return (
    <>
      <div className="drawer-backdrop open" onClick={onClose} />
      <div className="drawer open" style={{ maxWidth: 640 }}>
        {/* Header */}
        <div className="drawer-header">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: ".5rem" }}>
              <h2 className="drawer-title">
                {readOnly ? "Chapter Details" : "Edit Chapter"}
              </h2>
              {readOnly && (
                <span className="badge badge-neutral">View Details (Read Only)</span>
              )}
            </div>
            <div style={{ fontSize: "var(--text-sm)", color: "var(--ink-2)", marginTop: ".25rem" }}>
              Manage chapter profile, active leadership roster, and alumni history.
            </div>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onClose}
            aria-label="Close drawer"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="drawer-body">
          {/* Section 1: Chapter Profile */}
          <div style={{ marginBottom: "1.5rem" }}>
            <h3 style={{ fontSize: "var(--text-sm)", fontWeight: 600, marginBottom: ".75rem", color: "var(--ink)" }}>
              Chapter Profile
            </h3>

            <div className="form-group">
              <label className="form-label" htmlFor="chapter-name-input">
                Chapter Name
              </label>
              <input
                id="chapter-name-input"
                aria-label="Chapter Name"
                type="text"
                className="form-input"
                placeholder="e.g. Lahore Chapter"
                value={name}
                disabled={readOnly}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="chapter-city-input">
                City
              </label>
              <input
                id="chapter-city-input"
                aria-label="City"
                type="text"
                className="form-input"
                placeholder="e.g. Lahore"
                value={city}
                disabled={readOnly}
                onChange={(e) => setCity(e.target.value)}
              />
            </div>

            {/* Logo Upload & Preview */}
            <div className="form-group">
              <label className="form-label" htmlFor={fileInputId}>
                Chapter Logo
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt="Chapter logo"
                    style={{
                      width: 54,
                      height: 54,
                      borderRadius: 8,
                      objectFit: "cover",
                      border: "1px solid var(--line)",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 54,
                      height: 54,
                      borderRadius: 8,
                      border: "1px dashed var(--line)",
                      display: "grid",
                      placeItems: "center",
                      color: "var(--ink-3)",
                      fontSize: "var(--text-xs)",
                    }}
                  >
                    No Logo
                  </div>
                )}

                {!readOnly && (
                  <div>
                    <input
                      id={fileInputId}
                      aria-label="Upload Chapter Logo"
                      type="file"
                      accept="image/*"
                      style={{ fontSize: "var(--text-sm)" }}
                      disabled={logoUploading}
                      onChange={handleLogoUpload}
                    />
                    {logoUploading && (
                      <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-2)", marginTop: ".25rem" }}>
                        Uploading logo…
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="chapter-about-input">
                About / Description
              </label>
              <textarea
                id="chapter-about-input"
                aria-label="About / Description"
                className="form-input"
                rows={3}
                placeholder="Brief description of the chapter's focus and mission..."
                value={about}
                disabled={readOnly}
                onChange={(e) => setAbout(e.target.value)}
              />
            </div>
          </div>

          <hr style={{ border: 0, borderTop: "1px solid var(--line)", margin: "1.25rem 0" }} />

          {/* Section 2: Team Member Roster Lifecycle */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: ".75rem" }}>
              <h3 style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--ink)", margin: 0 }}>
                Chapter Team Roster
              </h3>
            </div>

            {/* Roster Tabs */}
            <div
              role="tablist"
              aria-label="Roster Tabs"
              style={{
                display: "flex",
                gap: ".5rem",
                borderBottom: "1px solid var(--line)",
                marginBottom: "1rem",
              }}
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "active"}
                className={`btn btn-xs ${activeTab === "active" ? "btn-primary" : "btn-secondary"}`}
                style={{ borderRadius: "6px 6px 0 0", borderBottom: "none" }}
                onClick={() => setActiveTab("active")}
              >
                Active Leadership ({activeMembersWithIdx.length})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "alumni"}
                className={`btn btn-xs ${activeTab === "alumni" ? "btn-primary" : "btn-secondary"}`}
                style={{ borderRadius: "6px 6px 0 0", borderBottom: "none" }}
                onClick={() => setActiveTab("alumni")}
              >
                Alumni Roster ({alumniMembersWithIdx.length})
              </button>
            </div>

            {/* Roster List */}
            {rosterLoading ? (
              <div style={{ padding: "1.5rem", textAlign: "center", color: "var(--ink-2)", fontSize: "var(--text-sm)" }}>
                Loading roster…
              </div>
            ) : displayedMembers.length === 0 ? (
              <div
                style={{
                  padding: "1.5rem",
                  textAlign: "center",
                  color: "var(--ink-3)",
                  fontSize: "var(--text-sm)",
                  border: "1px dashed var(--line)",
                  borderRadius: 8,
                  marginBottom: "1rem",
                }}
              >
                {activeTab === "active"
                  ? "No active leadership members on record."
                  : "No alumni members on record."}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: ".65rem", marginBottom: "1rem" }}>
                {displayedMembers.map(({ member, originalIndex }) => (
                  <div
                    key={`${member.volunteerCode}-${member.term}-${originalIndex}`}
                    style={{
                      background: "var(--bg-page)",
                      border: "1px solid var(--line)",
                      borderRadius: 8,
                      padding: ".75rem",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: ".75rem",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: ".75rem", minWidth: 0 }}>
                      {member.avatarUrl ? (
                        <img
                          src={member.avatarUrl}
                          alt={member.fullName}
                          className="avatar"
                          style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover" }}
                        />
                      ) : (
                        <div className="avatar" style={{ width: 34, height: 34 }}>
                          {initials(member.fullName)}
                        </div>
                      )}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: ".45rem", flexWrap: "wrap" }}>
                          <span style={{ fontWeight: 600, fontSize: "var(--text-sm)" }}>
                            {member.fullName}
                          </span>
                          <span className="badge badge-neutral" style={{ fontSize: "11px" }}>
                            {member.volunteerCode}
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: ".5rem", marginTop: ".2rem", fontSize: "var(--text-xs)" }}>
                          <span style={{ color: "var(--ink)", fontWeight: 500 }}>
                            {member.designation}
                          </span>
                          {member.term && (
                            <span className="badge" style={{ fontSize: "10px" }}>
                              {member.term}
                            </span>
                          )}
                          {member.email && (
                            <span style={{ color: "var(--ink-2)" }}>{member.email}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {!readOnly && (
                      <div style={{ display: "flex", alignItems: "center", gap: ".4rem", flexShrink: 0 }}>
                        {activeTab === "active" ? (
                          <button
                            type="button"
                            className="btn btn-secondary btn-xs"
                            onClick={() => handleTransitionStatus(originalIndex, "alumni")}
                          >
                            Transition to Alumni
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-secondary btn-xs"
                            onClick={() => handleTransitionStatus(originalIndex, "active")}
                          >
                            Restore to Active
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-danger btn-xs"
                          onClick={() => handleRemoveMember(originalIndex)}
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Section 3: Add Team Member Form (hidden if readOnly) */}
            {!readOnly && (
              <div
                style={{
                  background: "var(--bg-page)",
                  border: "1px solid var(--line)",
                  borderRadius: 8,
                  padding: "1rem",
                  marginTop: "1rem",
                }}
              >
                <div style={{ fontWeight: 600, fontSize: "var(--text-sm)", marginBottom: ".75rem" }}>
                  Add Team Member
                </div>

                {/* YR ID Verification & Autocomplete Input */}
                <div ref={dropdownRef} className="form-group" style={{ position: "relative", marginBottom: ".75rem" }}>
                  <label className="form-label" htmlFor="yr-id-input">
                    Verify Youth Republic ID
                  </label>
                  <div style={{ display: "flex", gap: ".5rem" }}>
                    <input
                      id="yr-id-input"
                      aria-label="Youth Republic ID"
                      type="text"
                      className="form-input"
                      placeholder="Search by name, email, or YR ID..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        if (lookupError) setLookupError(null);
                      }}
                      onFocus={() => {
                        if (searchQuery.trim().length >= 2 && searchResults.length > 0) {
                          setIsDropdownOpen(true);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleVerifyId();
                        }
                      }}
                    />
                    <LoadingButton
                      className="btn btn-secondary btn-sm"
                      disabled={yrVerifying || !searchQuery.trim()}
                      loading={yrVerifying}
                      loadingText="Verifying…"
                      onClick={handleVerifyId}
                    >
                      Verify ID
                    </LoadingButton>
                  </div>

                  {/* Floating Autocomplete Dropdown */}
                  {isDropdownOpen && searchQuery.trim().length >= 2 && (
                    <div
                      role="listbox"
                      aria-label="Volunteer search results"
                      style={{
                        position: "absolute",
                        top: "100%",
                        left: 0,
                        right: 0,
                        zIndex: 50,
                        marginTop: "4px",
                        backgroundColor: "#ffffff",
                        border: "1px solid var(--line, #e2e8f0)",
                        borderRadius: "12px",
                        boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
                        maxHeight: "260px",
                        overflowY: "auto",
                      }}
                      className="absolute z-50 mt-1 w-full bg-white border rounded-xl shadow-lg"
                    >
                      {isSearching ? (
                        <div style={{ padding: "0.75rem 1rem", fontSize: "var(--text-sm)", color: "var(--ink-2)" }}>
                          Searching members…
                        </div>
                      ) : searchResults.length === 0 ? (
                        <div
                          style={{ padding: "0.75rem 1rem", fontSize: "var(--text-sm)", color: "var(--ink-2)" }}
                        >
                          {"No active verified members found matching '" + searchQuery.trim() + "'"}
                        </div>
                      ) : (
                        searchResults.map((m) => (
                          <div
                            key={m.volunteerCode}
                            role="option"
                            aria-selected={verifiedVolunteer?.volunteerCode === m.volunteerCode}
                            tabIndex={0}
                            onMouseDown={(e) => {
                              e.preventDefault();
                            }}
                            onClick={() => handleSelectMember(m)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                handleSelectMember(m);
                              }
                            }}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              padding: "0.6rem 0.85rem",
                              cursor: "pointer",
                              borderBottom: "1px solid var(--line, #f1f5f9)",
                            }}
                            className="search-result-item hover:bg-[var(--surface-sunken,#f8fafc)]"
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", minWidth: 0 }}>
                              {m.avatarUrl ? (
                                <img
                                  src={m.avatarUrl}
                                  alt={m.fullName}
                                  className="w-8 h-8 rounded-full object-cover"
                                  style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }}
                                />
                              ) : (
                                <div
                                  className="avatar"
                                  style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: "50%",
                                    backgroundColor: "var(--surface-sunken, #f1f5f9)",
                                    display: "grid",
                                    placeItems: "center",
                                    fontSize: "var(--text-xs)",
                                    fontWeight: 600,
                                    color: "var(--ink-2)",
                                  }}
                                >
                                  {initials(m.fullName)}
                                </div>
                              )}
                              <div style={{ minWidth: 0 }}>
                                <div
                                  className="font-bold text-sm text-[var(--ink)]"
                                  style={{ fontWeight: 600, fontSize: "var(--text-sm)", color: "var(--ink)" }}
                                >
                                  {m.fullName}
                                </div>
                                {m.email && (
                                  <div
                                    className="text-xs text-[var(--ink-2)]"
                                    style={{ fontSize: "var(--text-xs)", color: "var(--ink-2)" }}
                                  >
                                    {m.email}
                                  </div>
                                )}
                              </div>
                            </div>
                            <span
                              className="font-mono text-xs bg-[var(--surface-sunken)] px-1.5 py-0.5 rounded border"
                              style={{
                                fontFamily: "monospace",
                                fontSize: "11px",
                                padding: "2px 6px",
                                borderRadius: "4px",
                                border: "1px solid var(--line, #e2e8f0)",
                                background: "var(--surface-sunken, #f8fafc)",
                                flexShrink: 0,
                              }}
                            >
                              {m.volunteerCode}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {lookupError && (
                    <div style={{ color: "var(--red, #e11d48)", fontSize: "var(--text-xs)", marginTop: ".35rem" }}>
                      {lookupError}
                    </div>
                  )}
                </div>

                {/* Volunteer Confirmation Card */}
                {verifiedVolunteer && (
                  <div
                    style={{
                      background: "#fff",
                      border: "1px solid var(--line)",
                      borderRadius: 6,
                      padding: ".65rem .85rem",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: ".85rem",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: ".65rem" }}>
                      {verifiedVolunteer.avatarUrl ? (
                        <img
                          src={verifiedVolunteer.avatarUrl}
                          alt={verifiedVolunteer.fullName}
                          className="avatar"
                          style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }}
                        />
                      ) : (
                        <div className="avatar" style={{ width: 32, height: 32 }}>
                          {initials(verifiedVolunteer.fullName)}
                        </div>
                      )}
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "var(--text-sm)" }}>
                          {verifiedVolunteer.fullName}
                        </div>
                        {verifiedVolunteer.email && (
                          <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-2)" }}>
                            {verifiedVolunteer.email}
                          </div>
                        )}
                      </div>
                    </div>
                    <span className="badge badge-pos">Verified YR Member</span>
                  </div>
                )}

                {/* Designation & Term Inputs */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: ".65rem", marginBottom: ".75rem" }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" htmlFor="designation-input">
                      Designation
                    </label>
                    <input
                      id="designation-input"
                      aria-label="Designation"
                      type="text"
                      className="form-input"
                      placeholder="e.g. President, Media Lead"
                      value={designationInput}
                      onChange={(e) => setDesignationInput(e.target.value)}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" htmlFor="term-input">
                      Tenure / Term
                    </label>
                    <input
                      id="term-input"
                      aria-label="Tenure / Term"
                      type="text"
                      className="form-input"
                      placeholder="e.g. 2026-2027"
                      value={termInput}
                      onChange={(e) => setTermInput(e.target.value)}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={!verifiedVolunteer || !designationInput.trim()}
                  onClick={handleAddMember}
                >
                  Add to Chapter Roster
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="drawer-footer">
          {readOnly ? (
            <button type="button" className="btn btn-secondary btn-xs" onClick={onClose}>
              Close
            </button>
          ) : (
            <>
              <button
                type="button"
                className="btn btn-secondary btn-xs"
                onClick={onClose}
                disabled={saving}
              >
                Cancel
              </button>
              <LoadingButton
                className="btn btn-primary btn-xs"
                disabled={saving || !name.trim()}
                loading={saving}
                loadingText="Saving…"
                onClick={handleSave}
              >
                Save Chapter
              </LoadingButton>
            </>
          )}
        </div>
      </div>
    </>
  );
}

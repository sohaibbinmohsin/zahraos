"use client";

import { useState } from "react";
import { createOpportunity, updateOpportunity, type CreateOpportunityPayload } from "@/lib/youthRepublicFunctions";
import { VolunteerApplyPreview } from "@/components/youth-republic/VolunteerApplyPreview";
import { CityCombobox } from "@/components/youth-republic/CityCombobox";
import type { FormDefinition, FieldDef, FieldType } from "@/lib/forms";
import { useToast } from "@/components/shell/ToastContext";

interface CreateOpportunityFormProps {
  organizationId: string;
  staffToken: string;
  onCreated: () => void;
  onCancel?: () => void;
  initialOpportunity?: {
    id?: string;
    name: string;
    type: string;
    description?: string;
    location?: string;
    isOnline?: boolean;
    capacity?: number;
    applicationOpenAt?: string;
    applicationDeadline?: string;
    activityStartAt?: string;
    activityEndAt?: string;
    about?: string;
    duties?: string[];
    eligibility?: string[];
    whatToBring?: string[];
    applicationForm?: FormDefinition;
    computedStatus?: string;
    deactivatedAt?: string | null;
  };
}

// API returns ISO timestamps; <input type="date"> wants YYYY-MM-DD.
function toDateInput(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

const DEFAULT_FORM_FIELDS: FieldDef[] = [
  {
    id: "academic_inst",
    type: "short_text",
    label: "University / College & Degree Program",
    help: "e.g., LUMS (BS Economics) or FAST (BS CS)",
    required: true,
  },
  {
    id: "avail_shifts",
    type: "multiselect",
    label: "Preferred Availability / Shift Timing",
    required: true,
    options: [
      { value: "morning", label: "Morning Shift (09:00 AM – 01:00 PM)" },
      { value: "evening", label: "Evening Shift (02:00 PM – 06:00 PM)" },
      { value: "weekend", label: "Weekends Only" },
    ],
  },
  {
    id: "prior_exp",
    type: "long_text",
    label: "Relevant Volunteer or Leadership Experience",
    help: "Briefly mention any similar community drives or social initiatives you have participated in.",
    required: false,
  },
  {
    id: "cnic_doc",
    type: "file",
    label: "Upload Student ID Card or CNIC Copy",
    help: "Required for university accreditation & on-site security clearance.",
    required: true,
    maxFiles: 1,
    maxSizeMB: 5,
  },
];

export function CreateOpportunityForm({
  organizationId,
  staffToken,
  onCreated,
  onCancel,
  initialOpportunity,
}: CreateOpportunityFormProps) {
  const { showToast } = useToast();
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Step 1: Specs
  const [name, setName] = useState(initialOpportunity?.name ?? "");
  const [type, setType] = useState(initialOpportunity?.type ?? "environment");
  const [location, setLocation] = useState(initialOpportunity?.location ?? "");
  const [isOnline, setIsOnline] = useState(initialOpportunity?.isOnline ?? false);
  const [capacity, setCapacity] = useState<number | undefined>(initialOpportunity?.capacity);
  const [applicationOpenAt, setApplicationOpenAt] = useState(toDateInput(initialOpportunity?.applicationOpenAt));
  const [applicationDeadline, setApplicationDeadline] = useState(toDateInput(initialOpportunity?.applicationDeadline));
  const [activityStartAt, setActivityStartAt] = useState(toDateInput(initialOpportunity?.activityStartAt));
  const [activityEndAt, setActivityEndAt] = useState(toDateInput(initialOpportunity?.activityEndAt));
  const [description, setDescription] = useState(initialOpportunity?.description ?? "");
  const [about, setAbout] = useState(initialOpportunity?.about ?? "");
  const [dutiesStr, setDutiesStr] = useState(initialOpportunity?.duties?.join("\n") ?? "");
  const [eligibilityStr, setEligibilityStr] = useState(initialOpportunity?.eligibility?.join("\n") ?? "");
  const [whatToBringStr, setWhatToBringStr] = useState(initialOpportunity?.whatToBring?.join("\n") ?? "");

  // Step 2: Dynamic Form Builder Questions
  const [fields, setFields] = useState<FieldDef[]>(
    initialOpportunity?.applicationForm?.fields ?? []
  );

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  // Dynamic Form Question Handlers
  function handleAddQuestion() {
    const newId = `q_${Date.now().toString(36)}`;
    const newField: FieldDef = {
      id: newId,
      type: "short_text",
      label: "New Question Title",
      required: false,
    };
    setFields([...fields, newField]);
    showToast("Added new question.");
  }

  function handleRemoveQuestion(index: number) {
    const updated = fields.filter((_, i) => i !== index);
    setFields(updated);
  }

  function handleFieldChange(index: number, patch: Partial<FieldDef>) {
    const updated = [...fields];
    updated[index] = { ...updated[index], ...patch };
    setFields(updated);
  }

  function handleAddOption(fieldIndex: number) {
    const field = fields[fieldIndex];
    const opts = field.options ? [...field.options] : [];
    const nextVal = `option_${opts.length + 1}`;
    opts.push({ value: nextVal, label: `Option ${opts.length + 1}` });
    handleFieldChange(fieldIndex, { options: opts });
  }

  function handleRemoveOption(fieldIndex: number, optIndex: number) {
    const field = fields[fieldIndex];
    if (!field.options) return;
    const opts = field.options.filter((_, i) => i !== optIndex);
    handleFieldChange(fieldIndex, { options: opts });
  }

  function handleOptionLabelChange(fieldIndex: number, optIndex: number, newLabel: string) {
    const field = fields[fieldIndex];
    if (!field.options) return;
    const opts = [...field.options];
    opts[optIndex] = { ...opts[optIndex], label: newLabel, value: newLabel.toLowerCase().replace(/\s+/g, "_") };
    handleFieldChange(fieldIndex, { options: opts });
  }

  function handleDragStart(e: React.DragEvent, index: number) {
    const target = e.target as HTMLElement;
    if (
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT" ||
      target.tagName === "BUTTON"
    ) {
      e.preventDefault();
      return;
    }
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverIdx !== index) {
      setDragOverIdx(index);
    }
  }

  function handleDragLeave(e: React.DragEvent, index: number) {
    if (dragOverIdx === index) {
      setDragOverIdx(null);
    }
  }

  function handleDrop(e: React.DragEvent, targetIndex: number) {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === targetIndex) {
      setDraggedIdx(null);
      setDragOverIdx(null);
      return;
    }

    const updated = [...fields];
    const [draggedItem] = updated.splice(draggedIdx, 1);
    updated.splice(targetIndex, 0, draggedItem);
    setFields(updated);
    setDraggedIdx(null);
    setDragOverIdx(null);
    showToast("Questions reordered.");
  }

  function handleDragEnd() {
    setDraggedIdx(null);
    setDragOverIdx(null);
  }

  function handleMoveQuestion(fromIndex: number, toIndex: number) {
    if (toIndex < 0 || toIndex >= fields.length) return;
    const updated = [...fields];
    const [item] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, item);
    setFields(updated);
  }

  const isLive = Boolean(initialOpportunity?.id && initialOpportunity.computedStatus !== "draft");

  async function handleToggleArchive() {
    if (!initialOpportunity?.id) return;
    const archiving = !initialOpportunity.deactivatedAt;
    if (archiving && !confirm(`Archive "${name}"? It will be hidden from volunteers immediately.`)) {
      return;
    }
    setSubmitting(true);
    try {
      await updateOpportunity(
        {
          opportunityId: initialOpportunity.id,
          organizationId,
          deactivatedAt: archiving ? new Date().toISOString() : null,
        },
        staffToken,
      );
      showToast(archiving ? "Opportunity archived." : "Opportunity restored.");
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update archive status");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSave(isDraft: boolean = false) {
    setError(null);
    if (!name.trim()) {
      setError("Opportunity name is required");
      setCurrentStep(1);
      return;
    }
    if (name.trim().length > 80) {
      setError("Opportunity name cannot exceed 80 characters");
      setCurrentStep(1);
      return;
    }
    if (description.trim().length > 200) {
      setError("Short summary cannot exceed 200 characters");
      setCurrentStep(1);
      return;
    }

    setSubmitting(true);
    try {
      const duties = dutiesStr.split("\n").map((s) => s.trim()).filter(Boolean);
      const eligibility = eligibilityStr.split("\n").map((s) => s.trim()).filter(Boolean);
      const whatToBring = whatToBringStr.split("\n").map((s) => s.trim()).filter(Boolean);

      const isoOrUndef = (d: string) => (d ? new Date(d).toISOString() : undefined);
      const common = {
        description: description.trim() || undefined,
        location: isOnline ? null : (location.trim() || null),
        isOnline: Boolean(isOnline),
        capacity: capacity ? Number(capacity) : undefined,
        applicationOpenAt: isoOrUndef(applicationOpenAt),
        applicationDeadline: isoOrUndef(applicationDeadline),
        activityStartAt: isoOrUndef(activityStartAt),
        activityEndAt: isoOrUndef(activityEndAt),
        about: about.trim() || undefined,
        duties: duties.length > 0 ? duties : undefined,
        eligibility: eligibility.length > 0 ? eligibility : undefined,
        whatToBring: whatToBring.length > 0 ? whatToBring : undefined,
        applicationForm: fields.length > 0 ? { version: 1 as const, fields } : undefined,
      };

      if (initialOpportunity?.id) {
        await updateOpportunity(
          {
            opportunityId: initialOpportunity.id,
            organizationId,
            name: name.trim(),
            ...(initialOpportunity.computedStatus === "draft" && !isDraft ? { statusOverride: "open" } : {}),
            ...common,
          },
          staffToken,
        );
        showToast(isDraft ? (isLive ? "Opportunity draft updated." : "Opportunity draft updated.") : "Opportunity updated successfully.");
      } else {
        const payload: CreateOpportunityPayload = {
          organizationId,
          name: name.trim(),
          type,
          ...common,
        };
        const created = await createOpportunity(payload, staffToken);
        if (isDraft) {
          await updateOpportunity(
            { opportunityId: created.opportunityId, organizationId, statusOverride: "draft" },
            staffToken,
          );
        }
        showToast(isDraft ? "Opportunity draft saved." : "Opportunity published to Noticeboard.");
      }
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save opportunity");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Page Header with Save Draft in line with title */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {initialOpportunity?.id ? "Edit Opportunity" : "Create New Opportunity"}
          </h1>
          <div className="page-subtitle">Full specifications &amp; built-in application form builder</div>
        </div>
        <div className="page-toolbar">
          {initialOpportunity?.id && (
            <button
              type="button"
              className={initialOpportunity.deactivatedAt ? "btn btn-secondary btn-sm" : "btn btn-danger btn-sm"}
              onClick={handleToggleArchive}
              disabled={submitting}
            >
              {initialOpportunity.deactivatedAt ? (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="1 4 1 10 7 10" />
                    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                  </svg>
                  <span>Restore</span>
                </>
              ) : (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="21 8 21 21 3 21 3 8" />
                    <rect x="1" y="3" width="22" height="5" />
                    <line x1="10" y1="12" x2="14" y2="12" />
                  </svg>
                  <span>Archive</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* 3-Step Stepper */}
      <div className="builder-stepper">
        <button
          type="button"
          className={`step-tab ${currentStep === 1 ? "active" : ""}`}
          onClick={() => setCurrentStep(1)}
        >
          <span className="step-num">1</span>
          <span>Opportunity Specifications &amp; Overview</span>
        </button>
        <span className="step-dot" aria-hidden="true">•</span>
        <button
          type="button"
          className={`step-tab ${currentStep === 2 ? "active" : ""}`}
          onClick={() => setCurrentStep(2)}
        >
          <span className="step-num">2</span>
          <span>Application Form Builder</span>
        </button>
        <span className="step-dot" aria-hidden="true">•</span>
        <button
          type="button"
          className={`step-tab ${currentStep === 3 ? "active" : ""}`}
          onClick={() => setCurrentStep(3)}
        >
          <span className="step-num">3</span>
          <span>Live Volunteer Experience Preview</span>
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 font-semibold">
          {error}
        </div>
      )}

      {/* STEP 1: Specifications & Overview */}
      {currentStep === 1 && (
        <div className="space-y-4">
          <div className="builder-pane-card">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-group">
              <div className="flex items-center justify-between">
                <label htmlFor="oppName" className="form-label mb-0">
                  Name
                </label>
                <span className="text-xs text-[var(--ink-3)] font-mono">
                  {name.length}/80
                </span>
              </div>
              <input
                id="oppName"
                className="form-input mt-1"
                value={name}
                maxLength={80}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Ramadan Food Drive (Lahore Depot)"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="oppType" className="form-label">
                Type
              </label>
              <select
                id="oppType"
                className="form-select"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                <option value="community">Community Support &amp; Welfare</option>
                <option value="education">Education &amp; Academic Tutoring</option>
                <option value="environment">Environment &amp; Climate Action</option>
                <option value="health">Healthcare &amp; Emergency Relief</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="form-group">
              <label htmlFor="oppDeliveryFormat" className="form-label">Delivery Format</label>
              <select
                id="oppDeliveryFormat"
                className="form-select"
                value={isOnline ? "online" : "onsite"}
                onChange={(e) => setIsOnline(e.target.value === "online")}
              >
                <option value="onsite">On-Site (Physical Venue)</option>
                <option value="online">Virtual / Online Volunteer Role</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="oppLocation" className="form-label">City &amp; Venue</label>
              <CityCombobox
                id="oppLocation"
                value={isOnline ? "N/A" : location}
                onChange={(c) => setLocation(c)}
                disabled={isOnline}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Target Volunteer Capacity</label>
              <input
                type="number"
                className="form-input font-mono"
                value={capacity}
                onChange={(e) => setCapacity(Number(e.target.value))}
                min="1"
                max="5000"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="form-group">
              <label className="form-label">Applications Open</label>
              <input
                type="date"
                className="form-input font-mono"
                value={applicationOpenAt}
                onChange={(e) => setApplicationOpenAt(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Application Deadline</label>
              <input
                type="date"
                className="form-input font-mono"
                value={applicationDeadline}
                onChange={(e) => setApplicationDeadline(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Drive Start Date</label>
              <input
                type="date"
                className="form-input font-mono"
                value={activityStartAt}
                onChange={(e) => setActivityStartAt(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Drive End Date</label>
              <input
                type="date"
                className="form-input font-mono"
                value={activityEndAt}
                onChange={(e) => setActivityEndAt(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <div className="flex items-center justify-between">
              <label htmlFor="oppDescription" className="form-label mb-0">
                Short Summary <span className="text-[var(--ink-3)] font-normal">— one line, shown on noticeboard cards</span>
              </label>
              <span className="text-xs text-[var(--ink-3)] font-mono">
                {description.length}/200
              </span>
            </div>
            <textarea
              id="oppDescription"
              rows={2}
              className="form-textarea mt-1"
              maxLength={200}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Pack and distribute ration hampers to families across Lahore throughout Ramadan."
            />
          </div>

          <div className="form-group">
            <label className="form-label">Full Details <span className="text-[var(--ink-3)] font-normal">— shown on the opportunity page below the summary</span></label>
            <textarea
              rows={4}
              className="form-textarea"
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              placeholder="Shift times, meeting point, what the day looks like, who to contact..."
            />
          </div>

          <div className="form-group">
            <label className="form-label">Key Volunteer Duties (One per line)</label>
            <textarea
              rows={3}
              className="form-textarea"
              value={dutiesStr}
              onChange={(e) => setDutiesStr(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">Eligibility &amp; Requirements (One per line)</label>
              <textarea
                rows={3}
                className="form-textarea"
                value={eligibilityStr}
                onChange={(e) => setEligibilityStr(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">What Volunteers Should Bring (One per line)</label>
              <textarea
                rows={3}
                className="form-textarea"
                value={whatToBringStr}
                onChange={(e) => setWhatToBringStr(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div
          className="step-actions-row justify-end"
          style={{ display: "flex", justifyContent: "flex-end" }}
        >
          <div
            className="flex items-center gap-3 ml-auto"
            style={{ marginLeft: "auto" }}
          >
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => handleSave(isLive ? false : true)}
              disabled={submitting}
            >
              {submitting ? "Saving..." : isLive ? "Update changes" : "Save draft"}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setCurrentStep(2)}
            >
              Proceed to Application Form Builder &rarr;
            </button>
          </div>
        </div>
        </div>
      )}

      {/* STEP 2: Google Forms-style Interactive Dynamic Form Builder */}
      {currentStep === 2 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[var(--line)]">
            <h2 className="text-base font-semibold text-[var(--ink)] tracking-normal">
              Application Questions ({fields.length})
            </h2>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleAddQuestion}
            >
              + Add Question
            </button>
          </div>

          {fields.map((field, idx) => (
            <div
              key={field.id}
              className={`question-card ${draggedIdx === idx ? "is-dragging" : ""} ${dragOverIdx === idx && draggedIdx !== idx ? "drag-over" : ""}`}
              draggable
              onDragStart={(e) => handleDragStart(e, idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDragLeave={(e) => handleDragLeave(e, idx)}
              onDrop={(e) => handleDrop(e, idx)}
              onDragEnd={handleDragEnd}
            >
              <div className="q-header">
                <div className="flex items-center gap-1">
                  <div
                    className="q-drag-handle"
                    title="Drag to reorder questions"
                    aria-label={`Question ${idx + 1}. Drag to reorder.`}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-[var(--ink-3)]">
                      <circle cx="9" cy="5" r="2" />
                      <circle cx="9" cy="12" r="2" />
                      <circle cx="9" cy="19" r="2" />
                      <circle cx="15" cy="5" r="2" />
                      <circle cx="15" cy="12" r="2" />
                      <circle cx="15" cy="19" r="2" />
                    </svg>
                    <span className="font-mono text-xs font-semibold text-[var(--ink-3)]">#{idx + 1}</span>
                  </div>
                  <div className="flex flex-col text-[10px] text-[var(--ink-3)]">
                    {idx > 0 && (
                      <button
                        type="button"
                        title="Move question up"
                        className="hover:text-[var(--ink)] leading-none px-1 py-0.5 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveQuestion(idx, idx - 1);
                        }}
                      >
                        ▲
                      </button>
                    )}
                    {idx < fields.length - 1 && (
                      <button
                        type="button"
                        title="Move question down"
                        className="hover:text-[var(--ink)] leading-none px-1 py-0.5 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveQuestion(idx, idx + 1);
                        }}
                      >
                        ▼
                      </button>
                    )}
                  </div>
                </div>

                <input
                  className="form-input font-medium"
                  value={field.label}
                  onChange={(e) => handleFieldChange(idx, { label: e.target.value })}
                  placeholder="Question text / prompt"
                />

                <select
                  className="filter-select text-xs font-semibold"
                  value={field.type}
                  onChange={(e) => handleFieldChange(idx, { type: e.target.value as FieldType })}
                >
                  <option value="short_text">Short Answer</option>
                  <option value="long_text">Paragraph / Long Text</option>
                  <option value="select">Dropdown Choice</option>
                  <option value="multiselect">Multiple Choice (Checkboxes)</option>
                  <option value="radio">Single Choice (Radio)</option>
                  <option value="date">Date Picker</option>
                  <option value="file">File / Document Upload</option>
                </select>
              </div>

              {/* Subtitle / Help text */}
              <input
                className="form-input text-xs text-[var(--ink-2)]"
                value={field.help ?? ""}
                onChange={(e) => handleFieldChange(idx, { help: e.target.value })}
                placeholder="Help description / instructions for volunteers (optional)"
              />

              {/* Choice options editor */}
              {(field.type === "select" || field.type === "multiselect" || field.type === "radio") && (
                <div className="q-options-list pl-4 border-l-2 border-[var(--line)]">
                  {field.options?.map((opt, optIdx) => (
                    <div key={optIdx} className="q-option-row">
                      <span className="w-2.5 h-2.5 rounded-full border border-[var(--ink-3)]" />
                      <input
                        className="form-input text-sm py-1 flex-1"
                        value={opt.label}
                        onChange={(e) => handleOptionLabelChange(idx, optIdx, e.target.value)}
                      />
                      <button
                        type="button"
                        className="text-red-500 text-xs px-2 hover:underline"
                        onClick={() => handleRemoveOption(idx, optIdx)}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="text-xs font-semibold text-[var(--ink)] hover:underline self-start mt-1"
                    onClick={() => handleAddOption(idx)}
                  >
                    + Add Option
                  </button>
                </div>
              )}

              <div className="q-footer">
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="brand-checkbox"
                    checked={field.required ?? false}
                    onChange={(e) => handleFieldChange(idx, { required: e.target.checked })}
                  />
                  <span className="text-[var(--ink)]">Required Question</span>
                </label>

                <button
                  type="button"
                  className="btn btn-secondary btn-xs text-red-600 border-red-200 hover:bg-red-50"
                  onClick={() => handleRemoveQuestion(idx)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}

          <div className="add-question-card" onClick={handleAddQuestion}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Add Custom Question Card</span>
          </div>

          <div className="step-actions-row">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setCurrentStep(1)}
            >
              &larr; Back to Specifications
            </button>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => handleSave(isLive ? false : true)}
                disabled={submitting}
              >
                {submitting ? "Saving..." : isLive ? "Update changes" : "Save draft"}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setCurrentStep(3)}
              >
                Preview Live Volunteer Experience &rarr;
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: Live Volunteer Experience Preview — the real volunteer apply UI */}
      {currentStep === 3 && (
        <div className="space-y-4">
          <div className="builder-pane-card space-y-4">
            <p className="text-xs font-semibold text-[var(--ink-2)]">
              Exactly how a volunteer sees this opportunity and its application form
            </p>

            <VolunteerApplyPreview
              opportunity={{
                name,
                type,
                city: location || undefined,
                isOnline,
                description: description || undefined,
                about: about || undefined,
                capacity: capacity ? Number(capacity) : undefined,
                applicationDeadline: applicationDeadline ? new Date(applicationDeadline).toISOString() : undefined,
                activityStartAt: activityStartAt ? new Date(activityStartAt).toISOString() : undefined,
                activityEndAt: activityEndAt ? new Date(activityEndAt).toISOString() : undefined,
              }}
              form={{ version: 1, fields }}
            />
          </div>

          <div className="step-actions-row">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setCurrentStep(2)}
            >
              &larr; Back to Form Builder
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => handleSave(false)}
              disabled={submitting}
            >
              {submitting ? "Publishing..." : isLive ? "Update changes" : "Create opportunity"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

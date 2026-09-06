"use client";

import type { FieldDef, FormDefinition } from "@/lib/forms";

/**
 * Renders an opportunity + its application form exactly as a volunteer sees it
 * on the Youth Republic volunteer app (`/apply/[id]`). The markup and the
 * scoped stylesheet below are vendored from
 * youth-republic/frontend/app/globals.css + components/ApplyForm.tsx — keep in
 * sync if the volunteer apply UI changes.
 *
 * Inputs are non-interactive: this is a preview, not a live form.
 */

export interface VolunteerApplyPreviewOpportunity {
  name: string;
  type: string;
  city?: string;
  isOnline?: boolean;
  description?: string;
  about?: string;
  capacity?: number;
  applicationDeadline?: string;
  activityStartAt?: string;
  activityEndAt?: string;
  orgName?: string;
}

const TYPE_LABEL: Record<string, string> = {
  community: "Community",
  education: "Education",
  environment: "Environment",
  health: "Health",
};

function fmt(d?: string): string | null {
  if (!d) return null;
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function Lbl({ field }: { field: FieldDef }) {
  return (
    <>
      {field.label}
      {field.required ? <span aria-hidden> *</span> : null}
    </>
  );
}

function DynamicField({ field }: { field: FieldDef }) {
  const help = field.help ? <p className="hint">{field.help}</p> : null;

  switch (field.type) {
    case "long_text":
      return (
        <div className="field">
          <label><Lbl field={field} /></label>
          <textarea rows={3} placeholder="A few sentences…" readOnly />
          {help}
        </div>
      );
    case "select":
      return (
        <div className="field">
          <label><Lbl field={field} /></label>
          <select defaultValue="">
            <option value="" disabled>Choose one…</option>
            {(field.options ?? []).map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          {help}
        </div>
      );
    case "radio":
      return (
        <fieldset>
          <legend><Lbl field={field} /></legend>
          <div className="checks">
            {(field.options ?? []).map((o) => (
              <label key={o.value}>
                <input type="radio" name={`prev-${field.id}`} disabled />
                <span>{o.label}</span>
              </label>
            ))}
          </div>
          {help}
        </fieldset>
      );
    case "multiselect":
      return (
        <fieldset>
          <legend><Lbl field={field} /></legend>
          <div className="checks checks--inline">
            {(field.options ?? []).map((o) => (
              <label key={o.value}>
                <input type="checkbox" disabled />
                <span>{o.label}</span>
              </label>
            ))}
          </div>
          {help}
        </fieldset>
      );
    case "checkbox":
      return (
        <div>
          <label className="checkline">
            <input type="checkbox" disabled />
            <span><Lbl field={field} /></span>
          </label>
          {help}
        </div>
      );
    case "file":
      return (
        <div className="field">
          <label><Lbl field={field} /></label>
          <label className="upload">
            <span className="upload__btn">Choose file{field.maxFiles && field.maxFiles > 1 ? "s" : ""}</span>
            <span className="upload__name">No file selected</span>
          </label>
          <p className="hint">
            {field.help ??
              `${(field.accept ?? ["PDF, images"]).join(", ")}${field.maxSizeMB ? ` · up to ${field.maxSizeMB} MB` : ""}`}
          </p>
        </div>
      );
    default: {
      const inputType =
        field.type === "email" ? "email" :
        field.type === "phone" ? "tel" :
        field.type === "url" ? "url" :
        field.type === "number" ? "number" :
        field.type === "date" ? "date" : "text";
      return (
        <div className="field">
          <label><Lbl field={field} /></label>
          <input type={inputType} readOnly placeholder={field.type === "url" ? "https://" : ""} />
          {help}
        </div>
      );
    }
  }
}

export function VolunteerApplyPreview({
  opportunity,
  form,
}: {
  opportunity: VolunteerApplyPreviewOpportunity;
  form: FormDefinition;
}) {
  const start = fmt(opportunity.activityStartAt);
  const end = fmt(opportunity.activityEndAt);
  const deadline = fmt(opportunity.applicationDeadline);
  const typeClass = `type-${opportunity.type}`;

  return (
    <div className="yr-vpreview">
      <style>{SCOPED_CSS}</style>

      {/* Opportunity header — mirrors the volunteer opportunity-detail */}
      <div className="vp-detail">
        <p className="vp-org">{opportunity.orgName ?? "Your organisation"}</p>
        <div className="badges">
          <span className={`tag ${typeClass}`}>{TYPE_LABEL[opportunity.type] ?? opportunity.type}</span>
        </div>
        <h1 className="vp-title">{opportunity.name || "Opportunity title"}</h1>
        {opportunity.description && <p className="vp-lead">{opportunity.description}</p>}
        {opportunity.about && <p className="vp-body">{opportunity.about}</p>}
        <dl className="facts">
          <dt>Type</dt>
          <dd>{TYPE_LABEL[opportunity.type] ?? opportunity.type}</dd>
          <dt>Location</dt>
          <dd>{opportunity.isOnline ? "Online" : (opportunity.city || "—")}</dd>
          {(start || end) && (
            <>
              <dt>Dates</dt>
              <dd>{start && end ? `${start} – ${end}` : (start ?? end)}</dd>
            </>
          )}
          {deadline && (
            <>
              <dt>Apply by</dt>
              <dd>{deadline}</dd>
            </>
          )}
          {opportunity.capacity != null && (
            <>
              <dt>Places</dt>
              <dd>{opportunity.capacity}</dd>
            </>
          )}
        </dl>
      </div>

      {/* The apply form the volunteer fills in */}
      <div className="vp-formwrap">
        <h2 className="vp-formtitle">Apply</h2>
        <p className="vp-formsub">
          You&rsquo;re applying to <strong>{opportunity.name || "this opportunity"}</strong>
          {opportunity.orgName ? <> by {opportunity.orgName}</> : null}.
        </p>

        <form className="apply-form" onSubmit={(e) => e.preventDefault()}>
          <div className="grid-2">
            <div className="field">
              <label>Full name</label>
              <input value="From the volunteer&rsquo;s profile" readOnly />
            </div>
            <div className="field">
              <label>Phone</label>
              <input value="From the volunteer&rsquo;s profile" readOnly />
            </div>
          </div>
          <div className="field">
            <label>Email</label>
            <input value="From the volunteer&rsquo;s profile" readOnly />
          </div>

          {form.fields.length === 0 ? (
            <p className="hint">No custom questions yet — add some in the form builder and they&rsquo;ll appear here.</p>
          ) : (
            form.fields.map((f) => <DynamicField key={f.id} field={f} />)
          )}

          <button type="submit" className="btn--primary btn--block" disabled>
            Submit application
          </button>
        </form>
      </div>
    </div>
  );
}

/* Vendored from youth-republic/frontend/app/globals.css, namespaced under
   .yr-vpreview so it can't collide with the admin app's own .field/.btn/etc. */
const SCOPED_CSS = `
.yr-vpreview {
  --blue-strong: #941A80; --blue: #941A80; --blue-hover: #7C1568; --on-blue: #fff;
  --ink: #24262D; --ink-2: #6B6B66; --ink-3: #9A9A93; --placeholder: #9CA3AF;
  --line: #E7E4DC; --bg: #fff; --bg-2: #F7F5EF; --radius-btn: 10px; --radius-card: 12px;
  --t-environment: #079541; --t-health: #E30912; --t-education: #099EE2; --t-community: #F39104;
  font-family: "Jost", ui-sans-serif, system-ui, sans-serif;
  color: var(--ink); background: var(--bg);
  border: 1px solid var(--line); border-radius: var(--radius-card);
  padding: 1.75rem; max-width: 860px;
  display: grid; gap: 1.75rem;
}
@media (min-width: 820px) { .yr-vpreview { grid-template-columns: minmax(0,1fr) 320px; } }
.yr-vpreview .vp-detail { order: 2; }
@media (min-width: 820px) { .yr-vpreview .vp-detail { order: 2; } }
.yr-vpreview .vp-formwrap { order: 1; }
.yr-vpreview .vp-org { font-size: .8rem; color: var(--ink-2); margin: 0 0 .5rem; letter-spacing: .08em; }
.yr-vpreview .badges { margin-bottom: .6rem; }
.yr-vpreview .tag { font: 600 .68rem/1 "Oswald", "Jost", sans-serif; letter-spacing: .1em; text-transform: uppercase; color: #fff; background: var(--type-color, var(--ink)); padding: .4rem .65rem; border-radius: 999px; display: inline-block; }
.yr-vpreview .type-environment { --type-color: var(--t-environment); }
.yr-vpreview .type-health { --type-color: var(--t-health); }
.yr-vpreview .type-education { --type-color: var(--t-education); }
.yr-vpreview .type-community { --type-color: var(--t-community); }
.yr-vpreview .vp-title { font: 700 1.6rem/1.15 "Oswald", "Jost", sans-serif; margin: .2rem 0 .5rem; }
.yr-vpreview .vp-lead { font-size: 1rem; color: var(--ink); margin: 0 0 .75rem; }
.yr-vpreview .vp-body { font-size: .9rem; color: var(--ink-2); margin: 0 0 1rem; white-space: pre-wrap; }
.yr-vpreview .facts { display: grid; grid-template-columns: max-content 1fr; gap: .35rem 1rem; font-size: .88rem; margin: 0; }
.yr-vpreview .facts dt { color: var(--ink-2); }
.yr-vpreview .facts dd { margin: 0; }
.yr-vpreview .vp-formtitle { font: 700 1.5rem/1 "Oswald", "Jost", sans-serif; margin: 0 0 .3rem; }
.yr-vpreview .vp-formsub { color: var(--ink-2); font-size: .9rem; margin: 0 0 1.25rem; }
.yr-vpreview .apply-form { max-width: 520px; width: 100%; }
.yr-vpreview .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0 1rem; }
@media (max-width: 520px) { .yr-vpreview .grid-2 { grid-template-columns: 1fr; } }
.yr-vpreview .field { margin-bottom: 1rem; }
.yr-vpreview .field > label { display: block; font-size: .85rem; font-weight: 500; margin-bottom: .35rem; color: var(--ink); }
.yr-vpreview .field input, .yr-vpreview .field select, .yr-vpreview .field textarea {
  width: 100%; font: inherit; padding: .7rem .85rem; border: 1px solid var(--line);
  border-radius: var(--radius-btn); background: var(--bg); color: var(--ink);
}
.yr-vpreview .field textarea { min-height: 96px; resize: vertical; }
.yr-vpreview .field input[readonly], .yr-vpreview .field textarea[readonly] { background: var(--bg-2); color: var(--ink-2); }
.yr-vpreview .hint { font-size: .8rem; color: var(--ink-2); margin-top: .3rem; }
.yr-vpreview fieldset { border: 0; padding: 0; margin: 0 0 1rem; min-width: 0; }
.yr-vpreview fieldset > legend { font-size: .85rem; font-weight: 500; margin-bottom: .45rem; padding: 0; color: var(--ink); }
.yr-vpreview .checks { display: flex; flex-direction: column; gap: .5rem; }
.yr-vpreview .checks--inline { flex-direction: row; flex-wrap: wrap; gap: .5rem 1.25rem; }
.yr-vpreview .checks label { display: flex; align-items: center; gap: .55rem; font-size: .92rem; font-weight: 400; margin: 0; color: var(--ink); }
.yr-vpreview .checks label input { width: auto; flex-shrink: 0; margin: 0; }
.yr-vpreview .checkline { display: flex; gap: .6rem; align-items: flex-start; font-size: .9rem; margin: .25rem 0 1.25rem; }
.yr-vpreview .checkline input { width: auto; margin: 0; }
.yr-vpreview .upload { display: flex; align-items: center; gap: .6rem; flex-wrap: wrap; width: 100%; margin: 0; font-weight: 400; }
.yr-vpreview .upload__btn { display: inline-flex; align-items: center; line-height: 1; border: 1px solid var(--line); border-radius: var(--radius-btn); padding: .58rem .95rem; font-size: .9rem; font-weight: 500; background: var(--bg); }
.yr-vpreview .upload__name { font-size: .85rem; color: var(--ink-2); }
.yr-vpreview .btn--primary { display: inline-block; width: 100%; text-align: center; background: var(--blue-strong); color: var(--on-blue); border: 0; border-radius: var(--radius-btn); padding: .8rem 1rem; font: 600 .95rem/1 "Jost", sans-serif; cursor: not-allowed; opacity: .9; }
.yr-vpreview .btn--block { width: 100%; }
`;

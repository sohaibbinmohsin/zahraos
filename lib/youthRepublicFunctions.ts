import type { FormDefinition } from "./forms";

// Most Youth Republic reads finish well under 8s. decide-application is
// slower: Select writes participation, refreshes the volunteer index, and
// (until the youth-republic waitUntil fix) awaits a status email. Eight
// seconds was aborting successful Selects and surfacing "Fetch is aborted"
// even when the server had already committed (zahraos#52).
const DEFAULT_TIMEOUT_MS = 8_000;
const DECIDE_APPLICATION_TIMEOUT_MS = 60_000;
const RECONCILE_PAUSE_MS = 500;

const SLOW_MUTATIONS = new Set(["decide-application"]);

export class YouthRepublicRequestTimeoutError extends Error {
  constructor() {
    super(
      "The request timed out before the server finished. Refresh the page and check whether the change was saved.",
    );
    this.name = "YouthRepublicRequestTimeoutError";
  }
}

export function isYouthRepublicAbortError(err: unknown): boolean {
  if (err instanceof YouthRepublicRequestTimeoutError) return true;
  if (err instanceof DOMException && (err.name === "TimeoutError" || err.name === "AbortError")) return true;
  if (
    err instanceof Error &&
    /signal timed out|aborted due to timeout|The operation was aborted|Fetch is aborted|The user aborted a request/i.test(
      err.message,
    )
  ) {
    return true;
  }
  return false;
}

function timeoutMsFor(name: string): number {
  return SLOW_MUTATIONS.has(name) ? DECIDE_APPLICATION_TIMEOUT_MS : DEFAULT_TIMEOUT_MS;
}

async function callYouthRepublicFunction<TResponse>(
  name: string,
  body: unknown,
  staffToken: string,
  timeoutMs: number = timeoutMsFor(name),
): Promise<TResponse> {
  const baseUrl = process.env.NEXT_PUBLIC_YOUTH_REPUBLIC_FUNCTIONS_URL;
  if (!baseUrl) {
    throw new Error("NEXT_PUBLIC_YOUTH_REPUBLIC_FUNCTIONS_URL is not set");
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/${name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${staffToken}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    if (isYouthRepublicAbortError(err)) {
      throw new YouthRepublicRequestTimeoutError();
    }
    throw err;
  }

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "request_failed");
  }
  return data as TResponse;
}

async function callYouthRepublicFunctionForCsv(name: string, body: unknown, staffToken: string): Promise<string> {
  const baseUrl = process.env.NEXT_PUBLIC_YOUTH_REPUBLIC_FUNCTIONS_URL;
  if (!baseUrl) {
    throw new Error("NEXT_PUBLIC_YOUTH_REPUBLIC_FUNCTIONS_URL is not set");
  }

  const response = await fetch(`${baseUrl}/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${staffToken}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error ?? "request_failed");
  }
  return response.text();
}

export interface VolunteerSummary {
  id: string;
  volunteerCode: string;
  fullName: string;
  email: string;
  phone: string;
  city: string;
  province: string;
  institution: string;
  status: string;
}
export interface ListVolunteersPayload {
  organizationId: string;
  search?: string;
  city?: string;
  province?: string;
  institution?: string;
  status?: string;
  limit?: number;
  offset?: number;
}
export interface ListVolunteersResponse {
  volunteers: VolunteerSummary[];
  total: number;
}
export function listVolunteers(payload: ListVolunteersPayload, staffToken: string) {
  return callYouthRepublicFunction<ListVolunteersResponse>("list-volunteers", payload, staffToken);
}

export interface VolunteerDetail extends VolunteerSummary {
  applications: Array<{
    id: string; status: string; opportunityName: string; appliedAt: string;
    answers: Record<string, unknown>; formSnapshot: unknown;
  }>;
  participations: Array<{ id: string; status: string; opportunityName: string }>;
  activity: Array<{
    id: string; role: string | null; activityDate: string; hoursSubmitted: number;
    hoursVerified: number | null; verificationStatus: string; adminNotes: string | null;
    note: string | null; adjusted: boolean; photoAttachmentIds: string[]; opportunityName: string;
  }>;
}
export function getVolunteerDetail(payload: { organizationId: string; volunteerId: string }, staffToken: string) {
  return callYouthRepublicFunction<VolunteerDetail>("get-volunteer-detail", payload, staffToken);
}

// Mirrors OpportunityCard from youth-republic list-opportunities/handler.ts.
export interface OpportunitySummary {
  id: string;
  name: string;
  orgName: string;
  orgLogoUrl: string | null;
  type: string;
  chapterId?: string | null;
  city: string | null;
  venue?: string | null;
  online: boolean;
  computedStatus: string;
  description: string | null;
  capacity: number | null;
  filledCount: number;
  applicationDeadline: string | null;
  activityStartAt: string | null;
  activityEndAt: string | null;
  deactivatedAt: string | null;
  impactStats?: Record<string, unknown> | null;
  coverImageUrl?: string | null;
}
export interface ListOpportunitiesPayload {
  organizationId: string;
  type?: string;
  status?: string;
  online?: boolean;
  city?: string;
  search?: string;
  sort?: "newest" | "closing_soon" | "az";
  limit?: number;
  offset?: number;
}
export interface ListOpportunitiesResponse {
  opportunities: OpportunitySummary[];
  total: number;
  facets: {
    cities: string[];
    orgs: { id: string; name: string }[];
  };
}
export function listOpportunities(payload: ListOpportunitiesPayload, staffToken: string) {
  return callYouthRepublicFunction<ListOpportunitiesResponse>("list-opportunities", payload, staffToken);
}

// Full record for the edit form — one opportunity with all its content and the
// application form. From youth-republic get-opportunity-detail.
export interface OpportunityDetail {
  id: string;
  name: string;
  description: string | null;
  about: string | null;
  duties: string[];
  eligibility: string[];
  whatToBring: string[];
  type: string;
  chapterId?: string | null;
  location: string | null;
  city?: string | null;
  venue?: string | null;
  isOnline: boolean;
  applicationOpenAt: string | null;
  applicationDeadline: string | null;
  activityStartAt: string | null;
  activityEndAt: string | null;
  capacity: number | null;
  computedStatus: string;
  orgId: string;
  orgName: string;
  orgAbout: string | null;
  orgLogoUrl: string | null;
  applicationForm: FormDefinition;
  impactStats?: Record<string, unknown> | null;
  coverImageUrl?: string | null;
}
export function getOpportunityDetail(payload: { opportunityId: string }, staffToken: string) {
  return callYouthRepublicFunction<OpportunityDetail>("get-opportunity-detail", payload, staffToken);
}

export interface ParticipationForOpportunityResponse {
  applicants: Array<{
    applicationId: string;
    volunteerId: string;
    volunteerCode?: string | null;
    volunteerName: string;
    status: string;
    appliedAt: string;
  }>;
  participants: Array<{
    participationId: string;
    volunteerId: string;
    volunteerCode?: string | null;
    volunteerName: string;
    status: string;
  }>;
}
export function listParticipationForOpportunity(
  payload: { organizationId: string; opportunityId: string },
  staffToken: string,
) {
  return callYouthRepublicFunction<ParticipationForOpportunityResponse>("list-participation-for-opportunity", payload, staffToken);
}

export interface ApplicationListRow {
  id: string;
  volunteerId: string;
  volunteerCode?: string | null;
  volunteerName: string;
  opportunityId: string;
  opportunityName: string;
  status: string;
  appliedAt: string;
  applicantName: string | null;
  applicantEmail: string | null;
  applicantPhone: string | null;
  /** volunteers.status: pending_verification | active | inactive. Active means identity was verified. */
  volunteerStatus?: string | null;
  /** volunteers.id_doc_type: cnic | b_form | passport. */
  idDocType?: string | null;
  answers: Record<string, unknown>;
  formSnapshot: unknown;
  attachmentIdsByField: Record<string, string[]>;
}
export interface ListApplicationsPayload {
  organizationId: string;
  opportunityId?: string;
  status?: string;
  limit?: number;
  offset?: number;
}
export interface ListApplicationsResponse {
  applications: ApplicationListRow[];
  total: number;
}
export function listApplications(payload: ListApplicationsPayload, staffToken: string) {
  return callYouthRepublicFunction<ListApplicationsResponse>("list-applications", payload, staffToken);
}

export interface ActivityListRow {
  id: string;
  volunteerCode?: string | null;
  volunteerName: string;
  opportunityName: string;
  activityType: string;
  role: string | null;
  activityDate: string;
  hoursSubmitted: number;
  hoursVerified: number | null;
  verificationStatus: string;
  adminNotes: string | null;
}
export interface ListActivityHoursPayload {
  organizationId: string;
  activityType?: string;
  participationStatus?: string;
  limit?: number;
  offset?: number;
}
export interface ListActivityHoursResponse {
  activity: ActivityListRow[];
  total: number;
}
export function listActivityHours(payload: ListActivityHoursPayload, staffToken: string) {
  return callYouthRepublicFunction<ListActivityHoursResponse>("list-activity-hours", payload, staffToken);
}

export interface KpiSummary {
  totalRegistered: number;
  active: number;
  completedParticipations: number;
  applicationsReceived: number;
  selected: number;
  totalVerifiedHours: number;
  byCity: Record<string, number>;
  byProvince: Record<string, number>;
  byInstitution: Record<string, number>;
  participationByOpportunity: Record<string, number>;
  participationByActivityType: Record<string, number>;
}
export function getKpiSummary(payload: { organizationId: string }, staffToken: string) {
  return callYouthRepublicFunction<KpiSummary>("get-kpi-summary", payload, staffToken);
}

export interface CreateOpportunityPayload {
  organizationId: string;
  name: string;
  type: string;
  chapterId?: string | null;
  description?: string;
  location?: string | null;
  city?: string | null;
  venue?: string | null;
  isOnline?: boolean;
  applicationOpenAt?: string;
  applicationDeadline?: string;
  activityStartAt?: string;
  activityEndAt?: string | null;
  about?: string;
  duties?: string[];
  eligibility?: string[];
  whatToBring?: string[];
  applicationForm?: FormDefinition;
  capacity?: number | null;
  /** e.g. "draft" to create the opportunity hidden from the noticeboard. */
  statusOverride?: string;
  coverImageUrl?: string | null;
}
export function createOpportunity(payload: CreateOpportunityPayload, staffToken: string) {
  return callYouthRepublicFunction<{ opportunityId: string }>("create-opportunity", payload, staffToken);
}

export interface UpdateOpportunityPayload {
  opportunityId: string;
  organizationId: string;
  name?: string;
  type?: string;
  chapterId?: string | null;
  description?: string;
  location?: string | null;
  city?: string | null;
  venue?: string | null;
  isOnline?: boolean;
  applicationOpenAt?: string;
  applicationDeadline?: string;
  activityStartAt?: string;
  activityEndAt?: string | null;
  about?: string;
  duties?: string[];
  eligibility?: string[];
  whatToBring?: string[];
  applicationForm?: FormDefinition;
  capacity?: number | null;
  statusOverride?: string;
  deactivatedAt?: string | null;
  hardDelete?: boolean;
  impactStats?: Record<string, unknown> | null;
  coverImageUrl?: string | null;
}
export function updateOpportunity(payload: UpdateOpportunityPayload, staffToken: string) {
  return callYouthRepublicFunction<{ opportunityId: string }>("update-opportunity", payload, staffToken);
}

// Dedicated application-form editor. Separate from updateOpportunity because it
// carries its own permission (opportunities:manage) and audit action.
export interface UpdateOpportunityFormPayload {
  opportunityId: string;
  form: FormDefinition;
}
export function updateOpportunityForm(payload: UpdateOpportunityFormPayload, staffToken: string) {
  return callYouthRepublicFunction<{ ok: true }>("update-opportunity-form", payload, staffToken);
}

// Central identity-review action — gated by the caller's can_verify_identity
// claim, not a per-org permission. `reason` is required by the handler when
// decision is "reject".
export interface VerifyVolunteerPayload {
  volunteerId: string;
  decision: "verify" | "reject";
  reason?: string;
}
export function verifyVolunteer(payload: VerifyVolunteerPayload, staffToken: string) {
  return callYouthRepublicFunction<{ status: string }>("verify-volunteer", payload, staffToken);
}

export interface PendingVolunteer {
  id: string;
  volunteerCode: string;
  fullName: string;
  dob: string;
  idDocType: string | null;
  idDocNumber: string | null;
  city: string;
  institution: string;
  submittedAt: string;
  idDocAttachmentId: string | null;
}
export interface ListPendingVolunteersPayload {
  limit?: number;
  offset?: number;
  search?: string;
}
export interface ListPendingVolunteersResponse {
  volunteers: PendingVolunteer[];
  total: number;
}
export function listPendingVolunteers(payload: ListPendingVolunteersPayload, staffToken: string) {
  return callYouthRepublicFunction<ListPendingVolunteersResponse>("list-pending-volunteers", payload, staffToken);
}

// Returns a short-lived signed download URL for one attachment (identity docs,
// application files, session photos).
export interface GetAttachmentPayload {
  attachmentId: string;
}
export function getAttachment(payload: GetAttachmentPayload, staffToken: string) {
  return callYouthRepublicFunction<{ url: string }>("get-attachment", payload, staffToken);
}

// organizationId is not sent to the Edge Function — the handler derives the
// org from the application row (cross-tenant-trust fix). The optional
// `organizationId` on DecideApplicationOptions is client-only: after a
// timeout/abort we re-list applications for that org to see whether the
// server still committed the decision.
export interface DecideApplicationPayload {
  applicationId: string;
  // "pending_review" is the "reconsider" path — moves a decided application
  // back into the triage queue.
  decision: "selected" | "waitlisted" | "rejected" | "pending_review";
}
export interface DecideApplicationResponse {
  applicationId: string;
  participationId: string | null;
}
export interface DecideApplicationOptions {
  /** Used only to reconcile UI state after a client abort/timeout. */
  organizationId?: string;
}

/**
 * After the client aborts, the Edge Function often keeps running. Re-fetch
 * applications filtered to the requested decision and treat a matching row as
 * success so we do not show a hard failure (or invite a duplicate retry) when
 * the write already landed.
 */
async function reconcileDecideAfterTimeout(
  payload: DecideApplicationPayload,
  staffToken: string,
  organizationId: string,
): Promise<DecideApplicationResponse | null> {
  await new Promise((resolve) => setTimeout(resolve, RECONCILE_PAUSE_MS));

  // Prefer a status-filtered list so a newly decided row is more likely to
  // appear even when the org has many applications (list default is 25).
  // Always check `status` on the row — do not trust the filter alone.
  const filtered = await callYouthRepublicFunction<ListApplicationsResponse>(
    "list-applications",
    { organizationId, status: payload.decision, limit: 100 },
    staffToken,
    DEFAULT_TIMEOUT_MS,
  );
  const filteredMatch = filtered.applications.find((a) => a.id === payload.applicationId);
  if (filteredMatch?.status === payload.decision) {
    return { applicationId: payload.applicationId, participationId: null };
  }

  // Fallback: unfiltered page in case the status-filtered page missed the row
  // (pagination) or the filter was a no-op.
  const broad = await callYouthRepublicFunction<ListApplicationsResponse>(
    "list-applications",
    { organizationId, limit: 100 },
    staffToken,
    DEFAULT_TIMEOUT_MS,
  );
  const row = broad.applications.find((a) => a.id === payload.applicationId);
  if (row?.status === payload.decision) {
    return { applicationId: payload.applicationId, participationId: null };
  }
  return null;
}

export async function decideApplication(
  payload: DecideApplicationPayload,
  staffToken: string,
  options?: DecideApplicationOptions,
): Promise<DecideApplicationResponse> {
  try {
    return await callYouthRepublicFunction<DecideApplicationResponse>(
      "decide-application",
      payload,
      staffToken,
    );
  } catch (err) {
    if (!isYouthRepublicAbortError(err)) throw err;
    if (!options?.organizationId) throw new YouthRepublicRequestTimeoutError();

    try {
      const reconciled = await reconcileDecideAfterTimeout(
        payload,
        staffToken,
        options.organizationId,
      );
      if (reconciled) return reconciled;
    } catch {
      // Reconcile fetch failed — fall through to the timeout error.
    }
    throw new YouthRepublicRequestTimeoutError();
  }
}

// decision is required — the handler has no separate "verify" vs "reject"
// endpoint, one call does both depending on this field. No organizationId
// (same reason as decideApplication) and no adminNotes param exists on this
// handler today.
export interface VerifyHoursPayload {
  activityHoursId: string;
  decision: "verified" | "rejected";
  hoursVerified?: number;
  rejectionReason?: string;
}
export function verifyHours(payload: VerifyHoursPayload, staffToken: string) {
  return callYouthRepublicFunction<{ activityHoursId: string }>("verify-hours", payload, staffToken);
}

// Assigns hours to a specific set of participations, not "everyone in this
// opportunity" — participationIds is how the caller picks who's included.
export interface BulkAssignHoursPayload {
  organizationId: string;
  opportunityId: string;
  activityDate: string;
  hoursSubmitted: number;
  participationIds: string[];
}
export function bulkAssignHours(payload: BulkAssignHoursPayload, staffToken: string) {
  return callYouthRepublicFunction<{ createdCount: number }>("bulk-assign-hours", payload, staffToken);
}

export function exportYouthRepublicCsv(payload: { organizationId: string; entity: "volunteers" | "applications" | "opportunities" | "activity_hours" }, staffToken: string) {
  return callYouthRepublicFunctionForCsv("export-csv", payload, staffToken);
}

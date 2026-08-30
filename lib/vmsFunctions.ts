async function callVmsFunction<TResponse>(name: string, body: unknown, staffToken: string): Promise<TResponse> {
  const baseUrl = process.env.NEXT_PUBLIC_VMS_FUNCTIONS_URL;
  if (!baseUrl) {
    throw new Error("NEXT_PUBLIC_VMS_FUNCTIONS_URL is not set");
  }

  const response = await fetch(`${baseUrl}/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${staffToken}`,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "request_failed");
  }
  return data as TResponse;
}

async function callVmsFunctionForCsv(name: string, body: unknown, staffToken: string): Promise<string> {
  const baseUrl = process.env.NEXT_PUBLIC_VMS_FUNCTIONS_URL;
  if (!baseUrl) {
    throw new Error("NEXT_PUBLIC_VMS_FUNCTIONS_URL is not set");
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
  return callVmsFunction<ListVolunteersResponse>("list-volunteers", payload, staffToken);
}

export interface VolunteerDetail extends VolunteerSummary {
  applications: Array<{ id: string; status: string; opportunityName: string; appliedAt: string }>;
  participations: Array<{ id: string; status: string; opportunityName: string }>;
  activity: Array<{
    id: string; role: string | null; activityDate: string; hoursSubmitted: number;
    hoursVerified: number | null; verificationStatus: string; adminNotes: string | null; opportunityName: string;
  }>;
}
export function getVolunteerDetail(payload: { organizationId: string; volunteerId: string }, staffToken: string) {
  return callVmsFunction<VolunteerDetail>("get-volunteer-detail", payload, staffToken);
}

export interface OpportunitySummary {
  id: string;
  name: string;
  type: string;
  computedStatus: string;
  capacity: number | null;
}
export interface ListOpportunitiesPayload {
  organizationId: string;
  type?: string;
  status?: string;
  limit?: number;
  offset?: number;
}
export interface ListOpportunitiesResponse {
  opportunities: OpportunitySummary[];
  total: number;
}
export function listOpportunities(payload: ListOpportunitiesPayload, staffToken: string) {
  return callVmsFunction<ListOpportunitiesResponse>("list-opportunities", payload, staffToken);
}

export interface ParticipationForOpportunityResponse {
  applicants: Array<{ applicationId: string; volunteerId: string; volunteerName: string; status: string; appliedAt: string }>;
  participants: Array<{ participationId: string; volunteerId: string; volunteerName: string; status: string }>;
}
export function listParticipationForOpportunity(
  payload: { organizationId: string; opportunityId: string },
  staffToken: string,
) {
  return callVmsFunction<ParticipationForOpportunityResponse>("list-participation-for-opportunity", payload, staffToken);
}

export interface ApplicationListRow {
  id: string;
  volunteerId: string;
  volunteerName: string;
  opportunityId: string;
  opportunityName: string;
  status: string;
  appliedAt: string;
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
  return callVmsFunction<ListApplicationsResponse>("list-applications", payload, staffToken);
}

export interface ActivityListRow {
  id: string;
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
  return callVmsFunction<ListActivityHoursResponse>("list-activity-hours", payload, staffToken);
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
  return callVmsFunction<KpiSummary>("get-kpi-summary", payload, staffToken);
}

export interface CreateOpportunityPayload {
  organizationId: string;
  name: string;
  type: string;
  description?: string;
  location?: string;
  isOnline?: boolean;
  applicationOpenAt?: string;
  applicationDeadline?: string;
  activityStartAt?: string;
  activityEndAt?: string;
  eligibilityCriteria?: string;
  capacity?: number;
}
export function createOpportunity(payload: CreateOpportunityPayload, staffToken: string) {
  return callVmsFunction<{ opportunityId: string }>("create-opportunity", payload, staffToken);
}

export interface UpdateOpportunityPayload {
  opportunityId: string;
  organizationId: string;
  name?: string;
  description?: string;
  location?: string;
  isOnline?: boolean;
  applicationOpenAt?: string;
  applicationDeadline?: string;
  activityStartAt?: string;
  activityEndAt?: string;
  eligibilityCriteria?: string;
  capacity?: number;
  statusOverride?: string;
  deactivatedAt?: string | null;
}
export function updateOpportunity(payload: UpdateOpportunityPayload, staffToken: string) {
  return callVmsFunction<{ opportunityId: string }>("update-opportunity", payload, staffToken);
}

// No organizationId here — decideApplication derives it from the
// application row itself server-side (the cross-tenant-trust fix from the
// earlier review), so there's nothing for the client to pass or trust.
export interface DecideApplicationPayload {
  applicationId: string;
  decision: "selected" | "waitlisted" | "rejected" | "under_review";
}
export interface DecideApplicationResponse {
  applicationId: string;
  participationId: string | null;
}
export function decideApplication(payload: DecideApplicationPayload, staffToken: string) {
  return callVmsFunction<DecideApplicationResponse>("decide-application", payload, staffToken);
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
  return callVmsFunction<{ activityHoursId: string }>("verify-hours", payload, staffToken);
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
  return callVmsFunction<{ createdCount: number }>("bulk-assign-hours", payload, staffToken);
}

export function exportVmsCsv(payload: { organizationId: string; entity: "volunteers" | "applications" | "opportunities" | "activity_hours" }, staffToken: string) {
  return callVmsFunctionForCsv("export-csv", payload, staffToken);
}

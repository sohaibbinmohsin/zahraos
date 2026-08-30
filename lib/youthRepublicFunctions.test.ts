import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  listVolunteers,
  getVolunteerDetail,
  listOpportunities,
  listParticipationForOpportunity,
  listApplications,
  listActivityHours,
  getKpiSummary,
  createOpportunity,
  updateOpportunity,
  updateOpportunityForm,
  verifyVolunteer,
  listPendingVolunteers,
  getAttachment,
  decideApplication,
  verifyHours,
  bulkAssignHours,
  exportYouthRepublicCsv,
} from "./youthRepublicFunctions";

const YOUTH_REPUBLIC_FUNCTIONS_URL = "http://localhost:54322/functions/v1";
const STAFF_TOKEN = "staff-jwt-token";

beforeEach(() => {
  process.env.NEXT_PUBLIC_YOUTH_REPUBLIC_FUNCTIONS_URL = YOUTH_REPUBLIC_FUNCTIONS_URL;
  vi.stubGlobal("fetch", vi.fn());
});

function mockOk(body: unknown) {
  vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => body } as Response);
}

function mockOkText(body: string) {
  vi.mocked(fetch).mockResolvedValue({ ok: true, text: async () => body } as Response);
}

describe("youthRepublicFunctions", () => {
  it("listVolunteers posts to list-volunteers with the staff token", async () => {
    mockOk({ volunteers: [], total: 0 });
    const result = await listVolunteers({ organizationId: "org-1" }, STAFF_TOKEN);
    expect(fetch).toHaveBeenCalledWith(
      `${YOUTH_REPUBLIC_FUNCTIONS_URL}/list-volunteers`,
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: `Bearer ${STAFF_TOKEN}` }),
        body: JSON.stringify({ organizationId: "org-1" }),
      }),
    );
    expect(result).toEqual({ volunteers: [], total: 0 });
  });

  it("getVolunteerDetail posts to get-volunteer-detail", async () => {
    mockOk({ id: "vol-1" });
    await getVolunteerDetail({ organizationId: "org-1", volunteerId: "vol-1" }, STAFF_TOKEN);
    expect(fetch).toHaveBeenCalledWith(`${YOUTH_REPUBLIC_FUNCTIONS_URL}/get-volunteer-detail`, expect.anything());
  });

  it("listOpportunities posts to list-opportunities", async () => {
    mockOk({ opportunities: [], total: 0 });
    await listOpportunities({ organizationId: "org-1" }, STAFF_TOKEN);
    expect(fetch).toHaveBeenCalledWith(`${YOUTH_REPUBLIC_FUNCTIONS_URL}/list-opportunities`, expect.anything());
  });

  it("listParticipationForOpportunity posts to list-participation-for-opportunity", async () => {
    mockOk({ applicants: [], participants: [] });
    await listParticipationForOpportunity({ organizationId: "org-1", opportunityId: "opp-1" }, STAFF_TOKEN);
    expect(fetch).toHaveBeenCalledWith(`${YOUTH_REPUBLIC_FUNCTIONS_URL}/list-participation-for-opportunity`, expect.anything());
  });

  it("listApplications posts to list-applications", async () => {
    mockOk({ applications: [], total: 0 });
    await listApplications({ organizationId: "org-1" }, STAFF_TOKEN);
    expect(fetch).toHaveBeenCalledWith(`${YOUTH_REPUBLIC_FUNCTIONS_URL}/list-applications`, expect.anything());
  });

  it("listActivityHours posts to list-activity-hours", async () => {
    mockOk({ activity: [], total: 0 });
    await listActivityHours({ organizationId: "org-1" }, STAFF_TOKEN);
    expect(fetch).toHaveBeenCalledWith(`${YOUTH_REPUBLIC_FUNCTIONS_URL}/list-activity-hours`, expect.anything());
  });

  it("getKpiSummary posts to get-kpi-summary", async () => {
    mockOk({ totalRegistered: 0 });
    await getKpiSummary({ organizationId: "org-1" }, STAFF_TOKEN);
    expect(fetch).toHaveBeenCalledWith(`${YOUTH_REPUBLIC_FUNCTIONS_URL}/get-kpi-summary`, expect.anything());
  });

  it("createOpportunity posts to create-opportunity with the content arrays and applicationForm", async () => {
    mockOk({ opportunityId: "opp-1" });
    const form = { version: 1 as const, fields: [{ id: "why", type: "long_text" as const, label: "Why?" }] };
    await createOpportunity(
      {
        organizationId: "org-1",
        name: "Test",
        type: "environment",
        about: "About this drive",
        duties: ["Pick litter", "Sort recycling"],
        eligibility: ["16+"],
        whatToBring: ["Gloves"],
        applicationForm: form,
      },
      STAFF_TOKEN,
    );
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${YOUTH_REPUBLIC_FUNCTIONS_URL}/create-opportunity`);
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.about).toBe("About this drive");
    expect(body.duties).toEqual(["Pick litter", "Sort recycling"]);
    expect(body.eligibility).toEqual(["16+"]);
    expect(body.whatToBring).toEqual(["Gloves"]);
    expect(body.applicationForm).toEqual(form);
    expect(body).not.toHaveProperty("eligibilityCriteria");
  });

  it("updateOpportunity posts to update-opportunity with the new content fields", async () => {
    mockOk({ opportunityId: "opp-1" });
    await updateOpportunity(
      {
        opportunityId: "opp-1",
        organizationId: "org-1",
        name: "Renamed",
        about: "Updated about",
        duties: ["New duty"],
        eligibility: ["18+"],
        whatToBring: ["ID card"],
        applicationForm: { version: 1, fields: [] },
      },
      STAFF_TOKEN,
    );
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${YOUTH_REPUBLIC_FUNCTIONS_URL}/update-opportunity`);
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.about).toBe("Updated about");
    expect(body.duties).toEqual(["New duty"]);
    expect(body.eligibility).toEqual(["18+"]);
    expect(body.whatToBring).toEqual(["ID card"]);
    expect(body.applicationForm).toEqual({ version: 1, fields: [] });
    expect(body).not.toHaveProperty("eligibilityCriteria");
  });

  it("updateOpportunityForm posts { opportunityId, form } to update-opportunity-form and parses { ok: true }", async () => {
    mockOk({ ok: true });
    const form = { version: 1 as const, fields: [{ id: "why", type: "long_text" as const, label: "Why?" }] };
    const result = await updateOpportunityForm({ opportunityId: "opp-1", form }, STAFF_TOKEN);
    expect(result).toEqual({ ok: true });
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${YOUTH_REPUBLIC_FUNCTIONS_URL}/update-opportunity-form`);
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ opportunityId: "opp-1", form });
  });

  it("verifyVolunteer posts { volunteerId, decision, reason } to verify-volunteer and parses { status }", async () => {
    mockOk({ status: "active" });
    const result = await verifyVolunteer({ volunteerId: "vol-1", decision: "verify" }, STAFF_TOKEN);
    expect(result).toEqual({ status: "active" });
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${YOUTH_REPUBLIC_FUNCTIONS_URL}/verify-volunteer`);
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ volunteerId: "vol-1", decision: "verify" });

    mockOk({ status: "pending_verification" });
    await verifyVolunteer({ volunteerId: "vol-1", decision: "reject", reason: "blurry scan" }, STAFF_TOKEN);
    expect(JSON.parse((vi.mocked(fetch).mock.calls[1][1] as RequestInit).body as string)).toEqual({
      volunteerId: "vol-1",
      decision: "reject",
      reason: "blurry scan",
    });
  });

  it("listPendingVolunteers posts filters to list-pending-volunteers and parses PendingVolunteer rows", async () => {
    const row = {
      id: "vol-1",
      volunteerCode: "VOL-2026-000001",
      fullName: "Aisha",
      dob: "2001-05-01",
      idDocType: "cnic",
      idDocNumber: "35201-1234567-1",
      city: "Lahore",
      institution: "IBA",
      submittedAt: "2026-08-01T00:00:00Z",
      idDocAttachmentId: "att-1",
    };
    mockOk({ volunteers: [row], total: 1 });
    const result = await listPendingVolunteers({ limit: 10, offset: 0, search: "aisha" }, STAFF_TOKEN);
    expect(result).toEqual({ volunteers: [row], total: 1 });
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${YOUTH_REPUBLIC_FUNCTIONS_URL}/list-pending-volunteers`);
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ limit: 10, offset: 0, search: "aisha" });
  });

  it("getAttachment posts { attachmentId } to get-attachment and parses { url }", async () => {
    mockOk({ url: "https://storage/get/x" });
    const result = await getAttachment({ attachmentId: "att-1" }, STAFF_TOKEN);
    expect(result).toEqual({ url: "https://storage/get/x" });
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${YOUTH_REPUBLIC_FUNCTIONS_URL}/get-attachment`);
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ attachmentId: "att-1" });
  });

  it("listApplications parses the projected applicant / answers / attachment fields", async () => {
    const appRow = {
      id: "app-1",
      volunteerId: "vol-1",
      volunteerName: "Aisha",
      opportunityId: "opp-1",
      opportunityName: "Beach Cleanup",
      status: "submitted",
      appliedAt: "2026-08-01T00:00:00Z",
      applicantName: "Aisha Khan",
      applicantEmail: "aisha@example.com",
      applicantPhone: "0300-1234567",
      answers: { why: "I care", cv: ["att-9"] },
      formSnapshot: { version: 1, fields: [{ id: "cv", type: "file", label: "CV" }] },
      attachmentIdsByField: { cv: ["att-9"] },
    };
    mockOk({ applications: [appRow], total: 1 });
    const result = await listApplications({ organizationId: "org-1" }, STAFF_TOKEN);
    expect(result.applications[0]).toEqual(appRow);
  });

  it("getVolunteerDetail parses answers/formSnapshot on applications and note/adjusted/photoAttachmentIds on activity", async () => {
    const detail = {
      id: "vol-1",
      volunteerCode: "VOL-2026-000001",
      fullName: "Aisha",
      email: "aisha@example.com",
      phone: "0300-1234567",
      city: "Lahore",
      province: "Punjab",
      institution: "IBA",
      status: "active",
      applications: [
        {
          id: "app-1",
          status: "selected",
          opportunityName: "Beach Cleanup",
          appliedAt: "2026-08-01T00:00:00Z",
          answers: { why: "I care" },
          formSnapshot: { version: 1, fields: [] },
        },
      ],
      participations: [{ id: "p-1", status: "active", opportunityName: "Beach Cleanup" }],
      activity: [
        {
          id: "ah-1",
          role: "Lead",
          activityDate: "2026-08-02",
          hoursSubmitted: 4,
          hoursVerified: 3,
          verificationStatus: "verified",
          adminNotes: "trimmed",
          note: "Morning shift",
          adjusted: true,
          photoAttachmentIds: ["ph-1"],
          opportunityName: "Beach Cleanup",
        },
      ],
    };
    mockOk(detail);
    const result = await getVolunteerDetail({ organizationId: "org-1", volunteerId: "vol-1" }, STAFF_TOKEN);
    expect(result).toEqual(detail);
  });

  it("decideApplication posts to decide-application (no organizationId — the handler derives it from the application row itself)", async () => {
    mockOk({ applicationId: "app-1", participationId: null });
    await decideApplication({ applicationId: "app-1", decision: "selected" }, STAFF_TOKEN);
    expect(fetch).toHaveBeenCalledWith(
      `${YOUTH_REPUBLIC_FUNCTIONS_URL}/decide-application`,
      expect.objectContaining({ body: JSON.stringify({ applicationId: "app-1", decision: "selected" }) }),
    );
  });

  it("verifyHours posts to verify-hours with a required decision field", async () => {
    mockOk({ activityHoursId: "ah-1" });
    await verifyHours({ activityHoursId: "ah-1", decision: "verified", hoursVerified: 5 }, STAFF_TOKEN);
    expect(fetch).toHaveBeenCalledWith(
      `${YOUTH_REPUBLIC_FUNCTIONS_URL}/verify-hours`,
      expect.objectContaining({ body: JSON.stringify({ activityHoursId: "ah-1", decision: "verified", hoursVerified: 5 }) }),
    );
  });

  it("bulkAssignHours posts to bulk-assign-hours with a specific list of participation ids", async () => {
    mockOk({ createdCount: 3 });
    await bulkAssignHours(
      { organizationId: "org-1", opportunityId: "opp-1", activityDate: "2026-02-01", hoursSubmitted: 3, participationIds: ["p-1", "p-2", "p-3"] },
      STAFF_TOKEN,
    );
    expect(fetch).toHaveBeenCalledWith(`${YOUTH_REPUBLIC_FUNCTIONS_URL}/bulk-assign-hours`, expect.anything());
  });

  it("exportYouthRepublicCsv posts to export-csv and returns the raw CSV text, not parsed JSON", async () => {
    mockOkText("name,type\nTest Opp,environment\n");
    const csv = await exportYouthRepublicCsv({ organizationId: "org-1", entity: "opportunities" }, STAFF_TOKEN);
    expect(fetch).toHaveBeenCalledWith(`${YOUTH_REPUBLIC_FUNCTIONS_URL}/export-csv`, expect.anything());
    expect(csv).toBe("name,type\nTest Opp,environment\n");
  });

  it("throws the server's error message when a JSON call fails", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, json: async () => ({ error: "forbidden" }) } as Response);
    await expect(listVolunteers({ organizationId: "org-1" }, STAFF_TOKEN)).rejects.toThrow("forbidden");
  });
});

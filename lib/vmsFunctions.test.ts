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
  decideApplication,
  verifyHours,
  bulkAssignHours,
  exportVmsCsv,
} from "./vmsFunctions";

const VMS_FUNCTIONS_URL = "http://localhost:54322/functions/v1";
const STAFF_TOKEN = "staff-jwt-token";

beforeEach(() => {
  process.env.NEXT_PUBLIC_VMS_FUNCTIONS_URL = VMS_FUNCTIONS_URL;
  vi.stubGlobal("fetch", vi.fn());
});

function mockOk(body: unknown) {
  vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => body } as Response);
}

function mockOkText(body: string) {
  vi.mocked(fetch).mockResolvedValue({ ok: true, text: async () => body } as Response);
}

describe("vmsFunctions", () => {
  it("listVolunteers posts to list-volunteers with the staff token", async () => {
    mockOk({ volunteers: [], total: 0 });
    const result = await listVolunteers({ organizationId: "org-1" }, STAFF_TOKEN);
    expect(fetch).toHaveBeenCalledWith(
      `${VMS_FUNCTIONS_URL}/list-volunteers`,
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
    expect(fetch).toHaveBeenCalledWith(`${VMS_FUNCTIONS_URL}/get-volunteer-detail`, expect.anything());
  });

  it("listOpportunities posts to list-opportunities", async () => {
    mockOk({ opportunities: [], total: 0 });
    await listOpportunities({ organizationId: "org-1" }, STAFF_TOKEN);
    expect(fetch).toHaveBeenCalledWith(`${VMS_FUNCTIONS_URL}/list-opportunities`, expect.anything());
  });

  it("listParticipationForOpportunity posts to list-participation-for-opportunity", async () => {
    mockOk({ applicants: [], participants: [] });
    await listParticipationForOpportunity({ organizationId: "org-1", opportunityId: "opp-1" }, STAFF_TOKEN);
    expect(fetch).toHaveBeenCalledWith(`${VMS_FUNCTIONS_URL}/list-participation-for-opportunity`, expect.anything());
  });

  it("listApplications posts to list-applications", async () => {
    mockOk({ applications: [], total: 0 });
    await listApplications({ organizationId: "org-1" }, STAFF_TOKEN);
    expect(fetch).toHaveBeenCalledWith(`${VMS_FUNCTIONS_URL}/list-applications`, expect.anything());
  });

  it("listActivityHours posts to list-activity-hours", async () => {
    mockOk({ activity: [], total: 0 });
    await listActivityHours({ organizationId: "org-1" }, STAFF_TOKEN);
    expect(fetch).toHaveBeenCalledWith(`${VMS_FUNCTIONS_URL}/list-activity-hours`, expect.anything());
  });

  it("getKpiSummary posts to get-kpi-summary", async () => {
    mockOk({ totalRegistered: 0 });
    await getKpiSummary({ organizationId: "org-1" }, STAFF_TOKEN);
    expect(fetch).toHaveBeenCalledWith(`${VMS_FUNCTIONS_URL}/get-kpi-summary`, expect.anything());
  });

  it("createOpportunity posts to create-opportunity", async () => {
    mockOk({ opportunityId: "opp-1" });
    await createOpportunity({ organizationId: "org-1", name: "Test", type: "environment" }, STAFF_TOKEN);
    expect(fetch).toHaveBeenCalledWith(`${VMS_FUNCTIONS_URL}/create-opportunity`, expect.anything());
  });

  it("updateOpportunity posts to update-opportunity", async () => {
    mockOk({ opportunityId: "opp-1" });
    await updateOpportunity({ opportunityId: "opp-1", organizationId: "org-1", name: "Renamed" }, STAFF_TOKEN);
    expect(fetch).toHaveBeenCalledWith(`${VMS_FUNCTIONS_URL}/update-opportunity`, expect.anything());
  });

  it("decideApplication posts to decide-application (no organizationId — the handler derives it from the application row itself)", async () => {
    mockOk({ applicationId: "app-1", participationId: null });
    await decideApplication({ applicationId: "app-1", decision: "selected" }, STAFF_TOKEN);
    expect(fetch).toHaveBeenCalledWith(
      `${VMS_FUNCTIONS_URL}/decide-application`,
      expect.objectContaining({ body: JSON.stringify({ applicationId: "app-1", decision: "selected" }) }),
    );
  });

  it("verifyHours posts to verify-hours with a required decision field", async () => {
    mockOk({ activityHoursId: "ah-1" });
    await verifyHours({ activityHoursId: "ah-1", decision: "verified", hoursVerified: 5 }, STAFF_TOKEN);
    expect(fetch).toHaveBeenCalledWith(
      `${VMS_FUNCTIONS_URL}/verify-hours`,
      expect.objectContaining({ body: JSON.stringify({ activityHoursId: "ah-1", decision: "verified", hoursVerified: 5 }) }),
    );
  });

  it("bulkAssignHours posts to bulk-assign-hours with a specific list of participation ids", async () => {
    mockOk({ createdCount: 3 });
    await bulkAssignHours(
      { organizationId: "org-1", opportunityId: "opp-1", activityDate: "2026-02-01", hoursSubmitted: 3, participationIds: ["p-1", "p-2", "p-3"] },
      STAFF_TOKEN,
    );
    expect(fetch).toHaveBeenCalledWith(`${VMS_FUNCTIONS_URL}/bulk-assign-hours`, expect.anything());
  });

  it("exportVmsCsv posts to export-csv and returns the raw CSV text, not parsed JSON", async () => {
    mockOkText("name,type\nTest Opp,environment\n");
    const csv = await exportVmsCsv({ organizationId: "org-1", entity: "opportunities" }, STAFF_TOKEN);
    expect(fetch).toHaveBeenCalledWith(`${VMS_FUNCTIONS_URL}/export-csv`, expect.anything());
    expect(csv).toBe("name,type\nTest Opp,environment\n");
  });

  it("throws the server's error message when a JSON call fails", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, json: async () => ({ error: "forbidden" }) } as Response);
    await expect(listVolunteers({ organizationId: "org-1" }, STAFF_TOKEN)).rejects.toThrow("forbidden");
  });
});

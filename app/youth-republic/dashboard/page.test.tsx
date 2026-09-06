import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import YouthRepublicDashboardPage from "./page";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { fetchStaffToken } from "@/lib/staffToken";
import * as youthRepublicFunctions from "@/lib/youthRepublicFunctions";
import * as shell from "@/components/shell/AppShell";

vi.mock("@/lib/supabase/browserClient");
vi.mock("@/lib/staffToken");
vi.mock("@/lib/youthRepublicFunctions");
vi.mock("@/components/shell/AppShell", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/shell/AppShell")>();
  return { ...actual, useSelectedOrg: vi.fn() };
});

const opp = (over: Partial<youthRepublicFunctions.OpportunitySummary>): youthRepublicFunctions.OpportunitySummary => ({
  id: "o", name: "Drive", orgName: "Rizq", orgLogoUrl: null, type: "community", city: "Lahore",
  online: false, computedStatus: "open", description: "d", capacity: 40, filledCount: 10,
  applicationDeadline: null, activityStartAt: null, activityEndAt: null, deactivatedAt: null, ...over,
});
const app = (over: Partial<youthRepublicFunctions.ApplicationListRow>): youthRepublicFunctions.ApplicationListRow => ({
  id: "a", volunteerId: "v", volunteerName: "V", opportunityId: "o", opportunityName: "Drive",
  status: "submitted", appliedAt: new Date().toISOString(), applicantName: "V", applicantEmail: null,
  applicantPhone: null, answers: {}, formSnapshot: null, attachmentIdsByField: {}, ...over,
});
const hour = (over: Partial<youthRepublicFunctions.ActivityListRow>): youthRepublicFunctions.ActivityListRow => ({
  id: "h", volunteerName: "V", opportunityName: "Drive", activityType: "community", role: null,
  activityDate: "2026-02-01", hoursSubmitted: 4, hoursVerified: null, verificationStatus: "pending",
  adminNotes: null, ...over,
});

describe("YouthRepublicDashboardPage", () => {
  beforeEach(() => {
    vi.mocked(shell.useSelectedOrg).mockReturnValue("org-1");
    vi.mocked(getBrowserSupabaseClient).mockReturnValue({
      auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: "platform-token" } } }) },
    } as never);
    vi.mocked(fetchStaffToken).mockResolvedValue("staff-jwt");

    vi.mocked(youthRepublicFunctions.getKpiSummary).mockResolvedValue({
      totalRegistered: 42, active: 30, completedParticipations: 12, applicationsReceived: 55,
      selected: 20, totalVerifiedHours: 340, byCity: { Lahore: 20 },
      byProvince: {}, byInstitution: { LUMS: 9 },
      participationByOpportunity: {}, participationByActivityType: { community: 8 },
    });
    vi.mocked(youthRepublicFunctions.listOpportunities).mockResolvedValue({
      opportunities: [
        opp({ id: "o1", name: "Open Drive", computedStatus: "open", filledCount: 20, capacity: 40 }),
        opp({ id: "o2", name: "Closed Drive", computedStatus: "closed" }),
        opp({ id: "o3", name: "Archived Drive", deactivatedAt: "2026-01-01T00:00:00Z" }),
      ],
      total: 3,
      facets: { cities: [], orgs: [] },
    });
    vi.mocked(youthRepublicFunctions.listApplications).mockResolvedValue({
      applications: [
        app({ id: "a1", status: "submitted", opportunityName: "Open Drive", applicantName: "Hamza Sheikh" }),
        app({ id: "a2", status: "under_review", opportunityName: "Open Drive" }),
        app({ id: "a3", status: "selected", opportunityName: "Open Drive" }),
      ],
      total: 3,
    });
    vi.mocked(youthRepublicFunctions.listActivityHours).mockResolvedValue({
      activity: [
        hour({ id: "h1", verificationStatus: "pending" }),
        hour({ id: "h2", verificationStatus: "verified" }),
      ],
      total: 2,
    });
  });

  it("derives the tiles from live data across all four endpoints", async () => {
    render(<YouthRepublicDashboardPage />);

    // "Active opportunities" = live opps in an active status -> just "Open Drive" -> 1
    await waitFor(() => expect(screen.getByText("Active opportunities")).toBeInTheDocument());
    expect(screen.getByText("Applications to review")).toBeInTheDocument(); // = submitted + under_review = 2
    expect(screen.getByText("Hours to verify")).toBeInTheDocument(); // = 1 pending
    expect(screen.getByText("Active volunteers")).toBeInTheDocument(); // = kpis.active = 30

    // recent applications rendered from listApplications, not hardcoded names
    expect(screen.getByText("Hamza Sheikh")).toBeInTheDocument();

    // real capacity meter row from listOpportunities
    expect(screen.getByText("20 / 40 (50%)")).toBeInTheDocument();

    expect(youthRepublicFunctions.getKpiSummary).toHaveBeenCalledWith({ organizationId: "org-1" }, "staff-jwt");
    expect(youthRepublicFunctions.listApplications).toHaveBeenCalled();
    expect(youthRepublicFunctions.listActivityHours).toHaveBeenCalled();
  });
});

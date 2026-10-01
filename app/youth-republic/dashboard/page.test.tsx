import { screen, waitFor } from "@testing-library/react";
import { renderWithSwr } from "@/tests/renderWithSwr";
import { describe, it, expect, vi, beforeEach } from "vitest";
import YouthRepublicDashboardPage from "./page";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { fetchStaffToken } from "@/lib/staffToken";
import * as youthRepublicFunctions from "@/lib/youthRepublicFunctions";
import * as platformFunctions from "@/lib/platformFunctions";
import * as shell from "@/components/shell/AppShell";
import { useStaffPermissions, type StaffPermissions } from "@/components/shell/useStaffPermissions";

vi.mock("@/lib/supabase/browserClient");
vi.mock("@/lib/staffToken");
vi.mock("@/lib/youthRepublicFunctions");
vi.mock("@/lib/platformFunctions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/platformFunctions")>();
  return {
    ...actual,
    listChapters: vi.fn(),
  };
});
vi.mock("@/components/shell/useStaffPermissions", () => ({
  useStaffPermissions: vi.fn(),
}));
vi.mock("@/components/shell/AppShell", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/shell/AppShell")>();
  return { ...actual, useSelectedOrg: vi.fn(), useShellStaffToken: vi.fn(), useShellAccessToken: vi.fn() };
});

const allPerms: StaffPermissions = {
  canAccessDashboard: true,
  canViewDrives: true,
  canCreateDrives: true,
  canPublishDrives: true,
  canViewApplications: true,
  canTriageApplications: true,
  canViewHours: true,
  canApproveHours: true,
  canViewVolunteers: true,
  canManageTeam: true,
  canManageOrgProfile: true,
  canCreateChapters: true,
  canEditChapter: () => true,
  canViewInquiries: true,
  isChapterScoped: false,
  scopedChapterIds: null,
  hasChapterPermission: () => true,
};

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
    vi.clearAllMocks();
    vi.mocked(shell.useSelectedOrg).mockReturnValue("org-1");
    vi.mocked(shell.useShellStaffToken).mockReturnValue("staff-jwt");
    vi.mocked(shell.useShellAccessToken).mockReturnValue("platform-token");
    vi.mocked(useStaffPermissions).mockReturnValue(allPerms);
    vi.mocked(getBrowserSupabaseClient).mockReturnValue({
      auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: "platform-token" } } }) },
    } as never);
    vi.mocked(fetchStaffToken).mockResolvedValue("staff-jwt");

    vi.mocked(platformFunctions.listChapters).mockResolvedValue({
      chapters: [
        { id: "lhr", name: "Lahore Chapter", status: "active", city: "Lahore" },
      ],
    });

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
    renderWithSwr(<YouthRepublicDashboardPage />);

    // "Active drives" = live opps in an active status -> just "Open Drive" -> 1
    await waitFor(() => expect(screen.getByText("Active drives")).toBeInTheDocument());
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

  it("renders AccessDeniedGate when user lacks dashboard access permissions", () => {
    vi.mocked(useStaffPermissions).mockReturnValue({ ...allPerms, canAccessDashboard: false });
    renderWithSwr(<YouthRepublicDashboardPage />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Access Denied/i })).toBeInTheDocument();
    expect(screen.getByText(/Dashboard/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Youth Republic/i })).toHaveAttribute("href", "/youth-republic");
  });

  describe("resilient loading and widget gating", () => {
    it("renders surviving widgets when getKpiSummary fails", async () => {
      vi.mocked(youthRepublicFunctions.getKpiSummary).mockRejectedValue(new Error("KPI service offline"));
      renderWithSwr(<YouthRepublicDashboardPage />);

      // Dashboard should still load without crashing
      await waitFor(() => expect(screen.getByText("Active drives")).toBeInTheDocument());
      expect(screen.getByText("Applications to review")).toBeInTheDocument();
      expect(screen.getByText("Hamza Sheikh")).toBeInTheDocument();
      expect(screen.getByText("20 / 40 (50%)")).toBeInTheDocument();
      // KPI values gracefully fallback to 0
      expect(screen.getByText("0 hours verified so far")).toBeInTheDocument();
    });

    it("hides navigation links for modules user lacks view permissions for", async () => {
      vi.mocked(useStaffPermissions).mockReturnValue({
        ...allPerms,
        canViewApplications: false,
        canViewDrives: false,
      });
      renderWithSwr(<YouthRepublicDashboardPage />);

      await waitFor(() => expect(screen.getByText("Operations Command Center")).toBeInTheDocument());
      expect(screen.queryByRole("link", { name: /View all/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: /Triage all/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: "Review" })).not.toBeInTheDocument();
    });
  });

  describe("capability-driven widget gating and fail-safe data fetching", () => {
    it("renders only Applications card and Recent Applications widget for applications-only staff, without querying other endpoints", async () => {
      vi.mocked(useStaffPermissions).mockReturnValue({
        ...allPerms,
        canAccessDashboard: true,
        canViewApplications: true,
        canViewDrives: false,
        canViewHours: false,
        canViewVolunteers: false,
      });

      renderWithSwr(<YouthRepublicDashboardPage />);

      await waitFor(() => expect(screen.getByText("Applications to review")).toBeInTheDocument());
      expect(screen.getByText("Recent applications")).toBeInTheDocument();
      expect(screen.getByText("Hamza Sheikh")).toBeInTheDocument();

      // Unauthorized stat cards and widgets are strictly absent
      expect(screen.queryByText("Active drives")).not.toBeInTheDocument();
      expect(screen.queryByText("Hours to verify")).not.toBeInTheDocument();
      expect(screen.queryByText("Active volunteers")).not.toBeInTheDocument();
      expect(screen.queryByText("Volunteer capacity")).not.toBeInTheDocument();
      expect(screen.queryByText("Volunteers by city")).not.toBeInTheDocument();
      expect(screen.queryByText("Top institutions")).not.toBeInTheDocument();
      expect(screen.queryByText("By activity domain")).not.toBeInTheDocument();

      // Only listApplications was queried
      expect(youthRepublicFunctions.listApplications).toHaveBeenCalled();
      expect(youthRepublicFunctions.getKpiSummary).not.toHaveBeenCalled();
      expect(youthRepublicFunctions.listOpportunities).not.toHaveBeenCalled();
      expect(youthRepublicFunctions.listActivityHours).not.toHaveBeenCalled();
    });

    it("renders only Drives card and Volunteer Capacity widget for drives-only staff, without querying other endpoints", async () => {
      vi.mocked(useStaffPermissions).mockReturnValue({
        ...allPerms,
        canAccessDashboard: true,
        canViewDrives: true,
        canViewApplications: false,
        canViewHours: false,
        canViewVolunteers: false,
      });

      renderWithSwr(<YouthRepublicDashboardPage />);

      await waitFor(() => expect(screen.getByText("Active drives")).toBeInTheDocument());
      expect(screen.getByText("Volunteer capacity")).toBeInTheDocument();
      expect(screen.getByText("20 / 40 (50%)")).toBeInTheDocument();

      expect(screen.queryByText("Applications to review")).not.toBeInTheDocument();
      expect(screen.queryByText("Hours to verify")).not.toBeInTheDocument();
      expect(screen.queryByText("Active volunteers")).not.toBeInTheDocument();
      expect(screen.queryByText("Recent applications")).not.toBeInTheDocument();
      expect(screen.queryByText("Volunteers by city")).not.toBeInTheDocument();
      expect(screen.queryByText("Top institutions")).not.toBeInTheDocument();
      expect(screen.queryByText("By activity domain")).not.toBeInTheDocument();

      // Only listOpportunities was queried
      expect(youthRepublicFunctions.listOpportunities).toHaveBeenCalled();
      expect(youthRepublicFunctions.getKpiSummary).not.toHaveBeenCalled();
      expect(youthRepublicFunctions.listApplications).not.toHaveBeenCalled();
      expect(youthRepublicFunctions.listActivityHours).not.toHaveBeenCalled();
    });

    it("renders only Hours to verify card for hours-only staff, without querying other endpoints", async () => {
      vi.mocked(useStaffPermissions).mockReturnValue({
        ...allPerms,
        canAccessDashboard: true,
        canViewHours: true,
        canViewDrives: false,
        canViewApplications: false,
        canViewVolunteers: false,
      });

      renderWithSwr(<YouthRepublicDashboardPage />);

      await waitFor(() => expect(screen.getByText("Hours to verify")).toBeInTheDocument());

      expect(screen.queryByText("Active drives")).not.toBeInTheDocument();
      expect(screen.queryByText("Applications to review")).not.toBeInTheDocument();
      expect(screen.queryByText("Active volunteers")).not.toBeInTheDocument();
      expect(screen.queryByText("Volunteer capacity")).not.toBeInTheDocument();
      expect(screen.queryByText("Recent applications")).not.toBeInTheDocument();
      expect(screen.queryByText("Volunteers by city")).not.toBeInTheDocument();

      // Only listActivityHours was queried
      expect(youthRepublicFunctions.listActivityHours).toHaveBeenCalled();
      expect(youthRepublicFunctions.getKpiSummary).not.toHaveBeenCalled();
      expect(youthRepublicFunctions.listOpportunities).not.toHaveBeenCalled();
      expect(youthRepublicFunctions.listApplications).not.toHaveBeenCalled();
    });
  });

  describe("contextual chapter telemetry subtitle", () => {
    it("renders organization-wide telemetry subtitle when user is not chapter-scoped", async () => {
      vi.mocked(useStaffPermissions).mockReturnValue({
        ...allPerms,
        isChapterScoped: false,
        scopedChapterIds: null,
      });

      renderWithSwr(<YouthRepublicDashboardPage />);

      await waitFor(() => {
        expect(
          screen.getByText("Organization-wide operations & telemetry across all chapters.")
        ).toBeInTheDocument();
      });
    });

    it("renders chapter-scoped telemetry subtitle resolving chapter name via listChapters", async () => {
      vi.mocked(useStaffPermissions).mockReturnValue({
        ...allPerms,
        isChapterScoped: true,
        scopedChapterIds: ["lhr"],
      });
      vi.mocked(platformFunctions.listChapters).mockResolvedValue({
        chapters: [
          { id: "lhr", name: "Lahore Chapter", status: "active", city: "Lahore" },
        ],
      });

      renderWithSwr(<YouthRepublicDashboardPage />);

      await waitFor(() => {
        expect(
          screen.getByText("Live operations & shift telemetry for Lahore Chapter")
        ).toBeInTheDocument();
      });
    });

    it("renders chapter-scoped telemetry subtitle falling back to assigned chapter ID/name when not found in chapters list", async () => {
      vi.mocked(useStaffPermissions).mockReturnValue({
        ...allPerms,
        isChapterScoped: true,
        scopedChapterIds: ["Karachi Chapter"],
      });
      vi.mocked(platformFunctions.listChapters).mockResolvedValue({
        chapters: [],
      });

      renderWithSwr(<YouthRepublicDashboardPage />);

      await waitFor(() => {
        expect(
          screen.getByText("Live operations & shift telemetry for Karachi Chapter")
        ).toBeInTheDocument();
      });
    });
  });
});

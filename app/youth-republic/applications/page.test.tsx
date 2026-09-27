import { screen, waitFor } from "@testing-library/react";
import { renderWithSwr } from "@/tests/renderWithSwr";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import YouthRepublicApplicationsPage from "./page";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { fetchStaffToken } from "@/lib/staffToken";
import * as youthRepublicFunctions from "@/lib/youthRepublicFunctions";
import * as shell from "@/components/shell/AppShell";
import { useStaffPermissions, type StaffPermissions } from "@/components/shell/useStaffPermissions";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/supabase/browserClient");
vi.mock("@/lib/staffToken");
vi.mock("@/lib/youthRepublicFunctions");
vi.mock("@/components/shell/useStaffPermissions", () => ({
  useStaffPermissions: vi.fn(),
}));
vi.mock("@/components/shell/AppShell", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/shell/AppShell")>();
  return { ...actual, useSelectedOrg: vi.fn(), useShellStaffToken: vi.fn() };
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
  isChapterScoped: false,
  scopedChapterIds: null,
  hasChapterPermission: () => true,
};

describe("YouthRepublicApplicationsPage", () => {
  beforeEach(() => {
    vi.mocked(shell.useSelectedOrg).mockReturnValue("org-1");
    vi.mocked(shell.useShellStaffToken).mockReturnValue("staff-jwt");
    vi.mocked(useStaffPermissions).mockReturnValue(allPerms);
    vi.mocked(getBrowserSupabaseClient).mockReturnValue({
      auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: "platform-token" } } }) },
    } as never);
    vi.mocked(fetchStaffToken).mockResolvedValue("staff-jwt");
    vi.mocked(youthRepublicFunctions.listApplications).mockResolvedValue({
      applications: [{
        id: "app-1", volunteerId: "vol-1", volunteerName: "Aisha Khan", opportunityId: "opp-1",
        opportunityName: "Beach Cleanup", status: "submitted", appliedAt: "2026-01-01T00:00:00Z",
        applicantName: "Aisha Khan", applicantEmail: "aisha@example.com", applicantPhone: "0300-1234567",
        answers: {}, formSnapshot: null, attachmentIdsByField: {},
      }],
      total: 1,
    });
    vi.mocked(youthRepublicFunctions.decideApplication).mockReset();
  });

  it("lists applications and decides one when a decision button is clicked", async () => {
    vi.mocked(youthRepublicFunctions.decideApplication).mockResolvedValue({ applicationId: "app-1", participationId: "p-1" });
    const user = userEvent.setup();

    renderWithSwr(<YouthRepublicApplicationsPage />);

    expect(await screen.findByText("Aisha Khan")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Select" }));

    await waitFor(() => {
      expect(youthRepublicFunctions.decideApplication).toHaveBeenCalledWith(
        { applicationId: "app-1", decision: "selected" },
        "staff-jwt",
      );
    });
  });

  it("Reconsider is a local reveal on a decided row — the decision buttons appear and only then hit the server", async () => {
    vi.mocked(youthRepublicFunctions.listApplications).mockResolvedValue({
      applications: [{
        id: "app-2", volunteerId: "vol-2", volunteerName: "Bilal Ahmed", opportunityId: "opp-1",
        opportunityName: "Beach Cleanup", status: "waitlisted", appliedAt: "2026-01-01T00:00:00Z",
        applicantName: "Bilal Ahmed", applicantEmail: "bilal@example.com", applicantPhone: "0300-7654321",
        answers: {}, formSnapshot: null, attachmentIdsByField: {},
      }],
      total: 1,
    });
    vi.mocked(youthRepublicFunctions.decideApplication).mockResolvedValue({ applicationId: "app-2", participationId: null });
    const user = userEvent.setup();

    renderWithSwr(<YouthRepublicApplicationsPage />);

    // The queue opens on Pending Review by default; widen it to see the
    // already-decided (waitlisted) row.
    await user.click(await screen.findByRole("combobox", { name: "Filter by status" }));
    await user.click(await screen.findByRole("option", { name: "All Application Statuses" }));

    expect(await screen.findByText("Bilal Ahmed")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Select" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reject" })).not.toBeInTheDocument();

    // Reconsider only reveals the buttons — no server call yet.
    await user.click(screen.getByRole("button", { name: "Reconsider" }));
    expect(youthRepublicFunctions.decideApplication).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Select" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Waitlist" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reject" })).toBeInTheDocument();

    // Now picking one hits the server.
    await user.click(screen.getByRole("button", { name: "Select" }));
    await waitFor(() => {
      expect(youthRepublicFunctions.decideApplication).toHaveBeenCalledWith(
        { applicationId: "app-2", decision: "selected" },
        "staff-jwt",
      );
    });
  });

  it("opens with the status filter defaulted to Pending Review", async () => {
    renderWithSwr(<YouthRepublicApplicationsPage />);

    const filter = await screen.findByRole("combobox", { name: "Filter by status" });
    expect(filter).toHaveTextContent("Pending Review");
  });

  it("shows a spinner and loading label on the clicked decision button while the server call is in flight", async () => {
    let resolveDecide: (v: { applicationId: string; participationId: string | null }) => void = () => {};
    vi.mocked(youthRepublicFunctions.decideApplication).mockImplementation(
      () => new Promise((res) => { resolveDecide = res; }),
    );
    const user = userEvent.setup();

    renderWithSwr(<YouthRepublicApplicationsPage />);

    expect(await screen.findByText("Aisha Khan")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Select" }));

    const busyButton = await screen.findByRole("button", { name: /Selecting/ });
    expect(busyButton).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: "Waitlist" })).toBeDisabled();

    resolveDecide({ applicationId: "app-1", participationId: "p-1" });
    await waitFor(() => {
      expect(youthRepublicFunctions.decideApplication).toHaveBeenCalled();
    });
  });

  it("renders AccessDeniedGate when user lacks application viewing permissions", () => {
    vi.mocked(useStaffPermissions).mockReturnValue({ ...allPerms, canViewApplications: false });
    renderWithSwr(<YouthRepublicApplicationsPage />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Access Denied/i })).toBeInTheDocument();
    expect(screen.getByText(/Applications/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Youth Republic/i })).toHaveAttribute("href", "/youth-republic");
  });

  describe("action button permissions gating", () => {
    it("hides decision buttons and renders Read-only badge when user lacks canTriageApplications", async () => {
      vi.mocked(useStaffPermissions).mockReturnValue({
        ...allPerms,
        canTriageApplications: false,
      });
      renderWithSwr(<YouthRepublicApplicationsPage />);

      expect(await screen.findByText("Aisha Khan")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Select" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Waitlist" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Reject" })).not.toBeInTheDocument();
      expect(screen.getByText("Read-only")).toBeInTheDocument();
      // Review Answers button should still be available to view answers
      expect(screen.getByRole("button", { name: "Review Answers" })).toBeInTheDocument();
    });

    it("hides Reconsider button on decided application when user lacks canTriageApplications", async () => {
      vi.mocked(youthRepublicFunctions.listApplications).mockResolvedValue({
        applications: [{
          id: "app-2",
          volunteerId: "vol-2",
          volunteerName: "Bilal Ahmed",
          opportunityId: "opp-1",
          opportunityName: "Beach Cleanup",
          status: "waitlisted",
          appliedAt: "2026-01-01T00:00:00Z",
          applicantName: "Bilal Ahmed",
          applicantEmail: "bilal@example.com",
          applicantPhone: "0300-7654321",
          answers: {},
          formSnapshot: null,
          attachmentIdsByField: {},
        }],
        total: 1,
      });
      vi.mocked(useStaffPermissions).mockReturnValue({
        ...allPerms,
        canTriageApplications: false,
      });
      const user = userEvent.setup();
      renderWithSwr(<YouthRepublicApplicationsPage />);

      await user.click(await screen.findByRole("combobox", { name: "Filter by status" }));
      await user.click(await screen.findByRole("option", { name: "All Application Statuses" }));

      expect(await screen.findByText("Bilal Ahmed")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Reconsider" })).not.toBeInTheDocument();
      expect(screen.getByText("Read-only")).toBeInTheDocument();
    });

    it("hides decision buttons in ApplicationReviewDrawer when user lacks canTriageApplications", async () => {
      vi.mocked(useStaffPermissions).mockReturnValue({
        ...allPerms,
        canTriageApplications: false,
      });
      const user = userEvent.setup();
      renderWithSwr(<YouthRepublicApplicationsPage />);

      expect(await screen.findByText("Aisha Khan")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Review Answers" }));

      // Review drawer opens
      expect(await screen.findByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText("Candidate Application Review")).toBeInTheDocument();
      // Decision buttons should not be in the drawer
      expect(screen.queryByRole("button", { name: "Select" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Waitlist" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Reject" })).not.toBeInTheDocument();
      // Close button should be present
      expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
    });
  });
});

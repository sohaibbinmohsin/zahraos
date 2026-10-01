import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import YouthRepublicModuleLayout from "./layout";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { fetchStaffToken } from "@/lib/staffToken";
import { listApplications, listActivityHours } from "@/lib/youthRepublicFunctions";
import { useStaffPermissions, type StaffPermissions } from "@/components/shell/useStaffPermissions";

vi.mock("next/navigation", () => ({
  usePathname: () => "/youth-republic/dashboard",
}));
vi.mock("@/components/shell/AppShell", () => ({
  useSelectedOrg: () => "org-1",
  useShellStaffToken: () => "staff-token",
}));
vi.mock("@/components/shell/useStaffPermissions", () => ({
  useStaffPermissions: vi.fn(),
}));
vi.mock("@/lib/supabase/browserClient", () => ({
  getBrowserSupabaseClient: () => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: "mock-access-token" } },
      }),
    },
  }),
}));
vi.mock("@/lib/staffToken", () => ({
  fetchStaffToken: vi.fn().mockResolvedValue("mock-staff-token"),
}));
vi.mock("@/lib/youthRepublicFunctions", () => ({
  listApplications: vi.fn().mockResolvedValue({
    applications: [
      { id: "a1", status: "submitted" },
      { id: "a2", status: "under_review" },
      { id: "a3", status: "approved" },
    ],
  }),
  listActivityHours: vi.fn().mockResolvedValue({
    activity: [
      { id: "h1", verificationStatus: "pending" },
      { id: "h2", verificationStatus: "verified" },
    ],
  }),
}));

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

describe("YouthRepublicModuleLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useStaffPermissions).mockReturnValue(allPerms);
  });

  it("renders a tab for each of the 5 admin screens plus the page content", async () => {
    render(
      <YouthRepublicModuleLayout>
        <p>screen content</p>
      </YouthRepublicModuleLayout>,
    );

    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Volunteers" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Drives" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Applications" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Hours" })).toBeInTheDocument();
    expect(screen.getByText("screen content")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("2 pending")).toBeInTheDocument());
  });

  it("does not render a badge for Opportunities, but renders pending badges for Applications and Hours", async () => {
    render(
      <YouthRepublicModuleLayout>
        <p>screen content</p>
      </YouthRepublicModuleLayout>,
    );

    const oppsLink = screen.getByRole("link", { name: "Drives" });
    const appsLink = screen.getByRole("link", { name: "Applications" });
    const hoursLink = screen.getByRole("link", { name: "Hours" });

    // Wait for async badges to load
    await waitFor(() => {
      expect(appsLink).toHaveTextContent("2 pending");
      expect(hoursLink).toHaveTextContent("1 pending");
    });

    // Opportunities tab must never have a count badge
    expect(oppsLink.querySelector(".count-badge")).toBeNull();
  });

  it("filters tabs based on permissions so unauthorized tabs do not render", async () => {
    vi.mocked(useStaffPermissions).mockReturnValue({
      ...allPerms,
      canAccessDashboard: false,
      canViewHours: false,
      canViewVolunteers: false,
    });

    render(
      <YouthRepublicModuleLayout>
        <p>screen content</p>
      </YouthRepublicModuleLayout>,
    );

    expect(screen.queryByRole("link", { name: "Dashboard" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Hours" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Volunteers" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Drives" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Applications" })).toBeInTheDocument();
  });

  it("does not fetch badges for sections the user is not authorized to view", async () => {
    vi.mocked(useStaffPermissions).mockReturnValue({
      ...allPerms,
      canViewApplications: false,
      canViewHours: false,
    });

    render(
      <YouthRepublicModuleLayout>
        <p>screen content</p>
      </YouthRepublicModuleLayout>,
    );

    await waitFor(() => {
      expect(screen.getByText("screen content")).toBeInTheDocument();
    });

    expect(listApplications).not.toHaveBeenCalled();
    expect(listActivityHours).not.toHaveBeenCalled();
  });
});

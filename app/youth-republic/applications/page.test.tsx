import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import YouthRepublicApplicationsPage from "./page";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { fetchStaffToken } from "@/lib/staffToken";
import * as youthRepublicFunctions from "@/lib/youthRepublicFunctions";
import * as shell from "@/components/shell/AppShell";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/supabase/browserClient");
vi.mock("@/lib/staffToken");
vi.mock("@/lib/youthRepublicFunctions");
vi.mock("@/components/shell/AppShell", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/shell/AppShell")>();
  return { ...actual, useSelectedOrg: vi.fn() };
});

describe("YouthRepublicApplicationsPage", () => {
  beforeEach(() => {
    vi.mocked(shell.useSelectedOrg).mockReturnValue("org-1");
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

    render(<YouthRepublicApplicationsPage />);

    expect(await screen.findByText("Aisha Khan")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Select" }));

    await waitFor(() => {
      expect(youthRepublicFunctions.decideApplication).toHaveBeenCalledWith(
        { applicationId: "app-1", decision: "selected" },
        "staff-jwt",
      );
    });
  });

  it("promotes a waitlisted application to selected using the same decide action", async () => {
    vi.mocked(youthRepublicFunctions.listApplications).mockResolvedValue({
      applications: [{
        id: "app-2", volunteerId: "vol-2", volunteerName: "Bilal Ahmed", opportunityId: "opp-1",
        opportunityName: "Beach Cleanup", status: "waitlisted", appliedAt: "2026-01-01T00:00:00Z",
        applicantName: "Bilal Ahmed", applicantEmail: "bilal@example.com", applicantPhone: "0300-7654321",
        answers: {}, formSnapshot: null, attachmentIdsByField: {},
      }],
      total: 1,
    });
    vi.mocked(youthRepublicFunctions.decideApplication).mockResolvedValue({ applicationId: "app-2", participationId: "p-2" });
    const user = userEvent.setup();

    render(<YouthRepublicApplicationsPage />);

    expect(await screen.findByText("Bilal Ahmed")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Promote to selected" }));

    await waitFor(() => {
      expect(youthRepublicFunctions.decideApplication).toHaveBeenCalledWith(
        { applicationId: "app-2", decision: "selected" },
        "staff-jwt",
      );
    });
  });
});

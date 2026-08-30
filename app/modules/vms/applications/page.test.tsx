import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import VmsApplicationsPage from "./page";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { fetchStaffToken } from "@/lib/staffToken";
import * as vmsFunctions from "@/lib/vmsFunctions";
import * as shell from "@/components/shell/AppShell";

vi.mock("@/lib/supabase/browserClient");
vi.mock("@/lib/staffToken");
vi.mock("@/lib/vmsFunctions");
vi.mock("@/components/shell/AppShell", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/shell/AppShell")>();
  return { ...actual, useSelectedOrg: vi.fn() };
});

describe("VmsApplicationsPage", () => {
  beforeEach(() => {
    vi.mocked(shell.useSelectedOrg).mockReturnValue("org-1");
    vi.mocked(getBrowserSupabaseClient).mockReturnValue({
      auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: "platform-token" } } }) },
    } as never);
    vi.mocked(fetchStaffToken).mockResolvedValue("staff-jwt");
    vi.mocked(vmsFunctions.listApplications).mockResolvedValue({
      applications: [{
        id: "app-1", volunteerId: "vol-1", volunteerName: "Aisha Khan", opportunityId: "opp-1",
        opportunityName: "Beach Cleanup", status: "submitted", appliedAt: "2026-01-01T00:00:00Z",
      }],
      total: 1,
    });
    vi.mocked(vmsFunctions.decideApplication).mockReset();
  });

  it("lists applications and decides one when a decision button is clicked", async () => {
    vi.mocked(vmsFunctions.decideApplication).mockResolvedValue({ applicationId: "app-1", participationId: "p-1" });
    const user = userEvent.setup();

    render(<VmsApplicationsPage />);

    expect(await screen.findByText("Aisha Khan")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Select" }));

    await waitFor(() => {
      expect(vmsFunctions.decideApplication).toHaveBeenCalledWith(
        { applicationId: "app-1", decision: "selected" },
        "staff-jwt",
      );
    });
  });

  it("promotes a waitlisted application to selected using the same decide action", async () => {
    vi.mocked(vmsFunctions.listApplications).mockResolvedValue({
      applications: [{
        id: "app-2", volunteerId: "vol-2", volunteerName: "Bilal Ahmed", opportunityId: "opp-1",
        opportunityName: "Beach Cleanup", status: "waitlisted", appliedAt: "2026-01-01T00:00:00Z",
      }],
      total: 1,
    });
    vi.mocked(vmsFunctions.decideApplication).mockResolvedValue({ applicationId: "app-2", participationId: "p-2" });
    const user = userEvent.setup();

    render(<VmsApplicationsPage />);

    expect(await screen.findByText("Bilal Ahmed")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Promote to selected" }));

    await waitFor(() => {
      expect(vmsFunctions.decideApplication).toHaveBeenCalledWith(
        { applicationId: "app-2", decision: "selected" },
        "staff-jwt",
      );
    });
  });
});

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import VmsHoursPage from "./page";
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

describe("VmsHoursPage", () => {
  beforeEach(() => {
    vi.mocked(shell.useSelectedOrg).mockReturnValue("org-1");
    vi.mocked(getBrowserSupabaseClient).mockReturnValue({
      auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: "platform-token" } } }) },
    } as never);
    vi.mocked(fetchStaffToken).mockResolvedValue("staff-jwt");
    vi.mocked(vmsFunctions.listActivityHours).mockResolvedValue({
      activity: [{
        id: "ah-1", volunteerName: "Aisha Khan", opportunityName: "Beach Cleanup", activityType: "environment",
        role: "Lead", activityDate: "2026-02-01", hoursSubmitted: 5, hoursVerified: null,
        verificationStatus: "recorded", adminNotes: null,
      }],
      total: 1,
    });
    vi.mocked(vmsFunctions.listOpportunities).mockResolvedValue({
      opportunities: [{ id: "opp-1", name: "Beach Cleanup", type: "environment", computedStatus: "open", capacity: 20 }],
      total: 1,
    });
    vi.mocked(vmsFunctions.listParticipationForOpportunity).mockResolvedValue({
      applicants: [],
      participants: [{ participationId: "p-1", volunteerId: "vol-1", volunteerName: "Aisha Khan", status: "participating" }],
    });
    vi.mocked(vmsFunctions.verifyHours).mockReset();
    vi.mocked(vmsFunctions.bulkAssignHours).mockReset();
  });

  it("lists activity hours and verifies a row when Verify is clicked, passing the required decision field", async () => {
    vi.mocked(vmsFunctions.verifyHours).mockResolvedValue({ activityHoursId: "ah-1" });
    const user = userEvent.setup();

    render(<VmsHoursPage />);

    expect(await screen.findByText("Aisha Khan")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Verify" }));

    await waitFor(() => {
      expect(vmsFunctions.verifyHours).toHaveBeenCalledWith(
        { activityHoursId: "ah-1", decision: "verified", hoursVerified: 5 },
        "staff-jwt",
      );
    });
  });

  it("loads participants for the selected opportunity so bulk-assign can offer them", async () => {
    render(<VmsHoursPage />);

    await screen.findByText("Beach Cleanup", { selector: "option" });
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText("Bulk-assign for opportunity"), "opp-1");

    await waitFor(() => {
      expect(vmsFunctions.listParticipationForOpportunity).toHaveBeenCalledWith(
        { organizationId: "org-1", opportunityId: "opp-1" },
        "staff-jwt",
      );
    });
  });
});

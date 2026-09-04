import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import YouthRepublicHoursPage from "./page";
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

describe("YouthRepublicHoursPage", () => {
  beforeEach(() => {
    vi.mocked(shell.useSelectedOrg).mockReturnValue("org-1");
    vi.mocked(getBrowserSupabaseClient).mockReturnValue({
      auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: "platform-token" } } }) },
    } as never);
    vi.mocked(fetchStaffToken).mockResolvedValue("staff-jwt");
    vi.mocked(youthRepublicFunctions.listActivityHours).mockResolvedValue({
      activity: [{
        id: "ah-1", volunteerName: "Aisha Khan", opportunityName: "Beach Cleanup", activityType: "environment",
        role: "Lead", activityDate: "2026-02-01", hoursSubmitted: 5, hoursVerified: null,
        verificationStatus: "recorded", adminNotes: null,
      }],
      total: 1,
    });
    vi.mocked(youthRepublicFunctions.listOpportunities).mockResolvedValue({
      opportunities: [{ id: "opp-1", name: "Beach Cleanup", orgName: "Green Org", orgLogoUrl: null, type: "environment", city: "Karachi", online: false, computedStatus: "open", description: "Clean the shore", capacity: 20, filledCount: 3, applicationDeadline: null, activityStartAt: null, activityEndAt: null, deactivatedAt: null }],
      total: 1,
      facets: { cities: [], orgs: [] },
    });
    vi.mocked(youthRepublicFunctions.listParticipationForOpportunity).mockResolvedValue({
      applicants: [],
      participants: [{ participationId: "p-1", volunteerId: "vol-1", volunteerName: "Aisha Khan", status: "participating" }],
    });
    vi.mocked(youthRepublicFunctions.verifyHours).mockReset();
    vi.mocked(youthRepublicFunctions.bulkAssignHours).mockReset();
  });

  it("lists activity hours and verifies a row when Verify is clicked, passing the required decision field", async () => {
    vi.mocked(youthRepublicFunctions.verifyHours).mockResolvedValue({ activityHoursId: "ah-1" });
    const user = userEvent.setup();

    render(<YouthRepublicHoursPage />);

    expect(await screen.findByText("Aisha Khan")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Verify" }));

    await waitFor(() => {
      expect(youthRepublicFunctions.verifyHours).toHaveBeenCalledWith(
        { activityHoursId: "ah-1", decision: "verified", hoursVerified: 5 },
        "staff-jwt",
      );
    });
  });

  it("loads participants for the selected opportunity so bulk-assign can offer them", async () => {
    render(<YouthRepublicHoursPage />);

    await screen.findByText("Beach Cleanup", { selector: "option" });
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText("Bulk-assign for opportunity"), "opp-1");

    await waitFor(() => {
      expect(youthRepublicFunctions.listParticipationForOpportunity).toHaveBeenCalledWith(
        { organizationId: "org-1", opportunityId: "opp-1" },
        "staff-jwt",
      );
    });
  });
});

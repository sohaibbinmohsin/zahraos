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

  it("opens with the status filter on Pending Review and still shows a 'recorded' shift log", async () => {
    render(<YouthRepublicHoursPage />);

    const filter = await screen.findByRole("combobox");
    expect(filter).toHaveValue("pending");
    // ah-1's verificationStatus is "recorded" — the Pending Review filter
    // must treat that as pending (regression: it previously matched only the
    // exact "recorded"/"pending" string and hid the row).
    expect(screen.getByText("Aisha Khan")).toBeInTheDocument();
  });

  it("keeps the bulk-assign form hidden until its button is clicked, then shows it in a modal", async () => {
    render(<YouthRepublicHoursPage />);
    await screen.findByText("Aisha Khan");

    expect(screen.queryByLabelText("Opportunity / drive")).not.toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Bulk-Assign Hours/ }));

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText("Opportunity / drive")).toBeInTheDocument();
  });

  it("shows a spinner and loading label on the Verify button while the server call is in flight", async () => {
    let resolve: (v: { activityHoursId: string }) => void = () => {};
    vi.mocked(youthRepublicFunctions.verifyHours).mockImplementation(
      () => new Promise((r) => { resolve = r; }),
    );
    const user = userEvent.setup();

    render(<YouthRepublicHoursPage />);
    await screen.findByText("Aisha Khan");
    await user.click(screen.getByRole("button", { name: "Verify" }));

    const busy = await screen.findByRole("button", { name: /Accrediting/ });
    expect(busy).toHaveAttribute("aria-busy", "true");

    resolve({ activityHoursId: "ah-1" });
    await waitFor(() => expect(youthRepublicFunctions.verifyHours).toHaveBeenCalled());
  });

  it("loads participants for the selected opportunity so bulk-assign can offer them", async () => {
    render(<YouthRepublicHoursPage />);

    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /Bulk-Assign Hours/ }));

    await screen.findByText("Beach Cleanup", { selector: "option" });
    await user.selectOptions(screen.getByLabelText("Opportunity / drive"), "opp-1");

    await waitFor(() => {
      expect(youthRepublicFunctions.listParticipationForOpportunity).toHaveBeenCalledWith(
        { organizationId: "org-1", opportunityId: "opp-1" },
        "staff-jwt",
      );
    });
  });
});

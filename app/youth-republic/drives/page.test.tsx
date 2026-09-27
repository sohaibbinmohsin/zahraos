import { screen, waitFor } from "@testing-library/react";
import { renderWithSwr } from "@/tests/renderWithSwr";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import YouthRepublicOpportunitiesPage from "./page";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { fetchStaffToken } from "@/lib/staffToken";
import * as youthRepublicFunctions from "@/lib/youthRepublicFunctions";
import * as shell from "@/components/shell/AppShell";

vi.mock("@/lib/supabase/browserClient");
vi.mock("@/lib/staffToken");
vi.mock("@/lib/youthRepublicFunctions");
vi.mock("@/components/shell/AppShell", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/shell/AppShell")>();
  return { ...actual, useSelectedOrg: vi.fn(), useShellStaffToken: vi.fn() };
});

describe("YouthRepublicOpportunitiesPage", () => {
  beforeEach(() => {
    vi.mocked(shell.useSelectedOrg).mockReturnValue("org-1");
    vi.mocked(shell.useShellStaffToken).mockReturnValue("staff-jwt");
    vi.mocked(getBrowserSupabaseClient).mockReturnValue({
      auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: "platform-token" } } }) },
    } as never);
    vi.mocked(fetchStaffToken).mockResolvedValue("staff-jwt");
    vi.mocked(youthRepublicFunctions.listOpportunities).mockReset();
    vi.mocked(youthRepublicFunctions.listOpportunities).mockResolvedValue({
      opportunities: [{ id: "opp-1", name: "Beach Cleanup", orgName: "Green Org", orgLogoUrl: null, type: "environment", city: "Karachi", online: false, computedStatus: "open", description: "Clean the shore", capacity: 20, filledCount: 3, applicationDeadline: null, activityStartAt: null, activityEndAt: null, deactivatedAt: null }],
      total: 1,
      facets: { cities: [], orgs: [] },
    });
  });

  it("lists opportunities with their computed status", async () => {
    renderWithSwr(<YouthRepublicOpportunitiesPage />);
    expect(await screen.findByText("Beach Cleanup")).toBeInTheDocument();
    expect(screen.getAllByText("Open").length).toBeGreaterThan(0);
  });

  it("refreshes the list after a new opportunity is created", async () => {
    renderWithSwr(<YouthRepublicOpportunitiesPage />);
    await screen.findByText("Beach Cleanup");
    expect(youthRepublicFunctions.listOpportunities).toHaveBeenCalledTimes(1);
  });

  it("renders status filter with custom Select card", async () => {
    renderWithSwr(<YouthRepublicOpportunitiesPage />);
    await screen.findByText("Beach Cleanup");
    expect(screen.getByRole("combobox", { name: "Filter by status" })).toBeInTheDocument();
    expect(screen.getByText("All Statuses")).toBeInTheDocument();
  });

  it("filters drives by status dropdown", async () => {
    vi.mocked(youthRepublicFunctions.listOpportunities).mockResolvedValue({
      opportunities: [
        {
          id: "opp-1",
          name: "Open Drive",
          orgName: "Green Org",
          orgLogoUrl: null,
          type: "environment",
          city: "Lahore",
          online: false,
          computedStatus: "open",
          description: "Open",
          capacity: 10,
          filledCount: 2,
          applicationDeadline: null,
          activityStartAt: null,
          activityEndAt: null,
          deactivatedAt: null,
        },
        {
          id: "opp-2",
          name: "Completed Drive",
          orgName: "Green Org",
          orgLogoUrl: null,
          type: "environment",
          city: "Lahore",
          online: false,
          computedStatus: "completed",
          description: "Completed",
          capacity: null,
          filledCount: 5,
          applicationDeadline: null,
          activityStartAt: null,
          activityEndAt: null,
          deactivatedAt: null,
        },
      ],
      total: 2,
      facets: { cities: [], orgs: [] },
    });

    const user = userEvent.setup();
    renderWithSwr(<YouthRepublicOpportunitiesPage />);
    await screen.findByText("Open Drive");
    expect(screen.getByText("Completed Drive")).toBeInTheDocument();

    // Select Completed status
    const trigger = screen.getByRole("combobox", { name: "Filter by status" });
    await user.click(trigger);
    const completedOpt = await screen.findByRole("option", { name: "Completed" });
    await user.click(completedOpt);

    // Open Drive is filtered out, Completed Drive remains
    expect(screen.queryByText("Open Drive")).not.toBeInTheDocument();
    expect(screen.getByText("Completed Drive")).toBeInTheDocument();
  });

  it("filters drives by Applications closed and shows Live pill on in-progress drives", async () => {
    vi.mocked(youthRepublicFunctions.listOpportunities).mockResolvedValue({
      opportunities: [
        {
          id: "opp-live-closed",
          name: "Live Drive Closed Apps",
          orgName: "Green Org",
          orgLogoUrl: null,
          type: "community",
          city: "Lahore",
          online: false,
          computedStatus: "in_progress",
          description: "Running drive with closed apps",
          capacity: 10,
          filledCount: 10,
          applicationDeadline: "2020-01-01T00:00:00Z", // passed deadline
          activityStartAt: "2020-01-02T00:00:00Z",
          activityEndAt: "2099-01-01T00:00:00Z",
          deactivatedAt: null,
        },
        {
          id: "opp-standard-closed",
          name: "Standard Closed Drive",
          orgName: "Green Org",
          orgLogoUrl: null,
          type: "education",
          city: "Karachi",
          online: false,
          computedStatus: "closed",
          description: "Closed drive",
          capacity: null,
          filledCount: 0,
          applicationDeadline: "2020-01-01T00:00:00Z",
          activityStartAt: null,
          activityEndAt: null,
          deactivatedAt: null,
        },
        {
          id: "opp-open",
          name: "Active Open Drive",
          orgName: "Green Org",
          orgLogoUrl: null,
          type: "health",
          city: "Islamabad",
          online: false,
          computedStatus: "open",
          description: "Open drive",
          capacity: 20,
          filledCount: 2,
          applicationDeadline: "2099-01-01T00:00:00Z",
          activityStartAt: null,
          activityEndAt: null,
          deactivatedAt: null,
        },
      ],
      total: 3,
      facets: { cities: [], orgs: [] },
    });

    const user = userEvent.setup();
    renderWithSwr(<YouthRepublicOpportunitiesPage />);
    await screen.findByText("Live Drive Closed Apps");

    // Live drive has Live pill
    expect(screen.getByText("Live")).toBeInTheDocument();

    // Select Applications closed status filter
    const trigger = screen.getByRole("combobox", { name: "Filter by status" });
    await user.click(trigger);
    const closedOpt = await screen.findByRole("option", { name: "Applications closed" });
    await user.click(closedOpt);

    // Both closed drives are shown, active open drive is hidden
    expect(screen.getByText("Live Drive Closed Apps")).toBeInTheDocument();
    expect(screen.getByText("Standard Closed Drive")).toBeInTheDocument();
    expect(screen.queryByText("Active Open Drive")).not.toBeInTheDocument();
  });

  it("renders Impact & Stats button instead of View Applicants on completed drives and opens modal", async () => {
    vi.mocked(youthRepublicFunctions.listActivityHours).mockResolvedValue({
      activity: [
        {
          id: "act-1",
          volunteerName: "Ali",
          opportunityName: "Tree Plantation Drive",
          activityType: "environment",
          role: null,
          activityDate: "2026-05-01",
          hoursSubmitted: 4,
          hoursVerified: 4,
          verificationStatus: "verified",
          adminNotes: null,
        },
      ],
      total: 1,
    });
    vi.mocked(youthRepublicFunctions.listOpportunities).mockResolvedValue({
      opportunities: [
        {
          id: "opp-completed",
          name: "Tree Plantation Drive",
          orgName: "Green Org",
          orgLogoUrl: null,
          type: "environment",
          city: "Lahore",
          online: false,
          computedStatus: "completed",
          description: "All trees planted",
          capacity: null,
          filledCount: 15,
          applicationDeadline: null,
          activityStartAt: null,
          activityEndAt: null,
          deactivatedAt: null,
          impactStats: { fundsCollected: "PKR 50,000" },
        },
      ],
      total: 1,
      facets: { cities: [], orgs: [] },
    });

    const user = userEvent.setup();
    renderWithSwr(<YouthRepublicOpportunitiesPage />);
    await screen.findByText("Tree Plantation Drive");

    // Capacity is null, so capacity row and fill bar should NOT be shown
    expect(screen.queryByText(/Capacity:/i)).not.toBeInTheDocument();

    // Completed drive should have Impact & Stats button instead of View Applicants
    expect(screen.queryByRole("link", { name: /View Applicants/i })).not.toBeInTheDocument();
    const statsBtn = screen.getByRole("button", { name: /Impact & Stats/i });
    expect(statsBtn).toBeInTheDocument();

    // Click Impact & Stats
    await user.click(statsBtn);
    expect(await screen.findByRole("heading", { name: "Impact & Stats" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("PKR 50,000")).toBeInTheDocument();
  });

  it("shows capacity, edit and view applicants in footer, without archive button for active cards", async () => {
    renderWithSwr(<YouthRepublicOpportunitiesPage />);
    await screen.findByText("Beach Cleanup");
    expect(screen.getByText("Capacity: 3 / 20")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Edit/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /View Applicants/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Archive" })).not.toBeInTheDocument();
  });

  it("shows only restore and delete buttons when an opportunity is archived", async () => {
    vi.mocked(youthRepublicFunctions.listOpportunities).mockResolvedValue({
      opportunities: [
        {
          id: "opp-archived",
          name: "Archived Project",
          orgName: "Green Org",
          orgLogoUrl: null,
          type: "community",
          city: "Lahore",
          online: false,
          computedStatus: "closed",
          description: "An archived drive",
          capacity: 10,
          filledCount: 5,
          applicationDeadline: null,
          activityStartAt: null,
          activityEndAt: null,
          deactivatedAt: "2026-01-01T00:00:00Z",
        },
      ],
      total: 1,
      facets: { cities: [], orgs: [] },
    });

    renderWithSwr(<YouthRepublicOpportunitiesPage />);
    await screen.findByText("Archived Project");
    expect(screen.getByRole("button", { name: "Restore" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Edit/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /View Applicants/i })).not.toBeInTheDocument();
    // Capacity is hidden on archived cards.
    expect(screen.queryByText(/Capacity:/i)).not.toBeInTheDocument();
  });

  it("shows a Draft pill and a Publish drive button instead of View Applicants for draft drives", async () => {
    vi.mocked(youthRepublicFunctions.listOpportunities).mockResolvedValue({
      opportunities: [
        {
          id: "opp-draft",
          name: "Unfinished Drive",
          orgName: "Green Org",
          orgLogoUrl: null,
          type: "environment",
          city: "Lahore",
          online: false,
          computedStatus: "draft",
          description: "A work in progress",
          capacity: 10,
          filledCount: 0,
          applicationDeadline: null,
          activityStartAt: null,
          activityEndAt: null,
          deactivatedAt: null,
        },
      ],
      total: 1,
      facets: { cities: [], orgs: [] },
    });

    renderWithSwr(<YouthRepublicOpportunitiesPage />);
    await screen.findByText("Unfinished Drive");
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.getByText("Not published yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Publish drive/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /View Applicants/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Edit/i })).toBeInTheDocument();
  });

  it("renders Drives Noticeboard heading without uppercase class", async () => {
    renderWithSwr(<YouthRepublicOpportunitiesPage />);
    await screen.findByText("Beach Cleanup");
    const heading = screen.getByRole("heading", { name: "Drives Noticeboard", level: 1 });
    expect(heading).toBeInTheDocument();
    expect(heading.className).not.toContain("uppercase");
  });

  it("renders borderless Back to Drives button when in create or edit mode", async () => {
    const user = userEvent.setup();
    renderWithSwr(<YouthRepublicOpportunitiesPage />);
    await screen.findByText("Beach Cleanup");
    await user.click(screen.getByRole("button", { name: "Create Drive" }));

    const backBtn = screen.getByRole("button", { name: /Back to Drives/i });
    expect(backBtn).toBeInTheDocument();
    expect(backBtn.className).toContain("border-0");
  });

  it("deletes an archived opportunity using updateOpportunity with hardDelete", async () => {
    window.confirm = vi.fn().mockReturnValue(true);
    vi.mocked(youthRepublicFunctions.updateOpportunity).mockResolvedValue({ opportunityId: "opp-archived" });
    vi.mocked(youthRepublicFunctions.listOpportunities).mockResolvedValue({
      opportunities: [
        {
          id: "opp-archived",
          name: "Archived Project",
          orgName: "Green Org",
          orgLogoUrl: null,
          type: "environment",
          city: "Karachi",
          online: false,
          computedStatus: "closed",
          description: "Completed project",
          capacity: 20,
          filledCount: 3,
          applicationDeadline: null,
          activityStartAt: null,
          activityEndAt: null,
          deactivatedAt: "2026-01-01T00:00:00Z",
        },
      ],
      total: 1,
      facets: { cities: [], orgs: [] },
    });

    const user = userEvent.setup();
    renderWithSwr(<YouthRepublicOpportunitiesPage />);
    await screen.findByText("Archived Project");

    const delBtn = screen.getByRole("button", { name: "Delete" });
    await user.click(delBtn);

    await waitFor(() => {
      expect(youthRepublicFunctions.updateOpportunity).toHaveBeenCalledWith(
        { opportunityId: "opp-archived", organizationId: "org-1", hardDelete: true },
        "staff-jwt",
      );
    });
  });
});

import { render, screen, waitFor } from "@testing-library/react";
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
  return { ...actual, useSelectedOrg: vi.fn() };
});

describe("YouthRepublicOpportunitiesPage", () => {
  beforeEach(() => {
    vi.mocked(shell.useSelectedOrg).mockReturnValue("org-1");
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
    render(<YouthRepublicOpportunitiesPage />);
    expect(await screen.findByText("Beach Cleanup")).toBeInTheDocument();
    expect(screen.getAllByText("Open").length).toBeGreaterThan(0);
  });

  it("refreshes the list after a new opportunity is created", async () => {
    render(<YouthRepublicOpportunitiesPage />);
    await screen.findByText("Beach Cleanup");
    expect(youthRepublicFunctions.listOpportunities).toHaveBeenCalledTimes(1);
  });

  it("does not render search or status filters", async () => {
    render(<YouthRepublicOpportunitiesPage />);
    await screen.findByText("Beach Cleanup");
    expect(screen.queryByPlaceholderText(/Search by name/i)).not.toBeInTheDocument();
    expect(screen.queryByText("All Statuses")).not.toBeInTheDocument();
  });

  it("shows capacity, edit and view applicants in footer, without archive button for active cards", async () => {
    render(<YouthRepublicOpportunitiesPage />);
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

    render(<YouthRepublicOpportunitiesPage />);
    await screen.findByText("Archived Project");
    expect(screen.getByRole("button", { name: "Restore" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Edit/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /View Applicants/i })).not.toBeInTheDocument();
    // Capacity is hidden on archived cards.
    expect(screen.queryByText(/Capacity:/i)).not.toBeInTheDocument();
  });

  it("renders Opportunities Noticeboard heading without uppercase class", async () => {
    render(<YouthRepublicOpportunitiesPage />);
    await screen.findByText("Beach Cleanup");
    const heading = screen.getByRole("heading", { name: "Opportunities Noticeboard", level: 1 });
    expect(heading).toBeInTheDocument();
    expect(heading.className).not.toContain("uppercase");
  });

  it("renders borderless Back to Opportunities button when in create or edit mode", async () => {
    const user = userEvent.setup();
    render(<YouthRepublicOpportunitiesPage />);
    await screen.findByText("Beach Cleanup");
    await user.click(screen.getByRole("button", { name: "Create Opportunity" }));

    const backBtn = screen.getByRole("button", { name: /Back to Opportunities/i });
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
    render(<YouthRepublicOpportunitiesPage />);
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

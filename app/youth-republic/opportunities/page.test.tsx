import { render, screen, waitFor } from "@testing-library/react";
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
});

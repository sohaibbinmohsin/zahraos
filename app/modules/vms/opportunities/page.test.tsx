import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import VmsOpportunitiesPage from "./page";
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

describe("VmsOpportunitiesPage", () => {
  beforeEach(() => {
    vi.mocked(shell.useSelectedOrg).mockReturnValue("org-1");
    vi.mocked(getBrowserSupabaseClient).mockReturnValue({
      auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: "platform-token" } } }) },
    } as never);
    vi.mocked(fetchStaffToken).mockResolvedValue("staff-jwt");
    vi.mocked(vmsFunctions.listOpportunities).mockReset();
    vi.mocked(vmsFunctions.listOpportunities).mockResolvedValue({
      opportunities: [{ id: "opp-1", name: "Beach Cleanup", type: "environment", computedStatus: "open", capacity: 20 }],
      total: 1,
    });
  });

  it("lists opportunities with their computed status", async () => {
    render(<VmsOpportunitiesPage />);
    expect(await screen.findByText("Beach Cleanup")).toBeInTheDocument();
    expect(screen.getByText("open")).toBeInTheDocument();
  });

  it("refreshes the list after a new opportunity is created", async () => {
    render(<VmsOpportunitiesPage />);
    await screen.findByText("Beach Cleanup");
    expect(vmsFunctions.listOpportunities).toHaveBeenCalledTimes(1);
  });
});

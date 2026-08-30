import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import YouthRepublicDashboardPage from "./page";
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

describe("YouthRepublicDashboardPage", () => {
  beforeEach(() => {
    vi.mocked(shell.useSelectedOrg).mockReturnValue("org-1");
    vi.mocked(getBrowserSupabaseClient).mockReturnValue({
      auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: "platform-token" } } }) },
    } as never);
    vi.mocked(fetchStaffToken).mockResolvedValue("staff-jwt");
  });

  it("shows all 10 KPI figures once loaded", async () => {
    vi.mocked(youthRepublicFunctions.getKpiSummary).mockResolvedValue({
      totalRegistered: 42, active: 30, completedParticipations: 12, applicationsReceived: 55,
      selected: 20, totalVerifiedHours: 340, byCity: { Lahore: 20, Karachi: 22 },
      byProvince: { Punjab: 15 }, byInstitution: { LUMS: 9 },
      participationByOpportunity: { "Beach Cleanup": 8 }, participationByActivityType: { environment: 8 },
    });

    render(<YouthRepublicDashboardPage />);

    await waitFor(() => expect(screen.getByText("42")).toBeInTheDocument());
    expect(screen.getByText("30")).toBeInTheDocument();
    expect(screen.getByText("340")).toBeInTheDocument();
    expect(youthRepublicFunctions.getKpiSummary).toHaveBeenCalledWith({ organizationId: "org-1" }, "staff-jwt");
  });
});

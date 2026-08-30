import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import VmsVolunteerDetailPage from "./page";
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
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "vol-1" }),
}));

describe("VmsVolunteerDetailPage", () => {
  beforeEach(() => {
    vi.mocked(shell.useSelectedOrg).mockReturnValue("org-1");
    vi.mocked(getBrowserSupabaseClient).mockReturnValue({
      auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: "platform-token" } } }) },
    } as never);
    vi.mocked(fetchStaffToken).mockResolvedValue("staff-jwt");
  });

  it("shows the volunteer's profile, applications, participations, and activity (with admin notes)", async () => {
    vi.mocked(vmsFunctions.getVolunteerDetail).mockResolvedValue({
      id: "vol-1", volunteerCode: "YR-2026-00001", fullName: "Aisha Khan", email: "aisha@example.com",
      phone: "0300-1111111", city: "Lahore", province: "Punjab", institution: "LUMS", status: "active",
      applications: [{ id: "app-1", status: "selected", opportunityName: "Beach Cleanup", appliedAt: "2026-01-01T00:00:00Z" }],
      participations: [{ id: "p-1", status: "completed", opportunityName: "Beach Cleanup" }],
      activity: [{
        id: "ah-1", role: "Lead", activityDate: "2026-02-01", hoursSubmitted: 5, hoursVerified: 5,
        verificationStatus: "verified", adminNotes: "Showed great leadership", opportunityName: "Beach Cleanup",
      }],
    });

    render(<VmsVolunteerDetailPage />);

    expect(await screen.findByText("Aisha Khan")).toBeInTheDocument();
    expect(screen.getByText("Beach Cleanup")).toBeInTheDocument();
    expect(screen.getByText("Showed great leadership")).toBeInTheDocument();
    expect(vmsFunctions.getVolunteerDetail).toHaveBeenCalledWith(
      { organizationId: "org-1", volunteerId: "vol-1" },
      "staff-jwt",
    );
  });
});

import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import YouthRepublicModuleLayout from "./layout";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { fetchStaffToken } from "@/lib/staffToken";
import { listApplications, listActivityHours } from "@/lib/youthRepublicFunctions";

vi.mock("next/navigation", () => ({
  usePathname: () => "/youth-republic/dashboard",
}));
vi.mock("@/components/shell/AppShell", () => ({
  useSelectedOrg: () => "org-1",
}));
vi.mock("@/lib/supabase/browserClient", () => ({
  getBrowserSupabaseClient: () => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: "mock-access-token" } },
      }),
    },
  }),
}));
vi.mock("@/lib/staffToken", () => ({
  fetchStaffToken: vi.fn().mockResolvedValue("mock-staff-token"),
}));
vi.mock("@/lib/youthRepublicFunctions", () => ({
  listApplications: vi.fn().mockResolvedValue({
    applications: [
      { id: "a1", status: "submitted" },
      { id: "a2", status: "under_review" },
      { id: "a3", status: "approved" },
    ],
  }),
  listActivityHours: vi.fn().mockResolvedValue({
    activity: [
      { id: "h1", verificationStatus: "pending" },
      { id: "h2", verificationStatus: "verified" },
    ],
  }),
}));

describe("YouthRepublicModuleLayout", () => {
  it("renders a tab for each of the 5 admin screens plus the page content", async () => {
    render(
      <YouthRepublicModuleLayout>
        <p>screen content</p>
      </YouthRepublicModuleLayout>,
    );

    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Volunteers" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Drives" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Applications" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Hours" })).toBeInTheDocument();
    expect(screen.getByText("screen content")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("2 pending")).toBeInTheDocument());
  });

  it("does not render a badge for Opportunities, but renders pending badges for Applications and Hours", async () => {
    render(
      <YouthRepublicModuleLayout>
        <p>screen content</p>
      </YouthRepublicModuleLayout>,
    );

    const oppsLink = screen.getByRole("link", { name: "Drives" });
    const appsLink = screen.getByRole("link", { name: "Applications" });
    const hoursLink = screen.getByRole("link", { name: "Hours" });

    // Wait for async badges to load
    await waitFor(() => {
      expect(appsLink).toHaveTextContent("2 pending");
      expect(hoursLink).toHaveTextContent("1 pending");
    });

    // Opportunities tab must never have a count badge
    expect(oppsLink.querySelector(".count-badge")).toBeNull();
  });
});

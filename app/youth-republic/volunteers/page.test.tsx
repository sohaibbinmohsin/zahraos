import { screen, waitFor } from "@testing-library/react";
import { renderWithSwr } from "@/tests/renderWithSwr";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import YouthRepublicVolunteersPage from "./page";
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

describe("YouthRepublicVolunteersPage", () => {
  beforeEach(() => {
    vi.mocked(shell.useSelectedOrg).mockReturnValue("org-1");
    vi.mocked(shell.useShellStaffToken).mockReturnValue("staff-jwt");
    vi.mocked(getBrowserSupabaseClient).mockReturnValue({
      auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: "platform-token" } } }) },
    } as never);
    vi.mocked(fetchStaffToken).mockResolvedValue("staff-jwt");
    vi.mocked(youthRepublicFunctions.listVolunteers).mockReset();
  });

  it("lists volunteers and re-fetches (debounced) as the search term is typed", async () => {
    vi.mocked(youthRepublicFunctions.listVolunteers).mockResolvedValue({
      volunteers: [{
        id: "vol-1", volunteerCode: "YR-2026-00001", fullName: "Aisha Khan", email: "aisha@example.com",
        phone: "0300-1111111", city: "Lahore", province: "Punjab", institution: "LUMS", status: "active",
      }],
      total: 1,
    });
    const user = userEvent.setup();

    renderWithSwr(<YouthRepublicVolunteersPage />);

    expect(await screen.findByText("Aisha Khan")).toBeInTheDocument();

    expect(screen.queryByRole("button", { name: "Search" })).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Search"), "Aisha");

    await waitFor(() => {
      expect(youthRepublicFunctions.listVolunteers).toHaveBeenLastCalledWith(
        expect.objectContaining({ organizationId: "org-1", search: "Aisha" }),
        "staff-jwt",
      );
    });
  });

  it("links each row to its volunteer detail page", async () => {
    vi.mocked(youthRepublicFunctions.listVolunteers).mockResolvedValue({
      volunteers: [{
        id: "vol-1", volunteerCode: "YR-2026-00001", fullName: "Aisha Khan", email: "aisha@example.com",
        phone: "0300-1111111", city: "Lahore", province: "Punjab", institution: "LUMS", status: "active",
      }],
      total: 1,
    });

    renderWithSwr(<YouthRepublicVolunteersPage />);

    const link = await screen.findByRole("link", { name: "Aisha Khan" });
    expect(link).toHaveAttribute("href", "/youth-republic/volunteers/vol-1");
  });
});

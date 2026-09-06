import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

const updateOrg = vi.fn().mockResolvedValue({ enabledModuleKeys: [] });
const listCh = vi.fn().mockResolvedValue({ chapters: [{ id: "c1", name: "Rizq LUMS", city: "Lahore", status: "active" }] });
const createCh = vi.fn().mockResolvedValue({ chapterId: "c2" });
vi.mock("@/lib/platformFunctions", () => ({
  updateOrganization: (...a: unknown[]) => updateOrg(...a),
  listChapters: (...a: unknown[]) => listCh(...a),
  createChapter: (...a: unknown[]) => createCh(...a),
  updateChapter: vi.fn(),
}));
vi.mock("@/components/shell/ToastContext", () => ({ useToast: () => ({ showToast: vi.fn() }) }));
let isOrgAdmin = true;
let shellLoading = false;
vi.mock("@/components/shell/AppShell", () => ({
  useSelectedOrg: () => "org-1",
  useShellAccessToken: () => "access-token",
  useIsOrgAdminOrAbove: () => isOrgAdmin,
  useShellLoading: () => shellLoading,
}));
const from = vi.fn();
vi.mock("@/lib/supabase/browserClient", () => ({
  getBrowserSupabaseClient: () => ({
    from: (t: string) => from(t),
  }),
}));

import OrganizationPage from "./page";

describe("OrganizationPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isOrgAdmin = true;
    shellLoading = false;
    from.mockImplementation(() => ({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { name: "Rizq", about: "help", brand_color: "#111111", logo_url: null, favicon_url: null } }) }) }),
    }));
  });

  it("loads the org profile and its chapters, and saves the profile", async () => {
    const user = userEvent.setup();
    render(<OrganizationPage />);
    await waitFor(() => expect(screen.getByDisplayValue("Rizq")).toBeInTheDocument());
    expect(screen.getByText("Rizq LUMS")).toBeInTheDocument();

    await user.clear(screen.getByLabelText(/Organization name/i));
    await user.type(screen.getByLabelText(/Organization name/i), "Rizq Foundation");
    await user.click(screen.getByRole("button", { name: /Save profile/i }));
    await waitFor(() => expect(updateOrg).toHaveBeenCalledTimes(1));
    expect(updateOrg.mock.calls[0][0]).toMatchObject({ organizationId: "org-1", name: "Rizq Foundation" });
  });

  it("adds a chapter", async () => {
    const user = userEvent.setup();
    render(<OrganizationPage />);
    await waitFor(() => expect(screen.getByText("Rizq LUMS")).toBeInTheDocument());
    await user.type(screen.getByLabelText("Chapter name"), "Rizq NUST");
    await user.click(screen.getByRole("button", { name: "Add Chapter" }));
    await waitFor(() => expect(createCh).toHaveBeenCalledWith({ organizationId: "org-1", name: "Rizq NUST" }, "access-token"));
  });

  it("blocks a non-admin with an access message and no editor", () => {
    isOrgAdmin = false;
    render(<OrganizationPage />);
    expect(screen.getByText(/organization admin access/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Organization name/i)).not.toBeInTheDocument();
  });
});

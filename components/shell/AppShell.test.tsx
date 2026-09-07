import { render, screen, waitFor, within, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AppShell } from "./AppShell";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { fetchStaffToken } from "@/lib/staffToken";

const { routerPush, routerRefresh } = vi.hoisted(() => ({
  routerPush: vi.fn(),
  routerRefresh: vi.fn(),
}));

vi.mock("@/lib/supabase/browserClient");
vi.mock("@/lib/staffToken", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/staffToken")>();
  return { ...actual, fetchStaffToken: vi.fn() };
});
vi.mock("@/lib/youthRepublicFunctions", () => ({
  listApplications: vi.fn().mockResolvedValue({
    applications: [
      { id: "app-1", status: "submitted" },
      { id: "app-2", status: "under_review" },
      { id: "app-3", status: "approved" },
    ],
  }),
  listActivityHours: vi.fn().mockResolvedValue({
    activity: [
      { id: "h-1", verificationStatus: "pending" },
      { id: "h-2", verificationStatus: "approved" },
    ],
  }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush, refresh: routerRefresh }),
}));

function encodeFakeToken(payload: Record<string, unknown>) {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.sig`;
}

function mockSupabase(options: {
  initialSession?: { access_token: string; user?: { id?: string; email?: string } } | null;
  staffRow: { full_name: string; platform_owner: boolean; email?: string };
  orgTierRows: Array<{ organization_id: string; org_tier: string }>;
  organizations: Array<{ id: string; name: string; logo_url?: string | null; brand_color?: string | null }>;
  staffRoleAssignments?: Array<{ staff_id: string }>;
  activeStaffRows?: Array<{ id: string }>;
}) {
  const authStateListeners: Array<(event: string, session: { access_token: string } | null) => void> = [];

  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: options.initialSession === undefined ? { access_token: "platform-token" } : options.initialSession },
      }),
      onAuthStateChange: vi.fn((callback: (event: string, session: { access_token: string } | null) => void) => {
        authStateListeners.push(callback);
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    from(table: string) {
      if (table === "staff") {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: options.staffRow, error: null }),
            }),
            in: () => ({
              eq: () => Promise.resolve({ data: options.activeStaffRows ?? [{ id: "s1" }, { id: "s2" }, { id: "s3" }, { id: "s4" }], error: null }),
            }),
          }),
        };
      }
      if (table === "staff_org_roles") {
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: options.orgTierRows, error: null }),
          }),
        };
      }
      if (table === "organizations") {
        return {
          select: () => ({
            in: () => Promise.resolve({ data: options.organizations, error: null }),
            then: (resolve: (value: { data: typeof options.organizations; error: null }) => void) =>
              resolve({ data: options.organizations, error: null }),
          }),
        };
      }
      if (table === "staff_role_assignments") {
        return {
          select: () => ({
            eq: () => Promise.resolve({
              data: options.staffRoleAssignments ?? [{ staff_id: "s1" }, { staff_id: "s2" }, { staff_id: "s3" }, { staff_id: "s4" }],
              error: null,
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
    __emitAuthStateChange(event: string, session: { access_token: string } | null) {
      for (const listener of authStateListeners) listener(event, session);
    },
  };
}

describe("AppShell", () => {
  beforeEach(() => {
    vi.mocked(fetchStaffToken).mockReset();
    routerPush.mockReset();
    routerRefresh.mockReset();
  });

  it("renders children, the staff's name, and an Organizations link for a platform_owner", async () => {
    vi.mocked(getBrowserSupabaseClient).mockReturnValue(
      mockSupabase({
        staffRow: { full_name: "Owner Person", platform_owner: true },
        orgTierRows: [],
        organizations: [],
      }) as never,
    );
    vi.mocked(fetchStaffToken).mockResolvedValue(
      encodeFakeToken({ actor_type: "staff", staff_id: "s1", platform_owner: true, org_roles: [], module_access: [] }),
    );

    render(
      <AppShell>
        <p>page content</p>
      </AppShell>,
    );

    // The shell holds page content back behind a skeleton until the account
    // (and its selected org) resolves, so no screen flashes a "select an
    // organization" empty state during hydration.
    await waitFor(() => expect(screen.getByText("Owner Person")).toBeInTheDocument());
    expect(screen.getByText("page content")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Organizations" })).toBeInTheDocument();
  });

  it("shows Team & Access links for a platform_owner even with no staff_org_roles row, and lets them pick any organization", async () => {
    vi.mocked(getBrowserSupabaseClient).mockReturnValue(
      mockSupabase({
        staffRow: { full_name: "Owner Person", platform_owner: true },
        // A platform_owner deliberately has NO staff_org_roles row — their
        // authority is the global flag, not a per-org tier assignment.
        orgTierRows: [],
        // Two orgs: the switcher intentionally hides itself for a single
        // option (OrgSwitcher.tsx), so this also proves the switcher
        // actually renders with every org, not just that Staff/Roles show.
        organizations: [
          { id: "org-1", name: "Rizq Test Org" },
          { id: "org-2", name: "Some Other Org" },
        ],
      }) as never,
    );
    vi.mocked(fetchStaffToken).mockResolvedValue(
      // org_roles/module_access are empty too — mintStaffToken never
      // populates them from a bare platform_owner flag alone.
      encodeFakeToken({ actor_type: "staff", staff_id: "s1", platform_owner: true, org_roles: [], module_access: [] }),
    );

    render(
      <AppShell>
        <p>page content</p>
      </AppShell>,
    );

    await waitFor(() => expect(screen.getByRole("link", { name: "Team Members" })).toBeInTheDocument());
    expect(screen.getByRole("link", { name: "Roles & Permissions" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Audit Log" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Organization" })).toBeInTheDocument();
    const switcher = screen.getByRole("combobox", { name: "Organization" });
    expect(within(switcher).getByRole("option", { name: "Rizq Test Org" })).toBeInTheDocument();
    expect(within(switcher).getByRole("option", { name: "Some Other Org" })).toBeInTheDocument();
    expect(switcher).toHaveValue("org-1");
  });

  it("shows Team & Access links only when the staff is admin/super_admin for the selected org", async () => {
    vi.mocked(getBrowserSupabaseClient).mockReturnValue(
      mockSupabase({
        staffRow: { full_name: "Org Admin", platform_owner: false },
        orgTierRows: [{ organization_id: "org-1", org_tier: "admin" }],
        organizations: [{ id: "org-1", name: "Rizq" }],
      }) as never,
    );
    vi.mocked(fetchStaffToken).mockResolvedValue(
      encodeFakeToken({
        actor_type: "staff",
        staff_id: "s2",
        platform_owner: false,
        org_roles: [{ organization_id: "org-1" }],
        module_access: [],
      }),
    );

    render(
      <AppShell>
        <p>page content</p>
      </AppShell>,
    );

    await waitFor(() => expect(screen.getByRole("link", { name: "Team Members" })).toBeInTheDocument());
    expect(screen.getByRole("link", { name: "Roles & Permissions" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Audit Log" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Organization" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Organizations" })).not.toBeInTheDocument();
  });

  it("shows neither Team & Access nor Organizations for a regular staff member with no org_tier", async () => {
    vi.mocked(getBrowserSupabaseClient).mockReturnValue(
      mockSupabase({
        staffRow: { full_name: "Regular Staff", platform_owner: false },
        orgTierRows: [],
        organizations: [{ id: "org-1", name: "Rizq" }],
      }) as never,
    );
    vi.mocked(fetchStaffToken).mockResolvedValue(
      encodeFakeToken({
        actor_type: "staff",
        staff_id: "s3",
        platform_owner: false,
        org_roles: [],
        module_access: [{ organization_id: "org-1", module: "youth-republic", permissions: ["applications:read"] }],
      }),
    );

    render(
      <AppShell>
        <p>page content</p>
      </AppShell>,
    );

    await waitFor(() => expect(screen.getByText("Regular Staff")).toBeInTheDocument());
    expect(screen.queryByRole("link", { name: "Team Members" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Roles & Permissions" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Audit Log" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Organization" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Organizations" })).not.toBeInTheDocument();
  });

  it("loads claims once a login completes after mount, without requiring a reload", async () => {
    const supabaseClient = mockSupabase({
      initialSession: null,
      staffRow: { full_name: "Late Login Person", platform_owner: false },
      orgTierRows: [{ organization_id: "org-1", org_tier: "admin" }],
      organizations: [{ id: "org-1", name: "Rizq" }],
    });
    vi.mocked(getBrowserSupabaseClient).mockReturnValue(supabaseClient as never);
    vi.mocked(fetchStaffToken).mockResolvedValue(
      encodeFakeToken({
        actor_type: "staff",
        staff_id: "s4",
        platform_owner: false,
        org_roles: [{ organization_id: "org-1" }],
        module_access: [],
      }),
    );

    render(
      <AppShell>
        <p>page content</p>
      </AppShell>,
    );

    // Mounted before the session was hydrated: no staff name or nav yet.
    expect(screen.queryByText("Late Login Person")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Team Members" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Organization" })).not.toBeInTheDocument();

    // Simulate the login completing after mount via Supabase's auth state change event.
    await act(async () => {
      supabaseClient.__emitAuthStateChange("SIGNED_IN", { access_token: "fresh-token" });
    });

    await waitFor(() => expect(screen.getByText("Late Login Person")).toBeInTheDocument());
    expect(screen.getByRole("link", { name: "Team Members" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Roles & Permissions" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Audit Log" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Organization" })).toBeInTheDocument();
  });

  it("signs the staff out, clears the shell's claims, and redirects to login", async () => {
    const supabaseClient = mockSupabase({
      staffRow: { full_name: "Owner Person", platform_owner: true },
      orgTierRows: [],
      organizations: [],
    });
    vi.mocked(getBrowserSupabaseClient).mockReturnValue(supabaseClient as never);
    vi.mocked(fetchStaffToken).mockResolvedValue(
      encodeFakeToken({ actor_type: "staff", staff_id: "s1", platform_owner: true, org_roles: [], module_access: [] }),
    );

    const user = userEvent.setup();
    render(
      <AppShell>
        <p>page content</p>
      </AppShell>,
    );

    await waitFor(() => expect(screen.getByText("Owner Person")).toBeInTheDocument());
    expect(screen.getByRole("link", { name: "Organizations" })).toBeInTheDocument();

    // The separate header button is removed; signing out happens via the user profile dropdown
    expect(screen.queryByRole("button", { name: "Sign out" })).not.toBeInTheDocument();
    await user.click(screen.getByLabelText("User Profile Menu"));
    await user.click(screen.getByRole("button", { name: "Sign Out" }));

    expect(supabaseClient.auth.signOut).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByText("Owner Person")).not.toBeInTheDocument());
    expect(screen.queryByRole("link", { name: "Organizations" })).not.toBeInTheDocument();
    expect(routerPush).toHaveBeenCalledWith("/login");
  });

  it("displays the user's email instead of staff ID in the profile dropdown menu", async () => {
    vi.mocked(getBrowserSupabaseClient).mockReturnValue(
      mockSupabase({
        staffRow: { full_name: "Sohaib Mohsin", platform_owner: true, email: "sohaib@youthrepublic.org" },
        orgTierRows: [],
        organizations: [],
      }) as never,
    );
    vi.mocked(fetchStaffToken).mockResolvedValue(
      encodeFakeToken({ actor_type: "staff", staff_id: "s1-abc-123456", platform_owner: true, org_roles: [], module_access: [] }),
    );

    const user = userEvent.setup();
    render(
      <AppShell>
        <p>page content</p>
      </AppShell>,
    );

    await waitFor(() => expect(screen.getByText("Sohaib Mohsin")).toBeInTheDocument());
    await user.click(screen.getByLabelText("User Profile Menu"));

    expect(screen.getByText("sohaib@youthrepublic.org")).toBeInTheDocument();
    expect(screen.queryByText(/ID: s1-abc/i)).not.toBeInTheDocument();
  });

  it("displays highest access role in the user pill and all roles in the dropdown card in Title Case", async () => {
    vi.mocked(getBrowserSupabaseClient).mockReturnValue(
      mockSupabase({
        staffRow: { full_name: "Rizq Admin", platform_owner: false, email: "admin@rizq.example.com" },
        orgTierRows: [{ organization_id: "org-1", org_tier: "super_admin" }],
        organizations: [{ id: "org-1", name: "Rizq" }],
      }) as never,
    );
    vi.mocked(fetchStaffToken).mockResolvedValue(
      encodeFakeToken({ actor_type: "staff", staff_id: "s1", platform_owner: false, org_roles: [{ organization_id: "org-1" }], module_access: [] }),
    );

    const user = userEvent.setup();
    render(
      <AppShell>
        <p>page content</p>
      </AppShell>,
    );

    await waitFor(() => expect(screen.getByText("Rizq Admin")).toBeInTheDocument());

    // In pill, should show Super Admin (highest access, Title Case, not all caps "ADMIN")
    expect(screen.getByText("Super Admin")).toBeInTheDocument();

    // Open dropdown card
    await user.click(screen.getByLabelText("User Profile Menu"));
    expect(screen.getByText("admin@rizq.example.com")).toBeInTheDocument();
    expect(screen.getAllByText("Super Admin").length).toBeGreaterThanOrEqual(1);
  });

  it("renders the selected org's name and logo in the sidebar, and ZahraOS 2026 with Mohsin bird logo in footer", async () => {
    vi.mocked(getBrowserSupabaseClient).mockReturnValue(
      mockSupabase({
        staffRow: { full_name: "Admin Staff", platform_owner: true },
        orgTierRows: [],
        organizations: [{ id: "org-1", name: "Rizq Foundation", logo_url: "https://cdn.example.com/rizq.png", brand_color: "#C0392B" }],
      }) as never,
    );
    vi.mocked(fetchStaffToken).mockResolvedValue(
      encodeFakeToken({ actor_type: "staff", staff_id: "s1", platform_owner: true, org_roles: [], module_access: [] }),
    );

    render(
      <AppShell>
        <p>page content</p>
      </AppShell>,
    );

    await waitFor(() => expect(screen.getByText("Admin Staff")).toBeInTheDocument());

    // Sidebar brand header: the selected org's name + its uploaded logo
    await waitFor(() => expect(screen.getByText("Rizq Foundation")).toBeInTheDocument());
    const orgLogoImg = screen.getByRole("img", { name: "Rizq Foundation logo" });
    expect(orgLogoImg).toHaveAttribute("src", "https://cdn.example.com/rizq.png");

    // Sidebar footer: ZahraOS © 2026 and Mohsin Project white bird
    expect(screen.getByText(/ZahraOS © 2026/i)).toBeInTheDocument();
    expect(screen.getByText("A free software by The Mohsin Project")).toBeInTheDocument();
    const birdImg = screen.getByRole("img", { name: "The Mohsin Project" });
    expect(birdImg).toHaveAttribute("src", "/assets/mohsin-project-white-bird.png");

    // Sidebar badges: Opportunities and Volunteers have no badges
    expect(document.getElementById("side-badge-opps")).toBeNull();
    expect(document.getElementById("side-badge-vols")).toBeNull();

    // Applications, Hours, and Team Members have dynamic counts
    await waitFor(() => {
      expect(document.getElementById("side-badge-apps")).toHaveTextContent("2");
      expect(document.getElementById("side-badge-hours")).toHaveTextContent("1");
      expect(document.getElementById("side-badge-team")).toHaveTextContent("4");
    });
  });

  it("falls back to org initials in the sidebar when the org has no logo", async () => {
    vi.mocked(getBrowserSupabaseClient).mockReturnValue(
      mockSupabase({
        staffRow: { full_name: "Admin Staff", platform_owner: true },
        orgTierRows: [],
        organizations: [{ id: "org-1", name: "Green Earth Trust", logo_url: null, brand_color: "#1F7A1F" }],
      }) as never,
    );
    vi.mocked(fetchStaffToken).mockResolvedValue(
      encodeFakeToken({ actor_type: "staff", staff_id: "s1", platform_owner: true, org_roles: [], module_access: [] }),
    );

    render(
      <AppShell>
        <p>page content</p>
      </AppShell>,
    );

    await waitFor(() => expect(screen.getByText("Green Earth Trust")).toBeInTheDocument());
    expect(screen.queryByRole("img", { name: /Green Earth Trust logo/i })).not.toBeInTheDocument();
    // Two-letter initials chip
    expect(screen.getByText("GE")).toBeInTheDocument();
  });

  it("toggles sidebar collapsed state via toggle button, logo button, and empty sidebar click", async () => {
    vi.mocked(getBrowserSupabaseClient).mockReturnValue(
      mockSupabase({
        staffRow: { full_name: "Admin Staff", platform_owner: true },
        orgTierRows: [],
        organizations: [],
      }) as never,
    );
    vi.mocked(fetchStaffToken).mockResolvedValue(
      encodeFakeToken({ actor_type: "staff", staff_id: "s1", platform_owner: true, org_roles: [], module_access: [] }),
    );

    const user = userEvent.setup();
    const { container } = render(
      <AppShell>
        <p>page content</p>
      </AppShell>,
    );

    await waitFor(() => expect(screen.getByText("Admin Staff")).toBeInTheDocument());

    const aside = container.querySelector("aside.app-sidebar");
    expect(aside).not.toBeNull();
    expect(aside).not.toHaveClass("collapsed");

    // 1. Collapse via sidebar-toggle-btn
    const toggleBtn = screen.getByRole("button", { name: "Toggle Sidebar" });
    await user.click(toggleBtn);
    expect(aside).toHaveClass("collapsed");

    // 2. Expand via collapsed logo button
    const logoBtn = screen.getByRole("button", { name: "Expand Sidebar" });
    await user.click(logoBtn);
    expect(aside).not.toHaveClass("collapsed");

    // Re-collapse
    await user.click(screen.getByRole("button", { name: "Toggle Sidebar" }));
    expect(aside).toHaveClass("collapsed");

    // 3. Expand via clicking empty space on the collapsed aside
    await user.click(aside!);
    expect(aside).not.toHaveClass("collapsed");
  });

  it("shows a loading indicator until claims load, then hides it on the success path", async () => {
    vi.mocked(getBrowserSupabaseClient).mockReturnValue(
      mockSupabase({
        staffRow: { full_name: "Owner Person", platform_owner: true },
        orgTierRows: [],
        organizations: [],
      }) as never,
    );
    vi.mocked(fetchStaffToken).mockResolvedValue(
      encodeFakeToken({ actor_type: "staff", staff_id: "s1", platform_owner: true, org_roles: [], module_access: [] }),
    );

    render(
      <AppShell>
        <p>page content</p>
      </AppShell>,
    );

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    // The sidebar keeps its shape while the shell resolves — the governance
    // group heading stays put instead of vanishing until claims arrive.
    expect(screen.getByText("Team & Governance")).toBeInTheDocument();

    await waitFor(() => expect(screen.getByText("Owner Person")).toBeInTheDocument());
    expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  });

  it("shows a visible error state (not a blank no-access shell) when loading claims fails, and can retry", async () => {
    const supabaseClient = mockSupabase({
      staffRow: { full_name: "Recovered Person", platform_owner: true },
      orgTierRows: [],
      organizations: [],
    });
    vi.mocked(getBrowserSupabaseClient).mockReturnValue(supabaseClient as never);
    vi.mocked(fetchStaffToken)
      .mockRejectedValueOnce(new Error("network_error"))
      .mockResolvedValueOnce(
        encodeFakeToken({ actor_type: "staff", staff_id: "s5", platform_owner: true, org_roles: [], module_access: [] }),
      );

    const user = userEvent.setup();
    render(
      <AppShell>
        <p>page content</p>
      </AppShell>,
    );

    await waitFor(() => expect(screen.getByText(/could not load your account/i)).toBeInTheDocument());
    expect(screen.queryByText("Recovered Person")).not.toBeInTheDocument();
    // Page content still renders underneath the error banner — the shell doesn't blank the page.
    expect(screen.getByText("page content")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(screen.getByText("Recovered Person")).toBeInTheDocument());
    expect(screen.queryByText(/could not load your account/i)).not.toBeInTheDocument();
  });

  it("refreshes staff claims periodically so a long-lived session's token doesn't go stale", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      vi.mocked(getBrowserSupabaseClient).mockReturnValue(
        mockSupabase({
          staffRow: { full_name: "Owner Person", platform_owner: false },
          orgTierRows: [],
          organizations: [],
        }) as never,
      );
      vi.mocked(fetchStaffToken)
        .mockResolvedValueOnce(
          encodeFakeToken({ actor_type: "staff", staff_id: "s1", platform_owner: false, org_roles: [], module_access: [] }),
        )
        .mockResolvedValueOnce(
          encodeFakeToken({ actor_type: "staff", staff_id: "s1", platform_owner: true, org_roles: [], module_access: [] }),
        );

      render(
        <AppShell>
          <p>page content</p>
        </AppShell>,
      );

      await waitFor(() => expect(screen.getByText("Owner Person")).toBeInTheDocument());
      expect(fetchStaffToken).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole("link", { name: "Organizations" })).not.toBeInTheDocument();

      // Advance past the refresh interval — a second fetchStaffToken call should
      // land updated claims (platform_owner flips true) without any user action.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(45 * 60 * 1000);
      });

      await waitFor(() => expect(fetchStaffToken).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(screen.getByRole("link", { name: "Organizations" })).toBeInTheDocument());
    } finally {
      vi.useRealTimers();
    }
  });
});

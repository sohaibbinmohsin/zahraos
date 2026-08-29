import { render, screen, waitFor, act } from "@testing-library/react";
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
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush, refresh: routerRefresh }),
}));

function encodeFakeToken(payload: Record<string, unknown>) {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.sig`;
}

function mockSupabase(options: {
  initialSession?: { access_token: string } | null;
  staffRow: { full_name: string; platform_owner: boolean };
  orgTierRows: Array<{ organization_id: string; org_tier: string }>;
  organizations: Array<{ id: string; name: string }>;
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

    expect(screen.getByText("page content")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Owner Person")).toBeInTheDocument());
    expect(screen.getByRole("link", { name: "Organizations" })).toBeInTheDocument();
  });

  it("shows Staff and Roles links only when the staff is admin/super_admin for the selected org", async () => {
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

    await waitFor(() => expect(screen.getByRole("link", { name: "Staff" })).toBeInTheDocument());
    expect(screen.getByRole("link", { name: "Roles" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Organizations" })).not.toBeInTheDocument();
  });

  it("shows neither Staff/Roles nor Organizations for a regular staff member with no org_tier", async () => {
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
        module_access: [{ organization_id: "org-1", module: "vms", permissions: ["applications:read"] }],
      }),
    );

    render(
      <AppShell>
        <p>page content</p>
      </AppShell>,
    );

    await waitFor(() => expect(screen.getByText("Regular Staff")).toBeInTheDocument());
    expect(screen.queryByRole("link", { name: "Staff" })).not.toBeInTheDocument();
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
    expect(screen.queryByRole("link", { name: "Staff" })).not.toBeInTheDocument();

    // Simulate the login completing after mount via Supabase's auth state change event.
    await act(async () => {
      supabaseClient.__emitAuthStateChange("SIGNED_IN", { access_token: "fresh-token" });
    });

    await waitFor(() => expect(screen.getByText("Late Login Person")).toBeInTheDocument());
    expect(screen.getByRole("link", { name: "Staff" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Roles" })).toBeInTheDocument();
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

    await user.click(screen.getByRole("button", { name: "Sign out" }));

    expect(supabaseClient.auth.signOut).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByText("Owner Person")).not.toBeInTheDocument());
    expect(screen.queryByRole("link", { name: "Organizations" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sign out" })).not.toBeInTheDocument();
    expect(routerPush).toHaveBeenCalledWith("/login");
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
});

import { render, screen, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AppShell } from "./AppShell";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { fetchStaffToken } from "@/lib/staffToken";

vi.mock("@/lib/supabase/browserClient");
vi.mock("@/lib/staffToken", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/staffToken")>();
  return { ...actual, fetchStaffToken: vi.fn() };
});

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
});

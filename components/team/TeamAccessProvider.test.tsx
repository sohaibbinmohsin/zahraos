import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const chaptersMock = vi.fn();
vi.mock("@/lib/platformFunctions", () => ({ listChapters: (...a: unknown[]) => chaptersMock(...a) }));
vi.mock("@/lib/staffToken", () => ({ fetchStaffToken: vi.fn().mockResolvedValue("staff-token") }));
vi.mock("@/components/shell/AppShell", () => ({
  useSelectedOrg: () => "org-1",
  useShellAccessToken: () => "access-token",
}));

const from = vi.fn();
vi.mock("@/lib/supabase/browserClient", () => ({
  getBrowserSupabaseClient: () => ({
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: "access-token" } } }) },
    from,
  }),
}));

import { TeamAccessProvider, useTeamAccess } from "./TeamAccessProvider";

function Probe() {
  const { members, roles, chapters, loading } = useTeamAccess();
  if (loading) return <div>loading</div>;
  return (
    <div>
      <span data-testid="members">{members.map((m) => `${m.fullName}:${m.assignments.length}`).join("|")}</span>
      <span data-testid="roles">{roles.map((r) => `${r.name}:${r.isSystem}`).join("|")}</span>
      <span data-testid="chapters">{chapters.map((c) => c.name).join("|")}</span>
    </div>
  );
}

function tableStub(rows: Record<string, unknown>[]) {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "eq", "in", "order", "not"]) chain[m] = () => chain;
  chain.single = () => {
    chain.__single = true;
    return chain;
  };
  chain.then = (res: (v: { data: unknown }) => unknown) =>
    res({ data: chain.__single ? rows[0] ?? null : rows });
  return chain;
}

describe("TeamAccessProvider", () => {
  beforeEach(() => {
    chaptersMock.mockResolvedValue({ chapters: [{ id: "c1", name: "Lahore Chapter", city: "Lahore", status: "active" }] });
    from.mockImplementation((table: string) => {
      if (table === "modules") return tableStub([{ id: "mod-1", key: "youth-republic" }]);
      if (table === "roles") return tableStub([
        { id: "r1", name: "Operations Lead", description: "d", is_system: true, role_permissions: [{ permissions: { resource: "opportunities", action: "write" } }] },
        { id: "r2", name: "Logistics", description: "d2", is_system: false, role_permissions: [] },
      ]);
      if (table === "staff_role_assignments") return tableStub([
        { id: "a1", staff_id: "s1", role_id: "r1", scope_kind: "org_wide", chapter_id: null, scope_label: "National / All Chapters" },
      ]);
      if (table === "staff") return tableStub([
        { id: "s1", full_name: "Amina Malik", email: "amina@x.org", status: "active", deactivated_at: null },
      ]);
      if (table === "staff_invitations") return tableStub([]);
      return tableStub([]);
    });
  });

  it("joins staff, assignments, roles, and chapters into typed collections", async () => {
    render(<TeamAccessProvider><Probe /></TeamAccessProvider>);
    await waitFor(() => expect(screen.queryByText("loading")).not.toBeInTheDocument());
    expect(screen.getByTestId("members")).toHaveTextContent("Amina Malik:1");
    expect(screen.getByTestId("roles")).toHaveTextContent("Operations Lead:true");
    expect(screen.getByTestId("chapters")).toHaveTextContent("Lahore Chapter");
    expect(chaptersMock).toHaveBeenCalledWith({ organizationId: "org-1" }, "access-token");
  });
});

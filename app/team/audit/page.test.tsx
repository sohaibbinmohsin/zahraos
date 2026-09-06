import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import TeamAuditPage from "./page";
import TeamLayout from "../layout";
import * as shell from "@/components/shell/AppShell";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";

vi.mock("next/navigation", () => ({
  usePathname: () => "/team/audit",
}));

vi.mock("@/lib/supabase/browserClient");
vi.mock("@/components/shell/AppShell", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/shell/AppShell")>();
  return {
    ...actual,
    useIsOrgAdminOrAbove: vi.fn(),
    useShellLoading: vi.fn().mockReturnValue(false),
    useSelectedOrg: vi.fn(),
    useShellAccessToken: vi.fn(),
  };
});

describe("TeamAuditPage and TeamLayout", () => {
  beforeEach(() => {
    vi.mocked(shell.useIsOrgAdminOrAbove).mockReturnValue(true);
    vi.mocked(shell.useSelectedOrg).mockReturnValue("org-1");
    vi.mocked(shell.useShellAccessToken).mockReturnValue("platform-token");
    vi.mocked(getBrowserSupabaseClient).mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: "a-1",
                    created_at: new Date().toISOString(),
                    actor_name: "Sohaib Mohsin",
                    action: "staff.role_assigned",
                    summary: "Assigned role Super Admin",
                    ip: "127.0.0.1",
                    scope_label: "National",
                  },
                ],
              }),
            }),
          }),
        }),
      }),
    } as never);
  });

  it("renders TeamAuditPage correctly", async () => {
    render(
      <TeamLayout>
        <TeamAuditPage />
      </TeamLayout>,
    );

    expect(screen.getByText("Security & Operational Audit Log")).toBeInTheDocument();
    expect(await screen.findByText("Assigned role Super Admin")).toBeInTheDocument();
  });
});

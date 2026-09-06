import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import TeamRolesPage from "./page";
import TeamLayout from "../layout";
import * as shell from "@/components/shell/AppShell";
import * as teamAccess from "@/components/team/TeamAccessProvider";

vi.mock("next/navigation", () => ({
  usePathname: () => "/team/roles",
}));

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

vi.mock("@/components/team/TeamAccessProvider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/team/TeamAccessProvider")>();
  return {
    ...actual,
    useTeamAccess: vi.fn(),
  };
});

describe("TeamRolesPage and TeamLayout", () => {
  beforeEach(() => {
    vi.mocked(shell.useIsOrgAdminOrAbove).mockReturnValue(true);
    vi.mocked(shell.useSelectedOrg).mockReturnValue("org-1");
    vi.mocked(shell.useShellAccessToken).mockReturnValue("platform-token");
    vi.mocked(teamAccess.useTeamAccess).mockReturnValue({
      organizationId: "org-1",
      accessToken: "platform-token",
      staffToken: "staff-token",
      moduleId: "mod-1",
      members: [],
      roles: [
        {
          id: "r-1",
          name: "Super Admin",
          description: "Full system administration",
          isSystem: true,
          permissionKeys: ["vms:read", "vms:write"],
        },
      ],
      chapters: [],
      loading: false,
      error: null,
      refresh: vi.fn(),
    });
  });

  it("renders TeamRolesPage correctly", () => {
    render(
      <TeamLayout>
        <TeamRolesPage />
      </TeamLayout>,
    );

    expect(screen.getByText("Roles & Permissions Matrix")).toBeInTheDocument();
    expect(screen.getByText("Total Configured Roles")).toBeInTheDocument();
  });
});

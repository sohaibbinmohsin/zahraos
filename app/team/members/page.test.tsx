import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import TeamMembersPage from "./page";
import TeamLayout from "../layout";
import * as shell from "@/components/shell/AppShell";
import * as teamAccess from "@/components/team/TeamAccessProvider";

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

describe("TeamMembersPage and TeamLayout", () => {
  beforeEach(() => {
    vi.mocked(shell.useIsOrgAdminOrAbove).mockReturnValue(true);
    vi.mocked(shell.useSelectedOrg).mockReturnValue("org-1");
    vi.mocked(shell.useShellAccessToken).mockReturnValue("platform-token");
    vi.mocked(teamAccess.useTeamAccess).mockReturnValue({
      organizationId: "org-1",
      accessToken: "platform-token",
      staffToken: "staff-token",
      moduleId: "mod-1",
      members: [
        {
          id: "m-1",
          fullName: "Sohaib Mohsin",
          email: "sohaib@example.com",
          status: "active",
          lastActiveLabel: "Just now",
          enforce2fa: true,
          assignments: [
            {
              id: "a-1",
              roleId: "r-1",
              roleName: "Super Admin",
              scopeKind: "org_wide",
              chapterId: null,
              scopeLabel: "All Chapters (National)",
            },
          ],
        },
      ],
      roles: [],
      chapters: [],
      loading: false,
      error: null,
      refresh: vi.fn(),
    });
  });

  it("renders TeamLayout and TeamMembersPage correctly", () => {
    render(
      <TeamLayout>
        <TeamMembersPage />
      </TeamLayout>,
    );

    expect(screen.getByText("Team Members Directory")).toBeInTheDocument();
    expect(screen.getByText("Active Team")).toBeInTheDocument();
    expect(screen.getByText("Sohaib Mohsin")).toBeInTheDocument();
  });
});

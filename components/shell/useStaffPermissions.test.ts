import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useStaffPermissions } from "./useStaffPermissions";
import * as appShell from "@/components/shell/AppShell";
import type { StaffTokenClaims } from "@/lib/staffToken";

vi.mock("@/components/shell/AppShell", () => ({
  useStaffClaims: vi.fn(),
  useSelectedOrg: vi.fn(),
  useOrgTier: vi.fn(),
  useIsOrgAdminOrAbove: vi.fn(),
}));

function mockClaims(overrides?: Partial<StaffTokenClaims>): StaffTokenClaims {
  return {
    actorType: "staff",
    staffId: "staff-1",
    platformOwner: false,
    orgRoles: [{ organizationId: "org-1" }],
    moduleAccess: [
      {
        organizationId: "org-1",
        module: "youth-republic",
        permissions: [],
        chapterScopes: {},
      },
    ],
    ...overrides,
  };
}

describe("useStaffPermissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(appShell.useSelectedOrg).mockReturnValue("org-1");
    vi.mocked(appShell.useOrgTier).mockReturnValue("member");
    vi.mocked(appShell.useIsOrgAdminOrAbove).mockReturnValue(false);
    vi.mocked(appShell.useStaffClaims).mockReturnValue(mockClaims());
  });

  it("handles null / unauthenticated claims gracefully", () => {
    vi.mocked(appShell.useStaffClaims).mockReturnValue(null);
    vi.mocked(appShell.useSelectedOrg).mockReturnValue(null);

    const { result } = renderHook(() => useStaffPermissions());

    expect(result.current.canViewDrives).toBe(false);
    expect(result.current.canCreateDrives).toBe(false);
    expect(result.current.canPublishDrives).toBe(false);
    expect(result.current.canViewApplications).toBe(false);
    expect(result.current.canTriageApplications).toBe(false);
    expect(result.current.canViewHours).toBe(false);
    expect(result.current.canApproveHours).toBe(false);
    expect(result.current.canViewVolunteers).toBe(false);
    expect(result.current.canAccessDashboard).toBe(false);
    expect(result.current.canManageTeam).toBe(false);
    expect(result.current.canManageOrgProfile).toBe(false);
    expect(result.current.canCreateChapters).toBe(false);
    expect(result.current.canEditChapter("lhr")).toBe(false);
    expect(result.current.canViewInquiries).toBe(false);
    expect(result.current.isChapterScoped).toBe(false);
    expect(result.current.scopedChapterIds).toBeNull();
    expect(result.current.hasChapterPermission("opportunities:write", "lhr")).toBe(false);
  });

  it("grants all capabilities to Super Admin / Platform Owner with null chapter scope", () => {
    vi.mocked(appShell.useIsOrgAdminOrAbove).mockReturnValue(true);
    vi.mocked(appShell.useStaffClaims).mockReturnValue(
      mockClaims({ platformOwner: true })
    );

    const { result } = renderHook(() => useStaffPermissions());

    expect(result.current.canViewDrives).toBe(true);
    expect(result.current.canCreateDrives).toBe(true);
    expect(result.current.canPublishDrives).toBe(true);
    expect(result.current.canViewApplications).toBe(true);
    expect(result.current.canTriageApplications).toBe(true);
    expect(result.current.canViewHours).toBe(true);
    expect(result.current.canApproveHours).toBe(true);
    expect(result.current.canViewVolunteers).toBe(true);
    expect(result.current.canAccessDashboard).toBe(true);
    expect(result.current.canManageTeam).toBe(true);
    expect(result.current.canManageOrgProfile).toBe(true);
    expect(result.current.canCreateChapters).toBe(true);
    expect(result.current.canEditChapter("any-chapter")).toBe(true);
    expect(result.current.canViewInquiries).toBe(true);
    expect(result.current.isChapterScoped).toBe(false);
    expect(result.current.scopedChapterIds).toBeNull();
    expect(result.current.hasChapterPermission("opportunities:write", "lhr")).toBe(true);
    expect(result.current.hasChapterPermission("anything", null)).toBe(true);
  });

  it("evaluates Operations Lead capabilities correctly", () => {
    vi.mocked(appShell.useStaffClaims).mockReturnValue(
      mockClaims({
        moduleAccess: [
          {
            organizationId: "org-1",
            module: "youth-republic",
            permissions: [
              "opportunities:write",
              "noticeboard:write",
              "applications:update",
              "applications:read",
              "hours:update",
              "hours:read",
            ],
          },
        ],
      })
    );

    const { result } = renderHook(() => useStaffPermissions());

    expect(result.current.canViewDrives).toBe(true);
    expect(result.current.canCreateDrives).toBe(true);
    expect(result.current.canPublishDrives).toBe(true);
    expect(result.current.canViewApplications).toBe(true);
    expect(result.current.canTriageApplications).toBe(true);
    expect(result.current.canViewHours).toBe(true);
    expect(result.current.canApproveHours).toBe(true);
    expect(result.current.canAccessDashboard).toBe(true);
    expect(result.current.canManageTeam).toBe(false);
    expect(result.current.canManageOrgProfile).toBe(false);
    expect(result.current.canCreateChapters).toBe(false);
    expect(result.current.canViewInquiries).toBe(false);
    expect(result.current.canViewVolunteers).toBe(false);
    expect(result.current.isChapterScoped).toBe(false);
    expect(result.current.scopedChapterIds).toBeNull();
  });

  it("evaluates Application Reviewer capabilities with unforced dashboard access", () => {
    vi.mocked(appShell.useStaffClaims).mockReturnValue(
      mockClaims({
        moduleAccess: [
          {
            organizationId: "org-1",
            module: "youth-republic",
            permissions: ["applications:update", "applications:read"],
          },
        ],
      })
    );

    const { result } = renderHook(() => useStaffPermissions());

    expect(result.current.canViewApplications).toBe(true);
    expect(result.current.canTriageApplications).toBe(true);
    // Unforced dashboard access: canViewApplications grants dashboard access!
    expect(result.current.canAccessDashboard).toBe(true);
    expect(result.current.canViewDrives).toBe(false);
    expect(result.current.canCreateDrives).toBe(false);
    expect(result.current.canPublishDrives).toBe(false);
    expect(result.current.canViewHours).toBe(false);
    expect(result.current.canApproveHours).toBe(false);
    expect(result.current.canViewVolunteers).toBe(false);
    expect(result.current.canManageTeam).toBe(false);
    expect(result.current.canManageOrgProfile).toBe(false);
    expect(result.current.canCreateChapters).toBe(false);
    expect(result.current.canViewInquiries).toBe(false);
  });

  it("evaluates Auditor capabilities with unforced dashboard access", () => {
    vi.mocked(appShell.useStaffClaims).mockReturnValue(
      mockClaims({
        moduleAccess: [
          {
            organizationId: "org-1",
            module: "youth-republic",
            permissions: ["applications:read", "hours:read"],
          },
        ],
      })
    );

    const { result } = renderHook(() => useStaffPermissions());

    expect(result.current.canViewApplications).toBe(true);
    expect(result.current.canViewHours).toBe(true);
    expect(result.current.canTriageApplications).toBe(false);
    expect(result.current.canApproveHours).toBe(false);
    // Unforced dashboard access: canViewHours / canViewApplications grants dashboard
    expect(result.current.canAccessDashboard).toBe(true);
    expect(result.current.canViewDrives).toBe(false);
    expect(result.current.canManageOrgProfile).toBe(false);
  });

  describe("Unforced Dashboard Access Gating", () => {
    it("grants dashboard access when canViewDrives is true", () => {
      vi.mocked(appShell.useStaffClaims).mockReturnValue(
        mockClaims({
          moduleAccess: [{ organizationId: "org-1", module: "youth-republic", permissions: ["opportunities:read"] }],
        })
      );
      const { result } = renderHook(() => useStaffPermissions());
      expect(result.current.canAccessDashboard).toBe(true);
    });

    it("grants dashboard access when canViewApplications is true", () => {
      vi.mocked(appShell.useStaffClaims).mockReturnValue(
        mockClaims({
          moduleAccess: [{ organizationId: "org-1", module: "youth-republic", permissions: ["applications:read"] }],
        })
      );
      const { result } = renderHook(() => useStaffPermissions());
      expect(result.current.canAccessDashboard).toBe(true);
    });

    it("grants dashboard access when canViewHours is true", () => {
      vi.mocked(appShell.useStaffClaims).mockReturnValue(
        mockClaims({
          moduleAccess: [{ organizationId: "org-1", module: "youth-republic", permissions: ["hours:read"] }],
        })
      );
      const { result } = renderHook(() => useStaffPermissions());
      expect(result.current.canAccessDashboard).toBe(true);
    });

    it("grants dashboard access when canViewVolunteers is true", () => {
      vi.mocked(appShell.useStaffClaims).mockReturnValue(
        mockClaims({
          moduleAccess: [{ organizationId: "org-1", module: "youth-republic", permissions: ["volunteers:read"] }],
        })
      );
      const { result } = renderHook(() => useStaffPermissions());
      expect(result.current.canAccessDashboard).toBe(true);
    });

    it("denies dashboard access when no view capabilities exist (e.g. only team:write)", () => {
      vi.mocked(appShell.useStaffClaims).mockReturnValue(
        mockClaims({
          moduleAccess: [{ organizationId: "org-1", module: "youth-republic", permissions: ["team:write"] }],
        })
      );
      const { result } = renderHook(() => useStaffPermissions());
      expect(result.current.canAccessDashboard).toBe(false);
    });
  });

  describe("Governance and Scoping Boundaries", () => {
    it("restricts canManageOrgProfile and canCreateChapters to org-wide admins", () => {
      // 1. Org-wide team manager: canManageOrgProfile = true, canCreateChapters = true
      vi.mocked(appShell.useStaffClaims).mockReturnValue(
        mockClaims({
          moduleAccess: [{ organizationId: "org-1", module: "youth-republic", permissions: ["team:write"] }],
        })
      );
      const { result: orgWideResult } = renderHook(() => useStaffPermissions());
      expect(orgWideResult.current.isChapterScoped).toBe(false);
      expect(orgWideResult.current.canManageOrgProfile).toBe(true);
      expect(orgWideResult.current.canCreateChapters).toBe(true);

      // 2. Chapter-scoped user with team:write: restricted to false!
      vi.mocked(appShell.useStaffClaims).mockReturnValue(
        mockClaims({
          moduleAccess: [
            {
              organizationId: "org-1",
              module: "youth-republic",
              permissions: ["team:write"],
              chapterScopes: { "team:write": ["lhr"] },
            },
          ],
        })
      );
      const { result: scopedResult } = renderHook(() => useStaffPermissions());
      expect(scopedResult.current.isChapterScoped).toBe(true);
      expect(scopedResult.current.canManageOrgProfile).toBe(false);
      expect(scopedResult.current.canCreateChapters).toBe(false);
    });

    it("verifies canEditChapter(id) evaluates chapters:write against chapter scope", () => {
      vi.mocked(appShell.useStaffClaims).mockReturnValue(
        mockClaims({
          moduleAccess: [
            {
              organizationId: "org-1",
              module: "youth-republic",
              permissions: ["chapters:write"],
              chapterScopes: { "chapters:write": ["lhr"] },
            },
          ],
        })
      );
      const { result } = renderHook(() => useStaffPermissions());
      expect(result.current.canEditChapter("lhr")).toBe(true);
      expect(result.current.canEditChapter("khi")).toBe(false);
      expect(result.current.canEditChapter("")).toBe(false);
    });

    it("verifies canViewInquiries is restricted to org-wide admins and staff with inquiries:read", () => {
      // 1. Org-wide with inquiries:read -> true
      vi.mocked(appShell.useStaffClaims).mockReturnValue(
        mockClaims({
          moduleAccess: [{ organizationId: "org-1", module: "youth-republic", permissions: ["inquiries:read"] }],
        })
      );
      const { result: orgWideResult } = renderHook(() => useStaffPermissions());
      expect(orgWideResult.current.canViewInquiries).toBe(true);

      // 2. Chapter-scoped staff even with inquiries:read -> false
      vi.mocked(appShell.useStaffClaims).mockReturnValue(
        mockClaims({
          moduleAccess: [
            {
              organizationId: "org-1",
              module: "youth-republic",
              permissions: ["inquiries:read"],
              chapterScopes: { "inquiries:read": ["lhr"] },
            },
          ],
        })
      );
      const { result: scopedResult } = renderHook(() => useStaffPermissions());
      expect(scopedResult.current.canViewInquiries).toBe(false);

      // 3. Org-wide staff without inquiries:read -> false
      vi.mocked(appShell.useStaffClaims).mockReturnValue(
        mockClaims({
          moduleAccess: [{ organizationId: "org-1", module: "youth-republic", permissions: ["hours:read"] }],
        })
      );
      const { result: noPermResult } = renderHook(() => useStaffPermissions());
      expect(noPermResult.current.canViewInquiries).toBe(false);
    });
  });
});

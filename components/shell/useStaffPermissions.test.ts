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
    expect(result.current.isChapterScoped).toBe(false);
    expect(result.current.scopedChapterIds).toBeNull();
    expect(result.current.hasChapterPermission("opportunities:write", "lhr")).toBe(true);
    expect(result.current.hasChapterPermission("anything", null)).toBe(true);
  });

  it("evaluates Operations Lead capabilities correctly", () => {
    // Operations Lead: drives, publish, applications, triage, hours, approve, dashboard = true; team, volunteers = false
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
    expect(result.current.canViewVolunteers).toBe(false);
    expect(result.current.isChapterScoped).toBe(false);
    expect(result.current.scopedChapterIds).toBeNull();
    expect(result.current.hasChapterPermission("opportunities:write", "any-chapter")).toBe(true);
    expect(result.current.hasChapterPermission("team:write", "any-chapter")).toBe(false);
  });

  it("evaluates Drive Coordinator capabilities correctly", () => {
    // Drive Coordinator: drives, applications, triage, hours, approve, dashboard = true; publish, team, volunteers = false
    vi.mocked(appShell.useStaffClaims).mockReturnValue(
      mockClaims({
        moduleAccess: [
          {
            organizationId: "org-1",
            module: "youth-republic",
            permissions: [
              "opportunities:write",
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
    expect(result.current.canPublishDrives).toBe(false);
    expect(result.current.canViewApplications).toBe(true);
    expect(result.current.canTriageApplications).toBe(true);
    expect(result.current.canViewHours).toBe(true);
    expect(result.current.canApproveHours).toBe(true);
    expect(result.current.canAccessDashboard).toBe(true);
    expect(result.current.canManageTeam).toBe(false);
    expect(result.current.canViewVolunteers).toBe(false);
    expect(result.current.isChapterScoped).toBe(false);
    expect(result.current.scopedChapterIds).toBeNull();
  });

  it("evaluates Application Reviewer capabilities correctly", () => {
    // Application Reviewer: applications, triage = true; dashboard, drives, hours, volunteers, team = false
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
    expect(result.current.canAccessDashboard).toBe(false);
    expect(result.current.canViewDrives).toBe(false);
    expect(result.current.canCreateDrives).toBe(false);
    expect(result.current.canPublishDrives).toBe(false);
    expect(result.current.canViewHours).toBe(false);
    expect(result.current.canApproveHours).toBe(false);
    expect(result.current.canViewVolunteers).toBe(false);
    expect(result.current.canManageTeam).toBe(false);
    expect(result.current.isChapterScoped).toBe(false);
    expect(result.current.scopedChapterIds).toBeNull();
  });

  it("evaluates Auditor capabilities correctly", () => {
    // Auditor: applications, hours = true; triage, approve, drives, dashboard, team = false
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
    expect(result.current.canViewDrives).toBe(false);
    expect(result.current.canCreateDrives).toBe(false);
    expect(result.current.canPublishDrives).toBe(false);
    expect(result.current.canAccessDashboard).toBe(false);
    expect(result.current.canViewVolunteers).toBe(false);
    expect(result.current.canManageTeam).toBe(false);
    expect(result.current.isChapterScoped).toBe(false);
    expect(result.current.scopedChapterIds).toBeNull();
  });

  it("handles Chapter-scoped users and checks target chapter bounds", () => {
    // Chapter-scoped user e.g. opportunities:write restricted to ["lhr"]
    vi.mocked(appShell.useStaffClaims).mockReturnValue(
      mockClaims({
        moduleAccess: [
          {
            organizationId: "org-1",
            module: "youth-republic",
            permissions: [
              "opportunities:write",
              "applications:update",
              "applications:read",
              "hours:update",
              "hours:read",
            ],
            chapterScopes: {
              "opportunities:write": ["lhr"],
            },
          },
        ],
      })
    );

    const { result } = renderHook(() => useStaffPermissions());

    expect(result.current.isChapterScoped).toBe(true);
    expect(result.current.scopedChapterIds).toEqual(["lhr"]);
    expect(result.current.canCreateDrives).toBe(true);
    expect(result.current.canAccessDashboard).toBe(true);

    // Chapter-scoped permission check
    expect(result.current.hasChapterPermission("opportunities:write", "lhr")).toBe(true);
    expect(result.current.hasChapterPermission("opportunities:write", "isb")).toBe(false);
    expect(result.current.hasChapterPermission("opportunities:write", null)).toBe(false);
    expect(result.current.hasChapterPermission("opportunities:write", undefined)).toBe(false);

    // Org-wide permission on un-scoped key
    expect(result.current.hasChapterPermission("applications:update", "isb")).toBe(true);
    expect(result.current.hasChapterPermission("applications:update", null)).toBe(true);

    // Permission not granted
    expect(result.current.hasChapterPermission("team:write", "lhr")).toBe(false);
  });

  it("grants canViewVolunteers when volunteers:read permission is present", () => {
    vi.mocked(appShell.useStaffClaims).mockReturnValue(
      mockClaims({
        moduleAccess: [
          {
            organizationId: "org-1",
            module: "youth-republic",
            permissions: ["volunteers:read"],
          },
        ],
      })
    );

    const { result } = renderHook(() => useStaffPermissions());
    expect(result.current.canViewVolunteers).toBe(true);
    expect(result.current.canViewDrives).toBe(false);
  });

  it("grants canManageTeam when team:write permission is present", () => {
    vi.mocked(appShell.useStaffClaims).mockReturnValue(
      mockClaims({
        moduleAccess: [
          {
            organizationId: "org-1",
            module: "youth-republic",
            permissions: ["team:write"],
          },
        ],
      })
    );

    const { result } = renderHook(() => useStaffPermissions());
    expect(result.current.canManageTeam).toBe(true);
  });
});

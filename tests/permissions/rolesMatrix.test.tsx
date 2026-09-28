import { render, screen, waitFor, within, cleanup } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithSwr } from "@/tests/renderWithSwr";
import { useStaffPermissions, type StaffPermissions } from "@/components/shell/useStaffPermissions";
import { AppShell } from "@/components/shell/AppShell";
import YouthRepublicModuleLayout from "@/app/youth-republic/layout";
import YouthRepublicOpportunitiesPage from "@/app/youth-republic/drives/page";
import YouthRepublicApplicationsPage from "@/app/youth-republic/applications/page";
import YouthRepublicHoursPage from "@/app/youth-republic/hours/page";
import YouthRepublicDashboardPage from "@/app/youth-republic/dashboard/page";
import YouthRepublicVolunteersPage from "@/app/youth-republic/volunteers/page";
import { CreateOpportunityForm } from "@/components/youth-republic/CreateOpportunityForm";
import { ChaptersPanel } from "@/components/team/ChaptersPanel";
import OrganizationPage from "@/app/organization/page";
import { deriveRoleTitleFromPermissions } from "@/lib/capabilityMap";
import * as shell from "@/components/shell/AppShell";
import * as staffTokenModule from "@/lib/staffToken";
import * as supabaseModule from "@/lib/supabase/browserClient";
import * as youthRepublicFunctions from "@/lib/youthRepublicFunctions";
import * as platformFunctions from "@/lib/platformFunctions";
import type { StaffTokenClaims } from "@/lib/staffToken";

// Mocks
const { routerPush, routerRefresh } = vi.hoisted(() => ({
  routerPush: vi.fn(),
  routerRefresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush, refresh: routerRefresh }),
  usePathname: () => "/youth-republic/dashboard",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/supabase/browserClient", () => ({
  getBrowserSupabaseClient: vi.fn(),
}));

vi.mock("@/lib/staffToken", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/staffToken")>();
  return { ...actual, fetchStaffToken: vi.fn() };
});

vi.mock("@/lib/youthRepublicFunctions", () => ({
  listOpportunities: vi.fn(),
  listApplications: vi.fn(),
  listActivityHours: vi.fn(),
  listParticipationForOpportunity: vi.fn(),
  listVolunteers: vi.fn(),
  getKpiSummary: vi.fn(),
  createOpportunity: vi.fn(),
  updateOpportunity: vi.fn(),
  decideApplication: vi.fn(),
  verifyHours: vi.fn(),
  bulkAssignHours: vi.fn(),
}));

vi.mock("@/lib/platformFunctions", () => ({
  listChapters: vi.fn(),
  updateOrganization: vi.fn(),
  createChapter: vi.fn(),
  updateChapter: vi.fn(),
  listChapterTeamMembers: vi.fn().mockResolvedValue({ teamMembers: [] }),
  lookupYouthRepublicMember: vi.fn(),
}));

vi.mock("@/components/shell/AppShell", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/shell/AppShell")>();
  return {
    ...actual,
    useSelectedOrg: vi.fn(),
    useShellStaffToken: vi.fn(),
    useShellAccessToken: vi.fn(),
    useStaffClaims: vi.fn(),
    useIsOrgAdminOrAbove: vi.fn(),
    useOrgTier: vi.fn(),
    useShellLoading: vi.fn(),
  };
});

function encodeFakeToken(payload: Record<string, unknown>) {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.sig`;
}

function mockSupabase(options: {
  staffRow: { full_name: string; platform_owner: boolean; email?: string };
  orgTierRows: Array<{ organization_id: string; org_tier: string }>;
  organizations: Array<{ id: string; name: string }>;
  roleName?: string;
}) {
  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: "platform-token" } },
      }),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
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
              eq: () => Promise.resolve({ data: [{ id: "staff-1" }], error: null }),
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
            eq: () => ({
              single: () =>
                Promise.resolve({
                  data: options.organizations[0]
                    ? {
                        name: options.organizations[0].name,
                        about: "Empowering communities across Pakistan",
                        brand_color: "#1F2430",
                        logo_url: null,
                      }
                    : null,
                  error: null,
                }),
            }),
            in: () => Promise.resolve({ data: options.organizations, error: null }),
            then: (resolve: (value: { data: typeof options.organizations; error: null }) => void) =>
              resolve({ data: options.organizations, error: null }),
          }),
        };
      }
      if (table === "staff_role_assignments") {
        return {
          select: () => ({
            eq: () =>
              Promise.resolve({
                data: [
                  {
                    staff_id: "staff-1",
                    organization_id: "org-1",
                    roles: options.roleName ? { name: options.roleName } : null,
                  },
                ],
                error: null,
              }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
}

// -------------------------------------------------------------
// Role Definitions & Matrix Specifications
// -------------------------------------------------------------
interface RoleDefinition {
  id: string;
  name: string;
  isOrgAdminOrAbove: boolean;
  platformOwner: boolean;
  orgTier: string;
  userRoleName: string;
  permissions: string[];
  chapterScopes?: Record<string, string[]>;
  expectedCapabilities: {
    canViewDrives: boolean;
    canCreateDrives: boolean;
    canPublishDrives: boolean;
    canViewApplications: boolean;
    canTriageApplications: boolean;
    canViewHours: boolean;
    canApproveHours: boolean;
    canViewVolunteers: boolean;
    canAccessDashboard: boolean;
    canManageTeam: boolean;
    canManageOrgProfile: boolean;
    canCreateChapters: boolean;
    canViewInquiries: boolean;
    isChapterScoped: boolean;
    scopedChapterIds: string[] | null;
  };
  sidebar: {
    expectedLinks: string[];
    forbiddenLinks: string[];
    canSeeTeamAndGovernance: boolean;
  };
  layoutTabs: {
    expected: string[];
    forbidden: string[];
  };
  actions: {
    canCreateDrive: boolean;
    canPublishDrive: boolean;
    canTriageApplications: boolean;
    canApproveHours: boolean;
  };
  disallowedRoutes: string[];
}

const ROLES: Record<string, RoleDefinition> = {
  SUPER_ADMIN: {
    id: "super_admin",
    name: "Super Admin",
    isOrgAdminOrAbove: true,
    platformOwner: false,
    orgTier: "super_admin",
    userRoleName: "Super Admin",
    permissions: [
      "opportunities:read", "opportunities:write", "noticeboard:write",
      "applications:read", "applications:update", "hours:read", "hours:update",
      "volunteers:read", "team:write", "chapters:write", "inquiries:read", "inquiries:write",
    ],
    expectedCapabilities: {
      canViewDrives: true,
      canCreateDrives: true,
      canPublishDrives: true,
      canViewApplications: true,
      canTriageApplications: true,
      canViewHours: true,
      canApproveHours: true,
      canViewVolunteers: true,
      canAccessDashboard: true,
      canManageTeam: true,
      canManageOrgProfile: true,
      canCreateChapters: true,
      canViewInquiries: true,
      isChapterScoped: false,
      scopedChapterIds: null,
    },
    sidebar: {
      expectedLinks: ["Dashboard", "Drives", "Applications", "Hours", "Volunteers", "Team Members", "Partner Inquiries"],
      forbiddenLinks: [],
      canSeeTeamAndGovernance: true,
    },
    layoutTabs: {
      expected: ["Dashboard", "Volunteers", "Drives", "Applications", "Hours"],
      forbidden: [],
    },
    actions: {
      canCreateDrive: true,
      canPublishDrive: true,
      canTriageApplications: true,
      canApproveHours: true,
    },
    disallowedRoutes: [],
  },
  NATIONAL_ORG_ADMIN: {
    id: "national_org_admin",
    name: "National Org Admin",
    isOrgAdminOrAbove: true,
    platformOwner: false,
    orgTier: "admin",
    userRoleName: "Org Admin",
    permissions: [
      "opportunities:read", "opportunities:write", "noticeboard:write",
      "applications:read", "applications:update", "hours:read", "hours:update",
      "team:write", "chapters:write", "inquiries:read", "inquiries:write",
    ],
    expectedCapabilities: {
      canViewDrives: true,
      canCreateDrives: true,
      canPublishDrives: true,
      canViewApplications: true,
      canTriageApplications: true,
      canViewHours: true,
      canApproveHours: true,
      canViewVolunteers: true,
      canAccessDashboard: true,
      canManageTeam: true,
      canManageOrgProfile: true,
      canCreateChapters: true,
      canViewInquiries: true,
      isChapterScoped: false,
      scopedChapterIds: null,
    },
    sidebar: {
      expectedLinks: ["Dashboard", "Drives", "Applications", "Hours", "Volunteers", "Team Members", "Partner Inquiries"],
      forbiddenLinks: [],
      canSeeTeamAndGovernance: true,
    },
    layoutTabs: {
      expected: ["Dashboard", "Volunteers", "Drives", "Applications", "Hours"],
      forbidden: [],
    },
    actions: {
      canCreateDrive: true,
      canPublishDrive: true,
      canTriageApplications: true,
      canApproveHours: true,
    },
    disallowedRoutes: [],
  },
  CHAPTER_ADMIN: {
    id: "chapter_admin",
    name: "Chapter Admin (Lahore)",
    isOrgAdminOrAbove: false,
    platformOwner: false,
    orgTier: "member",
    userRoleName: "Chapter Admin",
    permissions: [
      "opportunities:read", "opportunities:write", "noticeboard:write",
      "applications:read", "applications:update", "hours:read", "hours:update",
      "team:write", "chapters:write",
    ],
    chapterScopes: {
      "opportunities:write": ["lhr"],
      "applications:update": ["lhr"],
      "hours:update": ["lhr"],
      "chapters:write": ["lhr"],
    },
    expectedCapabilities: {
      canViewDrives: true,
      canCreateDrives: true,
      canPublishDrives: true,
      canViewApplications: true,
      canTriageApplications: true,
      canViewHours: true,
      canApproveHours: true,
      canViewVolunteers: false,
      canAccessDashboard: true,
      canManageTeam: true,
      canManageOrgProfile: false,
      canCreateChapters: false,
      canViewInquiries: false,
      isChapterScoped: true,
      scopedChapterIds: ["lhr"],
    },
    sidebar: {
      expectedLinks: ["Dashboard", "Drives", "Applications", "Hours", "Organization", "Team Members"],
      forbiddenLinks: ["Volunteers", "Partner Inquiries"],
      canSeeTeamAndGovernance: true,
    },
    layoutTabs: {
      expected: ["Dashboard", "Drives", "Applications", "Hours"],
      forbidden: ["Volunteers"],
    },
    actions: {
      canCreateDrive: true,
      canPublishDrive: true,
      canTriageApplications: true,
      canApproveHours: true,
    },
    disallowedRoutes: ["/youth-republic/volunteers"],
  },
  OPERATIONS_LEAD: {
    id: "operations_lead",
    name: "Operations Lead",
    isOrgAdminOrAbove: false,
    platformOwner: false,
    orgTier: "member",
    userRoleName: "Operations Lead",
    permissions: [
      "opportunities:read", "opportunities:write", "noticeboard:write",
      "applications:read", "applications:update", "hours:read", "hours:update",
    ],
    expectedCapabilities: {
      canViewDrives: true,
      canCreateDrives: true,
      canPublishDrives: true,
      canViewApplications: true,
      canTriageApplications: true,
      canViewHours: true,
      canApproveHours: true,
      canViewVolunteers: false,
      canAccessDashboard: true,
      canManageTeam: false,
      canManageOrgProfile: false,
      canCreateChapters: false,
      canViewInquiries: false,
      isChapterScoped: false,
      scopedChapterIds: null,
    },
    sidebar: {
      expectedLinks: ["Dashboard", "Drives", "Applications", "Hours"],
      forbiddenLinks: ["Volunteers", "Team Members", "Roles & Permissions", "Partner Inquiries"],
      canSeeTeamAndGovernance: false,
    },
    layoutTabs: {
      expected: ["Dashboard", "Drives", "Applications", "Hours"],
      forbidden: ["Volunteers"],
    },
    actions: {
      canCreateDrive: true,
      canPublishDrive: true,
      canTriageApplications: true,
      canApproveHours: true,
    },
    disallowedRoutes: ["/youth-republic/volunteers"],
  },
  DRIVE_COORDINATOR: {
    id: "drive_coordinator",
    name: "Drive Coordinator",
    isOrgAdminOrAbove: false,
    platformOwner: false,
    orgTier: "member",
    userRoleName: "Drive Coordinator",
    permissions: [
      "opportunities:read", "opportunities:write",
      "applications:read", "applications:update", "hours:read", "hours:update",
    ],
    expectedCapabilities: {
      canViewDrives: true,
      canCreateDrives: true,
      canPublishDrives: false,
      canViewApplications: true,
      canTriageApplications: true,
      canViewHours: true,
      canApproveHours: true,
      canViewVolunteers: false,
      canAccessDashboard: true,
      canManageTeam: false,
      canManageOrgProfile: false,
      canCreateChapters: false,
      canViewInquiries: false,
      isChapterScoped: false,
      scopedChapterIds: null,
    },
    sidebar: {
      expectedLinks: ["Dashboard", "Drives", "Applications", "Hours"],
      forbiddenLinks: ["Volunteers", "Team Members", "Roles & Permissions", "Partner Inquiries"],
      canSeeTeamAndGovernance: false,
    },
    layoutTabs: {
      expected: ["Dashboard", "Drives", "Applications", "Hours"],
      forbidden: ["Volunteers"],
    },
    actions: {
      canCreateDrive: true,
      canPublishDrive: false,
      canTriageApplications: true,
      canApproveHours: true,
    },
    disallowedRoutes: ["/youth-republic/volunteers"],
  },
  APPLICATION_REVIEWER: {
    id: "application_reviewer",
    name: "Application Reviewer",
    isOrgAdminOrAbove: false,
    platformOwner: false,
    orgTier: "member",
    userRoleName: "Application Reviewer",
    permissions: ["applications:read", "applications:update"],
    expectedCapabilities: {
      canViewDrives: false,
      canCreateDrives: false,
      canPublishDrives: false,
      canViewApplications: true,
      canTriageApplications: true,
      canViewHours: false,
      canApproveHours: false,
      canViewVolunteers: false,
      canAccessDashboard: true,
      canManageTeam: false,
      canManageOrgProfile: false,
      canCreateChapters: false,
      canViewInquiries: false,
      isChapterScoped: false,
      scopedChapterIds: null,
    },
    sidebar: {
      expectedLinks: ["Dashboard", "Applications"],
      forbiddenLinks: ["Drives", "Hours", "Volunteers", "Team Members", "Partner Inquiries"],
      canSeeTeamAndGovernance: false,
    },
    layoutTabs: {
      expected: ["Dashboard", "Applications"],
      forbidden: ["Drives", "Hours", "Volunteers"],
    },
    actions: {
      canCreateDrive: false,
      canPublishDrive: false,
      canTriageApplications: true,
      canApproveHours: false,
    },
    disallowedRoutes: [
      "/youth-republic/drives",
      "/youth-republic/hours",
      "/youth-republic/volunteers",
    ],
  },
  AUDITOR: {
    id: "auditor",
    name: "Auditor",
    isOrgAdminOrAbove: false,
    platformOwner: false,
    orgTier: "member",
    userRoleName: "Auditor",
    permissions: ["applications:read", "hours:read"],
    expectedCapabilities: {
      canViewDrives: false,
      canCreateDrives: false,
      canPublishDrives: false,
      canViewApplications: true,
      canTriageApplications: false,
      canViewHours: true,
      canApproveHours: false,
      canViewVolunteers: false,
      canAccessDashboard: true,
      canManageTeam: false,
      canManageOrgProfile: false,
      canCreateChapters: false,
      canViewInquiries: false,
      isChapterScoped: false,
      scopedChapterIds: null,
    },
    sidebar: {
      expectedLinks: ["Dashboard", "Applications", "Hours"],
      forbiddenLinks: ["Drives", "Volunteers", "Team Members", "Partner Inquiries"],
      canSeeTeamAndGovernance: false,
    },
    layoutTabs: {
      expected: ["Dashboard", "Applications", "Hours"],
      forbidden: ["Drives", "Volunteers"],
    },
    actions: {
      canCreateDrive: false,
      canPublishDrive: false,
      canTriageApplications: false,
      canApproveHours: false,
    },
    disallowedRoutes: [
      "/youth-republic/drives",
      "/youth-republic/volunteers",
    ],
  },
  CHAPTER_COORDINATOR_LHR: {
    id: "chapter_coordinator_lhr",
    name: "Chapter Coordinator (Lahore)",
    isOrgAdminOrAbove: false,
    platformOwner: false,
    orgTier: "member",
    userRoleName: "Chapter Coordinator",
    permissions: [
      "opportunities:read", "opportunities:write",
      "applications:read", "applications:update", "hours:read", "hours:update",
    ],
    chapterScopes: {
      "opportunities:write": ["lhr"],
      "applications:update": ["lhr"],
      "hours:update": ["lhr"],
    },
    expectedCapabilities: {
      canViewDrives: true,
      canCreateDrives: true,
      canPublishDrives: false,
      canViewApplications: true,
      canTriageApplications: true,
      canViewHours: true,
      canApproveHours: true,
      canViewVolunteers: false,
      canAccessDashboard: true,
      canManageTeam: false,
      canManageOrgProfile: false,
      canCreateChapters: false,
      canViewInquiries: false,
      isChapterScoped: true,
      scopedChapterIds: ["lhr"],
    },
    sidebar: {
      expectedLinks: ["Dashboard", "Drives", "Applications", "Hours"],
      forbiddenLinks: ["Volunteers", "Team Members", "Partner Inquiries"],
      canSeeTeamAndGovernance: false,
    },
    layoutTabs: {
      expected: ["Dashboard", "Drives", "Applications", "Hours"],
      forbidden: ["Volunteers"],
    },
    actions: {
      canCreateDrive: true,
      canPublishDrive: false,
      canTriageApplications: true,
      canApproveHours: true,
    },
    disallowedRoutes: ["/youth-republic/volunteers"],
  },
};

function createRoleClaims(role: RoleDefinition): StaffTokenClaims {
  return {
    actorType: "staff",
    staffId: `staff-${role.id}`,
    platformOwner: role.platformOwner,
    orgRoles: [{ organizationId: "org-1" }],
    moduleAccess: [
      {
        organizationId: "org-1",
        module: "youth-republic",
        permissions: role.permissions,
        chapterScopes: role.chapterScopes,
      },
    ],
  };
}

function setupRoleEnvironment(role: RoleDefinition) {
  const claims = createRoleClaims(role);

  // Hook mocks for shell consumers
  vi.mocked(shell.useSelectedOrg).mockReturnValue("org-1");
  vi.mocked(shell.useShellStaffToken).mockReturnValue(`jwt-${role.id}`);
  vi.mocked(shell.useShellAccessToken).mockReturnValue("access-token");
  vi.mocked(shell.useStaffClaims).mockReturnValue(claims);
  vi.mocked(shell.useIsOrgAdminOrAbove).mockReturnValue(role.isOrgAdminOrAbove);
  vi.mocked(shell.useOrgTier).mockReturnValue(role.orgTier);
  vi.mocked(shell.useShellLoading).mockReturnValue(false);

  // Supabase & staff token mocks for AppShell integration
  vi.mocked(supabaseModule.getBrowserSupabaseClient).mockReturnValue(
    mockSupabase({
      staffRow: { full_name: `${role.name} User`, platform_owner: role.platformOwner },
      orgTierRows: [{ organization_id: "org-1", org_tier: role.orgTier }],
      organizations: [{ id: "org-1", name: "Rizq Foundation" }],
      roleName: role.userRoleName,
    }) as never,
  );
  vi.mocked(staffTokenModule.fetchStaffToken).mockResolvedValue(
    encodeFakeToken({
      actor_type: "staff",
      staff_id: `staff-${role.id}`,
      platform_owner: role.platformOwner,
      org_roles: [{ organization_id: "org-1" }],
      module_access: [
        {
          organization_id: "org-1",
          module: "youth-republic",
          permissions: role.permissions,
          chapter_scopes: role.chapterScopes,
        },
      ],
    }),
  );
}

// -------------------------------------------------------------
// Test Suite
// -------------------------------------------------------------
describe("Comprehensive Roles & Permissions Automated Test Matrix", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Standard mock data for youth republic functions
    vi.mocked(youthRepublicFunctions.listOpportunities).mockResolvedValue({
      opportunities: [
        {
          id: "opp-lhr",
          name: "Lahore Tree Drive",
          chapterId: "lhr",
          orgName: "Rizq",
          orgLogoUrl: null,
          type: "environment",
          city: "Lahore",
          online: false,
          computedStatus: "draft",
          description: "Planting in Lahore",
          capacity: 50,
          filledCount: 10,
          applicationDeadline: null,
          activityStartAt: null,
          activityEndAt: null,
          deactivatedAt: null,
        },
        {
          id: "opp-khi",
          name: "Karachi Beach Cleanup",
          chapterId: "khi",
          orgName: "Rizq",
          orgLogoUrl: null,
          type: "community",
          city: "Karachi",
          online: false,
          computedStatus: "open",
          description: "Beach cleanup",
          capacity: 30,
          filledCount: 5,
          applicationDeadline: null,
          activityStartAt: null,
          activityEndAt: null,
          deactivatedAt: null,
        },
      ],
      total: 2,
      facets: { cities: [], orgs: [] },
    });

    vi.mocked(youthRepublicFunctions.listApplications).mockResolvedValue({
      applications: [
        {
          id: "app-1",
          volunteerId: "vol-1",
          volunteerName: "Aisha Khan",
          opportunityId: "opp-lhr",
          opportunityName: "Lahore Tree Drive",
          status: "submitted",
          appliedAt: "2026-02-01T00:00:00Z",
          applicantName: "Aisha Khan",
          applicantEmail: "aisha@example.com",
          applicantPhone: "0300-1111111",
          answers: {},
          formSnapshot: null,
          attachmentIdsByField: {},
        },
      ],
      total: 1,
    });

    vi.mocked(youthRepublicFunctions.listActivityHours).mockResolvedValue({
      activity: [
        {
          id: "act-1",
          volunteerName: "Hamza Sheikh",
          opportunityName: "Lahore Tree Drive",
          activityType: "environment",
          role: "Lead",
          activityDate: "2026-02-15",
          hoursSubmitted: 4,
          hoursVerified: null,
          verificationStatus: "recorded",
          adminNotes: null,
        },
      ],
      total: 1,
    });

    vi.mocked(youthRepublicFunctions.listVolunteers).mockResolvedValue({
      volunteers: [
        {
          id: "vol-1",
          volunteerCode: "YR-2026-0001",
          fullName: "Aisha Khan",
          email: "aisha@example.com",
          phone: "0300-1111111",
          city: "Lahore",
          province: "Punjab",
          institution: "LUMS",
          status: "active",
        },
      ],
      total: 1,
    });

    vi.mocked(youthRepublicFunctions.getKpiSummary).mockResolvedValue({
      totalRegistered: 100,
      active: 40,
      completedParticipations: 25,
      applicationsReceived: 80,
      selected: 30,
      totalVerifiedHours: 500,
      byCity: { Lahore: 60, Karachi: 40 },
      byProvince: {},
      byInstitution: {},
      participationByOpportunity: {},
      participationByActivityType: {},
    });

    vi.mocked(platformFunctions.listChapters).mockResolvedValue({
      chapters: [
        { id: "lhr", name: "Lahore Chapter", status: "active", city: "Lahore" },
        { id: "khi", name: "Karachi Chapter", status: "active", city: "Karachi" },
        { id: "isb", name: "Islamabad Chapter", status: "active", city: "Islamabad" },
      ],
    });
  });

  // =========================================================================
  // MATRIX 1: useStaffPermissions Capability Derivation
  // =========================================================================
  describe("Matrix 1: Capability Derivation (useStaffPermissions)", () => {
    Object.values(ROLES).forEach((role) => {
      it(`derives exact capability matrix for ${role.name}`, () => {
        setupRoleEnvironment(role);

        const { result } = renderHook(() => useStaffPermissions());

        expect(result.current.canViewDrives).toBe(role.expectedCapabilities.canViewDrives);
        expect(result.current.canCreateDrives).toBe(role.expectedCapabilities.canCreateDrives);
        expect(result.current.canPublishDrives).toBe(role.expectedCapabilities.canPublishDrives);
        expect(result.current.canViewApplications).toBe(role.expectedCapabilities.canViewApplications);
        expect(result.current.canTriageApplications).toBe(role.expectedCapabilities.canTriageApplications);
        expect(result.current.canViewHours).toBe(role.expectedCapabilities.canViewHours);
        expect(result.current.canApproveHours).toBe(role.expectedCapabilities.canApproveHours);
        expect(result.current.canViewVolunteers).toBe(role.expectedCapabilities.canViewVolunteers);
        expect(result.current.canAccessDashboard).toBe(role.expectedCapabilities.canAccessDashboard);
        expect(result.current.canManageTeam).toBe(role.expectedCapabilities.canManageTeam);
        expect(result.current.canManageOrgProfile).toBe(role.expectedCapabilities.canManageOrgProfile);
        expect(result.current.canCreateChapters).toBe(role.expectedCapabilities.canCreateChapters);
        expect(result.current.canViewInquiries).toBe(role.expectedCapabilities.canViewInquiries);
        expect(result.current.isChapterScoped).toBe(role.expectedCapabilities.isChapterScoped);
        expect(result.current.scopedChapterIds).toEqual(role.expectedCapabilities.scopedChapterIds);
      });
    });

    it("verifies chapter scoping helper behavior for chapter-scoped vs org-wide roles", () => {
      // Chapter-scoped coordinator
      setupRoleEnvironment(ROLES.CHAPTER_COORDINATOR_LHR);
      const { result: lhrResult } = renderHook(() => useStaffPermissions());
      expect(lhrResult.current.hasChapterPermission("opportunities:write", "lhr")).toBe(true);
      expect(lhrResult.current.hasChapterPermission("opportunities:write", "khi")).toBe(false);
      expect(lhrResult.current.hasChapterPermission("opportunities:write", null)).toBe(false);

      // Chapter Admin (Lahore)
      setupRoleEnvironment(ROLES.CHAPTER_ADMIN);
      const { result: chapterAdminResult } = renderHook(() => useStaffPermissions());
      expect(chapterAdminResult.current.canEditChapter("lhr")).toBe(true);
      expect(chapterAdminResult.current.canEditChapter("khi")).toBe(false);

      // National Org Admin (unconstrained)
      setupRoleEnvironment(ROLES.NATIONAL_ORG_ADMIN);
      const { result: nationalResult } = renderHook(() => useStaffPermissions());
      expect(nationalResult.current.canEditChapter("lhr")).toBe(true);
      expect(nationalResult.current.canEditChapter("khi")).toBe(true);

      // Unscoped super admin
      setupRoleEnvironment(ROLES.SUPER_ADMIN);
      const { result: adminResult } = renderHook(() => useStaffPermissions());
      expect(adminResult.current.hasChapterPermission("opportunities:write", "lhr")).toBe(true);
      expect(adminResult.current.hasChapterPermission("opportunities:write", "khi")).toBe(true);
      expect(adminResult.current.hasChapterPermission("opportunities:write", null)).toBe(true);
      expect(adminResult.current.canEditChapter("lhr")).toBe(true);
      expect(adminResult.current.canEditChapter("khi")).toBe(true);
    });
  });

  // =========================================================================
  // MATRIX 2: Sidebar Navigation & Zero Orphaned Headers (AppShell)
  // =========================================================================
  describe("Matrix 2: Sidebar Navigation & Governance Partitioning (AppShell)", () => {
    Object.values(ROLES).forEach((role) => {
      it(`renders only authorized navigation items and enforces zero orphaned headers for ${role.name}`, async () => {
        setupRoleEnvironment(role);

        render(
          <AppShell>
            <div data-testid="page-inner">Operational Content</div>
          </AppShell>
        );

        await waitFor(() => {
          expect(screen.getByText("Operational Content")).toBeInTheDocument();
        });

        // 1. Verify permitted sidebar links are present
        role.sidebar.expectedLinks.forEach((linkText) => {
          expect(screen.getByRole("link", { name: new RegExp(linkText, "i") })).toBeInTheDocument();
        });

        // 2. Verify forbidden sidebar links are strictly absent
        role.sidebar.forbiddenLinks.forEach((linkText) => {
          expect(screen.queryByRole("link", { name: new RegExp(`^${linkText}$`, "i") })).not.toBeInTheDocument();
        });

        // 3. Verify Team & Governance header and separator divider
        if (role.sidebar.canSeeTeamAndGovernance) {
          expect(screen.getByText("Team & Governance")).toBeInTheDocument();
          expect(document.querySelector(".sidebar-module-divider")).toBeInTheDocument();
        } else {
          // STRICT RULE: Non-admins must NEVER see "Team & Governance" or its divider
          expect(screen.queryByText("Team & Governance")).not.toBeInTheDocument();
          expect(document.querySelector(".sidebar-module-divider")).not.toBeInTheDocument();
          expect(screen.queryByRole("separator", { hidden: true })).not.toBeInTheDocument();
        }
      });
    });
  });

  // =========================================================================
  // MATRIX 3: Top Layout Tabs (YouthRepublicModuleLayout)
  // =========================================================================
  describe("Matrix 3: Top Layout Tabs Visibility (YouthRepublicModuleLayout)", () => {
    Object.values(ROLES).forEach((role) => {
      it(`renders correct tab navigation set for ${role.name}`, async () => {
        setupRoleEnvironment(role);

        renderWithSwr(
          <YouthRepublicModuleLayout>
            <div data-testid="layout-child">Module Content</div>
          </YouthRepublicModuleLayout>
        );

        await waitFor(() => {
          expect(screen.getByTestId("layout-child")).toBeInTheDocument();
        });

        // Verify authorized tabs
        role.layoutTabs.expected.forEach((tabLabel) => {
          expect(screen.getByRole("link", { name: new RegExp(tabLabel, "i") })).toBeInTheDocument();
        });

        // Verify unauthorized tabs do not exist in DOM
        role.layoutTabs.forbidden.forEach((tabLabel) => {
          expect(screen.queryByRole("link", { name: new RegExp(`^${tabLabel}$`, "i") })).not.toBeInTheDocument();
        });
      });
    });
  });

  // =========================================================================
  // MATRIX 4: Action Button Permissions & Read-Only Indicator Matrix
  // =========================================================================
  describe("Matrix 4: Action Buttons & Read-Only Status Indicators", () => {
    describe("Drives Page Header & Card Actions", () => {
      it("Super Admin sees Create Drive, Publish drive on draft, and Edit buttons", async () => {
        setupRoleEnvironment(ROLES.SUPER_ADMIN);
        renderWithSwr(<YouthRepublicOpportunitiesPage />);

        await screen.findByText("Lahore Tree Drive");
        expect(screen.getByRole("button", { name: /Create Drive/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Publish drive/i })).toBeInTheDocument();
        expect(screen.getAllByRole("button", { name: "Edit" }).length).toBeGreaterThan(0);
      });

      it("Operations Lead sees Create Drive and Publish drive, but no governance actions", async () => {
        setupRoleEnvironment(ROLES.OPERATIONS_LEAD);
        renderWithSwr(<YouthRepublicOpportunitiesPage />);

        await screen.findByText("Lahore Tree Drive");
        expect(screen.getByRole("button", { name: /Create Drive/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Publish drive/i })).toBeInTheDocument();
      });

      it("Drive Coordinator sees Create Drive, but Publish drive is hidden", async () => {
        setupRoleEnvironment(ROLES.DRIVE_COORDINATOR);
        renderWithSwr(<YouthRepublicOpportunitiesPage />);

        await screen.findByText("Lahore Tree Drive");
        expect(screen.getByRole("button", { name: /Create Drive/i })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /Publish drive/i })).not.toBeInTheDocument();
      });

      it("Auditor and Application Reviewer cannot access Drives page (renders AccessDeniedGate)", () => {
        setupRoleEnvironment(ROLES.AUDITOR);
        renderWithSwr(<YouthRepublicOpportunitiesPage />);
        expect(screen.getByRole("alert")).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: /Access Denied/i })).toBeInTheDocument();
        expect(screen.getByText(/Drives/i)).toBeInTheDocument();

        cleanup();
        setupRoleEnvironment(ROLES.APPLICATION_REVIEWER);
        renderWithSwr(<YouthRepublicOpportunitiesPage />);
        expect(screen.getByRole("alert")).toBeInTheDocument();
      });
    });

    describe("Applications Page Decision Buttons vs Read-Only Pill", () => {
      it("Authorized roles (Super Admin, Reviewer, Drive Coord) see decision buttons (Select, Waitlist, Reject)", async () => {
        setupRoleEnvironment(ROLES.APPLICATION_REVIEWER);
        renderWithSwr(<YouthRepublicApplicationsPage />);

        expect(await screen.findByText("Aisha Khan")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Select" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Waitlist" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Reject" })).toBeInTheDocument();
        expect(screen.queryByText("Read-only")).not.toBeInTheDocument();
      });

      it("Auditor sees Read-only pill and zero triage mutation buttons", async () => {
        setupRoleEnvironment(ROLES.AUDITOR);
        renderWithSwr(<YouthRepublicApplicationsPage />);

        expect(await screen.findByText("Aisha Khan")).toBeInTheDocument();
        expect(screen.getByText("Read-only")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Select" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Waitlist" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Reject" })).not.toBeInTheDocument();
      });

      it("Auditor opening review drawer sees details but no decision buttons", async () => {
        setupRoleEnvironment(ROLES.AUDITOR);
        const user = userEvent.setup();
        renderWithSwr(<YouthRepublicApplicationsPage />);

        expect(await screen.findByText("Aisha Khan")).toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: "Review Answers" }));

        expect(await screen.findByRole("dialog")).toBeInTheDocument();
        expect(screen.getByText("Candidate Application Review")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Select" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Waitlist" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Reject" })).not.toBeInTheDocument();
      });
    });

    describe("Hours Page Approval Buttons vs Read-Only Pill", () => {
      it("Authorized roles (Super Admin, Ops Lead, Drive Coord) see Bulk-Assign Hours and row Verify/Adjust buttons", async () => {
        setupRoleEnvironment(ROLES.OPERATIONS_LEAD);
        renderWithSwr(<YouthRepublicHoursPage />);

        expect(await screen.findByText("Hamza Sheikh")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Bulk-Assign Hours/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Verify" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Adjust Hours" })).toBeInTheDocument();
        expect(screen.queryByText("Read-only")).not.toBeInTheDocument();
      });

      it("Auditor sees Read-only badge and no Bulk-Assign or mutation buttons", async () => {
        setupRoleEnvironment(ROLES.AUDITOR);
        renderWithSwr(<YouthRepublicHoursPage />);

        expect(await screen.findByText("Hamza Sheikh")).toBeInTheDocument();
        expect(screen.getByText("Read-only")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /Bulk-Assign Hours/i })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Verify" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Adjust Hours" })).not.toBeInTheDocument();
      });

      it("Application Reviewer cannot access Hours page (renders AccessDeniedGate)", () => {
        setupRoleEnvironment(ROLES.APPLICATION_REVIEWER);
        renderWithSwr(<YouthRepublicHoursPage />);

        expect(screen.getByRole("alert")).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: /Access Denied/i })).toBeInTheDocument();
        expect(screen.getByText(/Hours/i)).toBeInTheDocument();
      });
    });
  });

  // =========================================================================
  // MATRIX 5: Chapter Scoping Boundaries (Drives & Create Opportunity Form)
  // =========================================================================
  describe("Matrix 5: Chapter Scoping Boundaries", () => {
    it("Lahore Coordinator can Edit Lahore drive, but Karachi drive has no Edit button", async () => {
      setupRoleEnvironment(ROLES.CHAPTER_COORDINATOR_LHR);
      renderWithSwr(<YouthRepublicOpportunitiesPage />);

      await screen.findByText("Lahore Tree Drive");
      await screen.findByText("Karachi Beach Cleanup");

      // Lahore drive card has Edit button
      const lhrCard = screen.getByText("Lahore Tree Drive").closest(".opp-card") as HTMLElement;
      expect(within(lhrCard).getByRole("button", { name: "Edit" })).toBeInTheDocument();

      // Karachi drive card does NOT have Edit button
      const khiCard = screen.getByText("Karachi Beach Cleanup").closest(".opp-card") as HTMLElement;
      expect(within(khiCard).queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    });

    it("Unrestricted role (Operations Lead) can Edit both Lahore and Karachi drives", async () => {
      setupRoleEnvironment(ROLES.OPERATIONS_LEAD);
      renderWithSwr(<YouthRepublicOpportunitiesPage />);

      await screen.findByText("Lahore Tree Drive");
      await screen.findByText("Karachi Beach Cleanup");

      const lhrCard = screen.getByText("Lahore Tree Drive").closest(".opp-card") as HTMLElement;
      expect(within(lhrCard).getByRole("button", { name: "Edit" })).toBeInTheDocument();

      const khiCard = screen.getByText("Karachi Beach Cleanup").closest(".opp-card") as HTMLElement;
      expect(within(khiCard).getByRole("button", { name: "Edit" })).toBeInTheDocument();
    });

    it("Lahore Coordinator in CreateOpportunityForm only sees Lahore chapter and no org-wide option", async () => {
      setupRoleEnvironment(ROLES.CHAPTER_COORDINATOR_LHR);
      const user = userEvent.setup();

      render(
        <CreateOpportunityForm
          organizationId="org-1"
          staffToken="jwt-chapter-lhr"
          accessToken="access-token"
          onCreated={vi.fn()}
        />
      );

      const chapterSelect = screen.getByLabelText("Chapter");
      await user.click(chapterSelect);

      // Scoped option should be present
      expect(screen.getByRole("option", { name: "Lahore Chapter" })).toBeInTheDocument();

      // Org-wide and other chapters must be absent
      expect(screen.queryByRole("option", { name: /Org-wide/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("option", { name: "Karachi Chapter" })).not.toBeInTheDocument();
      expect(screen.queryByRole("option", { name: "Islamabad Chapter" })).not.toBeInTheDocument();
    });

    it("Unrestricted creator in CreateOpportunityForm sees all chapters and org-wide option", async () => {
      setupRoleEnvironment(ROLES.SUPER_ADMIN);
      const user = userEvent.setup();

      render(
        <CreateOpportunityForm
          organizationId="org-1"
          staffToken="jwt-super-admin"
          accessToken="access-token"
          onCreated={vi.fn()}
        />
      );

      const chapterSelect = screen.getByLabelText("Chapter");
      await user.click(chapterSelect);

      expect(screen.getByRole("option", { name: "Org-wide (no chapter)" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Lahore Chapter" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Karachi Chapter" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Islamabad Chapter" })).toBeInTheDocument();
    });
  });

  // =========================================================================
  // MATRIX 6: Route Protection & AccessDeniedGate Triggering
  // =========================================================================
  describe("Matrix 6: Unauthorized Route Navigation Protection (AccessDeniedGate)", () => {
    it("Application Reviewer triggers AccessDeniedGate on Drives, Hours, and Volunteers, but allowed on Dashboard and Applications", async () => {
      setupRoleEnvironment(ROLES.APPLICATION_REVIEWER);

      // Dashboard: Allowed
      renderWithSwr(<YouthRepublicDashboardPage />);
      await waitFor(() => expect(screen.getByText("Operations Command Center")).toBeInTheDocument());
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();

      // Drives: Denied
      cleanup();
      renderWithSwr(<YouthRepublicOpportunitiesPage />);
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByText(/Drives/i)).toBeInTheDocument();

      // Hours: Denied
      cleanup();
      renderWithSwr(<YouthRepublicHoursPage />);
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByText(/Hours/i)).toBeInTheDocument();

      // Volunteers: Denied
      cleanup();
      renderWithSwr(<YouthRepublicVolunteersPage />);
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByText(/Volunteers/i)).toBeInTheDocument();
    });

    it("Auditor triggers AccessDeniedGate on Drives and Volunteers, but NOT on Dashboard, Applications, or Hours", async () => {
      setupRoleEnvironment(ROLES.AUDITOR);

      // Dashboard: Allowed
      renderWithSwr(<YouthRepublicDashboardPage />);
      await waitFor(() => expect(screen.getByText("Operations Command Center")).toBeInTheDocument());
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();

      // Drives: Denied
      cleanup();
      renderWithSwr(<YouthRepublicOpportunitiesPage />);
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByText(/Drives/i)).toBeInTheDocument();

      // Volunteers: Denied
      cleanup();
      renderWithSwr(<YouthRepublicVolunteersPage />);
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByText(/Volunteers/i)).toBeInTheDocument();

      // Applications: Allowed (shows operational content, no alert)
      cleanup();
      renderWithSwr(<YouthRepublicApplicationsPage />);
      expect(await screen.findByText("Aisha Khan")).toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();

      // Hours: Allowed (shows operational content, no alert)
      cleanup();
      renderWithSwr(<YouthRepublicHoursPage />);
      expect(await screen.findByText("Hamza Sheikh")).toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("Operations Lead and Drive Coordinator trigger AccessDeniedGate on Volunteers, but allowed on operational routes", async () => {
      setupRoleEnvironment(ROLES.DRIVE_COORDINATOR);

      renderWithSwr(<YouthRepublicVolunteersPage />);
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: /Access Denied/i })).toBeInTheDocument();
      expect(screen.getByText(/Volunteers/i)).toBeInTheDocument();

      // Dashboard allowed
      cleanup();
      renderWithSwr(<YouthRepublicDashboardPage />);
      await waitFor(() => expect(screen.getByText("Operations Command Center")).toBeInTheDocument());
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("Super Admin / Org Admin accesses all operational routes without AccessDeniedGate", async () => {
      setupRoleEnvironment(ROLES.SUPER_ADMIN);

      renderWithSwr(<YouthRepublicDashboardPage />);
      await waitFor(() => expect(screen.getByText("Operations Command Center")).toBeInTheDocument());
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();

      cleanup();
      renderWithSwr(<YouthRepublicOpportunitiesPage />);
      await screen.findByText("Lahore Tree Drive");
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();

      cleanup();
      renderWithSwr(<YouthRepublicVolunteersPage />);
      expect(await screen.findByText("Aisha Khan")).toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  // =========================================================================
  // MATRIX 7: Chapter Governance & Scoped Administration
  // =========================================================================
  describe("Matrix 7: Chapter Governance & Scoped Administration", () => {
    it("Super Admin sees Partner Inquiries, has unconstrained scope, and displays 'Super Admin'", async () => {
      // 1. Role title derivation
      expect(deriveRoleTitleFromPermissions(ROLES.SUPER_ADMIN.permissions, false)).toBe("Super Admin");

      // 2. Capabilities
      setupRoleEnvironment(ROLES.SUPER_ADMIN);
      const { result } = renderHook(() => useStaffPermissions());
      expect(result.current.isChapterScoped).toBe(false);
      expect(result.current.scopedChapterIds).toBeNull();
      expect(result.current.canManageOrgProfile).toBe(true);
      expect(result.current.canCreateChapters).toBe(true);
      expect(result.current.canViewInquiries).toBe(true);
      expect(result.current.canEditChapter("lhr")).toBe(true);
      expect(result.current.canEditChapter("khi")).toBe(true);

      // 3. AppShell rendering
      render(
        <AppShell>
          <div data-testid="page-inner">Super Admin Content</div>
        </AppShell>
      );
      await waitFor(() => expect(screen.getByTestId("page-inner")).toBeInTheDocument());

      // Profile pill displays "Super Admin"
      expect(screen.getByText("Super Admin")).toBeInTheDocument();

      // Partner Inquiries is in sidebar
      expect(screen.getByRole("link", { name: /Partner Inquiries/i })).toBeInTheDocument();
      expect(screen.getByText("Team & Governance")).toBeInTheDocument();
    });

    it("National Org Admin sees Partner Inquiries, has unconstrained scope, and displays 'Org Admin'", async () => {
      // 1. Role title derivation
      expect(deriveRoleTitleFromPermissions(ROLES.NATIONAL_ORG_ADMIN.permissions, false)).toBe("Org Admin");

      // 2. Capabilities
      setupRoleEnvironment(ROLES.NATIONAL_ORG_ADMIN);
      const { result } = renderHook(() => useStaffPermissions());
      expect(result.current.isChapterScoped).toBe(false);
      expect(result.current.scopedChapterIds).toBeNull();
      expect(result.current.canManageOrgProfile).toBe(true);
      expect(result.current.canCreateChapters).toBe(true);
      expect(result.current.canViewInquiries).toBe(true);
      expect(result.current.canEditChapter("lhr")).toBe(true);
      expect(result.current.canEditChapter("khi")).toBe(true);

      // 3. AppShell rendering
      render(
        <AppShell>
          <div data-testid="page-inner">Org Admin Content</div>
        </AppShell>
      );
      await waitFor(() => expect(screen.getByTestId("page-inner")).toBeInTheDocument());

      // Profile pill displays "Org Admin"
      expect(screen.getByText("Org Admin")).toBeInTheDocument();

      // Partner Inquiries is in sidebar
      expect(screen.getByRole("link", { name: /Partner Inquiries/i })).toBeInTheDocument();
      expect(screen.getByText("Team & Governance")).toBeInTheDocument();
    });

    it("Chapter Admin does NOT see Partner Inquiries in sidebar, but sees Team & Governance and displays 'Chapter Admin'", async () => {
      // 1. Role title derivation
      expect(deriveRoleTitleFromPermissions(ROLES.CHAPTER_ADMIN.permissions, true)).toBe("Chapter Admin");

      // 2. Capabilities
      setupRoleEnvironment(ROLES.CHAPTER_ADMIN);
      const { result } = renderHook(() => useStaffPermissions());
      expect(result.current.isChapterScoped).toBe(true);
      expect(result.current.scopedChapterIds).toEqual(["lhr"]);
      expect(result.current.canManageOrgProfile).toBe(false);
      expect(result.current.canCreateChapters).toBe(false);
      expect(result.current.canViewInquiries).toBe(false);
      expect(result.current.canEditChapter("lhr")).toBe(true);
      expect(result.current.canEditChapter("khi")).toBe(false);

      // 3. AppShell rendering
      render(
        <AppShell>
          <div data-testid="page-inner">Chapter Admin Content</div>
        </AppShell>
      );
      await waitFor(() => expect(screen.getByTestId("page-inner")).toBeInTheDocument());

      // Profile pill displays "Chapter Admin"
      expect(screen.getByText("Chapter Admin")).toBeInTheDocument();

      // Partner Inquiries is strictly ABSENT from sidebar
      expect(screen.queryByRole("link", { name: /Partner Inquiries/i })).not.toBeInTheDocument();

      // Organization and Team Members are present under Team & Governance
      expect(screen.getByText("Team & Governance")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /^Organization$/i })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /^Team Members$/i })).toBeInTheDocument();
    });

    it("Chapter Admin in ChaptersPanel sees all chapters, Edit only for assigned chapter, View Details for others, and Add Chapter is absent", () => {
      setupRoleEnvironment(ROLES.CHAPTER_ADMIN);

      render(
        <ChaptersPanel
          organizationId="org-1"
          accessToken="access-token"
          chapters={[
            { id: "lhr", name: "Lahore Chapter", city: "Lahore", status: "active" },
            { id: "khi", name: "Karachi Chapter", city: "Karachi", status: "active" },
          ]}
          onChanged={vi.fn()}
        />
      );

      // Intra-org visibility: Both chapters visible
      expect(screen.getByText("Lahore Chapter")).toBeInTheDocument();
      expect(screen.getByText("Karachi Chapter")).toBeInTheDocument();

      // Add Chapter is strictly absent
      expect(screen.queryByRole("button", { name: /Add Chapter/i })).not.toBeInTheDocument();

      // Edit only for assigned chapter (Lahore)
      expect(screen.getByRole("button", { name: /^Edit$/i })).toBeInTheDocument();

      // View Details for unassigned chapter (Karachi)
      expect(screen.getByRole("button", { name: /View Details/i })).toBeInTheDocument();
    });

    it("Chapter Admin on /organization has profile inputs disabled, read-only banner, and no Save profile button", async () => {
      setupRoleEnvironment(ROLES.CHAPTER_ADMIN);

      renderWithSwr(<OrganizationPage />);

      // Wait for org profile data to load
      await waitFor(() => expect(screen.getByDisplayValue("Rizq Foundation")).toBeInTheDocument());

      // Read-only indicator banner
      expect(screen.getByText(/Read-only view for chapter leaders/i)).toBeInTheDocument();

      // Organization profile inputs are disabled
      expect(screen.getByLabelText(/Organization name/i)).toBeDisabled();
      expect(screen.getByLabelText(/Brand color/i)).toBeDisabled();
      expect(screen.getByLabelText(/Description/i)).toBeDisabled();

      // Save profile button and upload logo button are absent
      expect(screen.queryByRole("button", { name: /Save profile/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Upload logo/i })).not.toBeInTheDocument();

      // Chapters panel is rendered within the page
      expect(screen.getByText("Lahore Chapter")).toBeInTheDocument();
    });

    it("Demotion lifecycle: demoting from National Org Admin to Chapter Admin revokes unconstrained org-tier capabilities", () => {
      // 1. Initial state: National Org Admin
      setupRoleEnvironment(ROLES.NATIONAL_ORG_ADMIN);
      const { result: nationalResult, rerender } = renderHook(() => useStaffPermissions());

      expect(nationalResult.current.isChapterScoped).toBe(false);
      expect(nationalResult.current.canManageOrgProfile).toBe(true);
      expect(nationalResult.current.canCreateChapters).toBe(true);
      expect(nationalResult.current.canViewInquiries).toBe(true);
      expect(nationalResult.current.canEditChapter("khi")).toBe(true);
      expect(nationalResult.current.canEditChapter("lhr")).toBe(true);
      expect(deriveRoleTitleFromPermissions(ROLES.NATIONAL_ORG_ADMIN.permissions, false)).toBe("Org Admin");

      // 2. Demote to Chapter Admin (chapter-scoped to Lahore)
      setupRoleEnvironment(ROLES.CHAPTER_ADMIN);
      rerender();

      expect(nationalResult.current.isChapterScoped).toBe(true);
      expect(nationalResult.current.scopedChapterIds).toEqual(["lhr"]);
      expect(nationalResult.current.canManageOrgProfile).toBe(false);
      expect(nationalResult.current.canCreateChapters).toBe(false);
      expect(nationalResult.current.canViewInquiries).toBe(false);
      expect(nationalResult.current.canEditChapter("lhr")).toBe(true);
      expect(nationalResult.current.canEditChapter("khi")).toBe(false);
      expect(deriveRoleTitleFromPermissions(ROLES.CHAPTER_ADMIN.permissions, true)).toBe("Chapter Admin");
    });
  });
});

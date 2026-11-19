import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { resolvePlatformCaller, createPlatformAdminClient, loadEnabledCatalogs } = vi.hoisted(() => ({
  resolvePlatformCaller: vi.fn(),
  createPlatformAdminClient: vi.fn(),
  loadEnabledCatalogs: vi.fn(),
}));

vi.mock("@/lib/resolvePlatformCaller", () => ({
  resolvePlatformCaller,
  createPlatformAdminClient,
}));

vi.mock("@/registry/loadEnabledCatalogs", () => ({
  loadEnabledCatalogs,
}));

import { GET } from "./route";

function buildSupabaseMock(opts: { orgRole?: { org_tier: string } | null; assignments?: { id: string }[] }) {
  const orgModulesEq = vi.fn().mockResolvedValue({
    data: [{ modules: { key: "team-governance" } }],
    error: null,
  });

  return {
    from: (table: string) => {
      if (table === "staff_org_roles") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: opts.orgRole ?? null }),
              }),
            }),
          }),
        };
      }
      if (table === "staff_role_assignments") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                limit: async () => ({ data: opts.assignments ?? [] }),
              }),
            }),
          }),
        };
      }
      if (table === "org_modules") {
        return {
          select: () => ({
            eq: orgModulesEq,
          }),
        };
      }
      throw new Error(`unexpected table: ${table}`);
    },
  };
}

function requestFor(orgId: string, token = "access-token") {
  return new NextRequest(`http://localhost/api/module-catalogs?organizationId=${orgId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

describe("GET /api/module-catalogs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadEnabledCatalogs.mockResolvedValue([{ key: "team-governance" }]);
  });

  it("returns 403 when the caller is not affiliated with the requested organization", async () => {
    resolvePlatformCaller.mockResolvedValue({ staffId: "staff-other", platformOwner: false });
    createPlatformAdminClient.mockReturnValue(buildSupabaseMock({}));

    const response = await GET(requestFor("org-target"));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "forbidden" });
    expect(loadEnabledCatalogs).not.toHaveBeenCalled();
  });

  it("returns catalogs when the caller has a role assignment in the org", async () => {
    resolvePlatformCaller.mockResolvedValue({ staffId: "staff-home", platformOwner: false });
    createPlatformAdminClient.mockReturnValue(
      buildSupabaseMock({ assignments: [{ id: "asg-1" }] }),
    );

    const response = await GET(requestFor("org-home"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ catalogs: [{ key: "team-governance" }] });
    expect(loadEnabledCatalogs).toHaveBeenCalled();
  });
});
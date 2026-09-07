import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  setPassword,
  createOrganization,
  updateOrganization,
  enableModule,
  assignStaffOrgRole,
  createCustomRole,
  deactivateStaff,
} from "./platformFunctions";
import { RESTRICTED_GRID } from "./capabilityMap";

const FUNCTIONS_URL = "http://localhost:54321/functions/v1";

beforeEach(() => {
  process.env.NEXT_PUBLIC_FUNCTIONS_URL = FUNCTIONS_URL;
  vi.stubGlobal("fetch", vi.fn());
});

function mockOk(body: unknown) {
  (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }));
}

describe("setPassword", () => {
  it("posts to set-password", async () => {
    mockOk({ staffId: "s1" });
    const result = await setPassword({ newPassword: "brand-new-password" }, "session-token");
    expect(result.staffId).toBe("s1");
  });
});

describe("createOrganization", () => {
  it("posts to create-organization", async () => {
    mockOk({ organizationId: "org-1" });
    const result = await createOrganization({ name: "Rizq", slug: "rizq" }, "session-token");
    expect(result.organizationId).toBe("org-1");
  });
});

describe("updateOrganization", () => {
  it("posts to update-organization and returns enabled module keys", async () => {
    mockOk({ enabledModuleKeys: ["youth-republic"] });
    const result = await updateOrganization({ organizationId: "org-1", name: "Rizq Renamed" }, "session-token");
    expect(result.enabledModuleKeys).toEqual(["youth-republic"]);
  });

  it("sends branding fields in the POST body", async () => {
    mockOk({ enabledModuleKeys: ["youth-republic"] });
    await updateOrganization(
      {
        organizationId: "org-1",
        name: "Rizq Renamed",
        brandColor: "#0f172a",
        logoUrl: "https://cdn.example.com/logo.png",
        faviconUrl: "https://cdn.example.com/favicon.ico",
        about: "A food-security nonprofit.",
      },
      "session-token",
    );
    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe(`${FUNCTIONS_URL}/update-organization`);
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      organizationId: "org-1",
      name: "Rizq Renamed",
      brandColor: "#0f172a",
      logoUrl: "https://cdn.example.com/logo.png",
      faviconUrl: "https://cdn.example.com/favicon.ico",
      about: "A food-security nonprofit.",
    });
  });
});

describe("enableModule", () => {
  it("posts to enable-module", async () => {
    mockOk({ moduleKey: "youth-republic" });
    const result = await enableModule({ organizationId: "org-1", moduleKey: "youth-republic" }, "session-token");
    expect(result.moduleKey).toBe("youth-republic");
  });
});

describe("assignStaffOrgRole", () => {
  it("posts to assign-staff-org-role", async () => {
    mockOk({ staffId: "s3" });
    const result = await assignStaffOrgRole(
      { staffId: "s3", organizationId: "org-1", orgTier: "super_admin" },
      "session-token",
    );
    expect(result.staffId).toBe("s3");
  });
});

describe("createCustomRole", () => {
  it("posts to create-custom-role with the capability grid", async () => {
    mockOk({ roleId: "role-2" });
    const result = await createCustomRole(
      {
        organizationId: "org-1",
        moduleId: "mod-1",
        name: "Hours Verifier",
        description: "Verifies hours",
        capabilities: { ...RESTRICTED_GRID, hours: "granted" },
      },
      "session-token",
    );
    expect(result.roleId).toBe("role-2");
    const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe(`${FUNCTIONS_URL}/create-custom-role`);
  });
});

describe("deactivateStaff", () => {
  it("posts to deactivate-staff", async () => {
    mockOk({ staffId: "s3" });
    const result = await deactivateStaff({ targetStaffId: "s3" }, "session-token");
    expect(result.staffId).toBe("s3");
  });

  it("throws with the server's error message on failure", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ error: "forbidden" }), { status: 403 }),
    );
    await expect(deactivateStaff({ targetStaffId: "s3" }, "session-token")).rejects.toThrow("forbidden");
  });
});

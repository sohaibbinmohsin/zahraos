import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createStaff,
  setPassword,
  createOrganization,
  updateOrganization,
  enableModule,
  assignStaffModuleRole,
  assignStaffOrgRole,
  createCustomRole,
  deactivateStaff,
} from "./platformFunctions";

const FUNCTIONS_URL = "http://localhost:54321/functions/v1";

beforeEach(() => {
  process.env.NEXT_PUBLIC_FUNCTIONS_URL = FUNCTIONS_URL;
  vi.stubGlobal("fetch", vi.fn());
});

function mockOk(body: unknown) {
  (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }));
}

describe("createStaff", () => {
  it("posts to create-staff and returns the temporary password", async () => {
    mockOk({ staffId: "s1", temporaryPassword: "temp-pass-123" });

    const result = await createStaff(
      { fullName: "New Staff", email: "new@example.com", organizationId: "org-1" },
      "session-token",
    );

    expect(result.temporaryPassword).toBe("temp-pass-123");
    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe(`${FUNCTIONS_URL}/create-staff`);
    expect(init.headers.Authorization).toBe("Bearer session-token");
  });
});

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
    mockOk({ enabledModuleKeys: ["vms"] });
    const result = await updateOrganization({ organizationId: "org-1", name: "Rizq Renamed" }, "session-token");
    expect(result.enabledModuleKeys).toEqual(["vms"]);
  });
});

describe("enableModule", () => {
  it("posts to enable-module", async () => {
    mockOk({ moduleKey: "vms" });
    const result = await enableModule({ organizationId: "org-1", moduleKey: "vms" }, "session-token");
    expect(result.moduleKey).toBe("vms");
  });
});

describe("assignStaffModuleRole", () => {
  it("posts to assign-staff-module-role", async () => {
    mockOk({ staffId: "s2" });
    const result = await assignStaffModuleRole(
      { staffId: "s2", organizationId: "org-1", moduleId: "mod-1", roleId: "role-1" },
      "session-token",
    );
    expect(result.staffId).toBe("s2");
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
  it("posts to create-custom-role", async () => {
    mockOk({ roleId: "role-2" });
    const result = await createCustomRole(
      { organizationId: "org-1", moduleId: "mod-1", name: "Hours Verifier", permissionIds: ["perm-1"] },
      "session-token",
    );
    expect(result.roleId).toBe("role-2");
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

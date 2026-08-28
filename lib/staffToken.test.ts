import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchStaffToken, decodeStaffTokenClaims } from "./staffToken";

const FUNCTIONS_URL = "http://localhost:54321/functions/v1";

beforeEach(() => {
  process.env.NEXT_PUBLIC_FUNCTIONS_URL = FUNCTIONS_URL;
  vi.stubGlobal("fetch", vi.fn());
});

describe("fetchStaffToken", () => {
  it("posts to mint-staff-token with the platform access token and returns the JWT", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ token: "signed.jwt.token" }), { status: 200 }),
    );

    const token = await fetchStaffToken("platform-session-token");

    expect(token).toBe("signed.jwt.token");
    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe(`${FUNCTIONS_URL}/mint-staff-token`);
    expect(init.headers.Authorization).toBe("Bearer platform-session-token");
  });

  it("throws with the server's error message on failure", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 }),
    );

    await expect(fetchStaffToken("bad-token")).rejects.toThrow("unauthorized");
  });
});

describe("decodeStaffTokenClaims", () => {
  it("decodes the JWT payload without verifying the signature", () => {
    const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const payload = btoa(JSON.stringify({
      actor_type: "staff",
      staff_id: "staff-1",
      platform_owner: false,
      org_roles: [{ organization_id: "org-1" }],
      module_access: [{ organization_id: "org-1", module: "vms", permissions: ["applications:read"] }],
    }));
    const fakeToken = `${header}.${payload}.fakesignature`;

    const claims = decodeStaffTokenClaims(fakeToken);

    expect(claims.staffId).toBe("staff-1");
    expect(claims.platformOwner).toBe(false);
    expect(claims.orgRoles).toEqual([{ organizationId: "org-1" }]);
    expect(claims.moduleAccess).toEqual([{ organizationId: "org-1", module: "vms", permissions: ["applications:read"] }]);
  });
});

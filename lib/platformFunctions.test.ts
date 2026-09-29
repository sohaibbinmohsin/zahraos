import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  setPassword,
  createOrganization,
  updateOrganization,
  enableModule,
  assignStaffOrgRole,
  createCustomRole,
  deactivateStaff,
  updateChapter,
  lookupYouthRepublicMember,
  listChapterTeamMembers,
  requestPublicAssetUpload,
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

describe("updateChapter", () => {
  it("posts to update-chapter with basic fields", async () => {
    mockOk({ chapterId: "chap-1" });
    const result = await updateChapter(
      { chapterId: "chap-1", name: "Karachi Central", city: "Karachi", status: "active" },
      "session-token",
    );
    expect(result.chapterId).toBe("chap-1");
    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe(`${FUNCTIONS_URL}/update-chapter`);
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      chapterId: "chap-1",
      name: "Karachi Central",
      city: "Karachi",
      status: "active",
    });
  });

  it("passes extended profile and teamMembers roster payload", async () => {
    mockOk({ chapterId: "chap-1" });
    const payload = {
      chapterId: "chap-1",
      name: "Lahore North",
      city: "Lahore",
      status: "active" as const,
      logoUrl: "https://example.com/logo.png",
      about: "Northern chapter of Lahore.",
      teamMembers: [
        {
          volunteerCode: "YR-2026-0001",
          fullName: "Ahmed Ali",
          email: "ahmed@example.com",
          avatarUrl: "https://example.com/avatar.png",
          designation: "Chapter President",
          term: "2025–2026",
          status: "active" as const,
        },
        {
          volunteerCode: "YR-2026-0002",
          fullName: "Fatima Noor",
          email: null,
          avatarUrl: null,
          designation: "Media Lead",
          term: "2024–2025",
          status: "alumni" as const,
        },
      ],
    };
    const result = await updateChapter(payload, "session-token");
    expect(result.chapterId).toBe("chap-1");
    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe(`${FUNCTIONS_URL}/update-chapter`);
    expect(JSON.parse((init as RequestInit).body as string)).toEqual(payload);
  });
});

describe("lookupYouthRepublicMember", () => {
  it("posts to lookup-youth-republic-member and returns member details", async () => {
    mockOk({
      volunteerCode: "YR-2026-000123",
      fullName: "Zahra Khan",
      email: "zahra@example.com",
      avatarUrl: "https://example.com/zahra.jpg",
    });

    const result = await lookupYouthRepublicMember(
      { organizationId: "org-1", youthRepublicId: "YR-2026-000123" },
      "session-token",
    );

    expect(result).toEqual({
      volunteerCode: "YR-2026-000123",
      fullName: "Zahra Khan",
      email: "zahra@example.com",
      avatarUrl: "https://example.com/zahra.jpg",
    });

    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe(`${FUNCTIONS_URL}/lookup-youth-republic-member`);
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      organizationId: "org-1",
      youthRepublicId: "YR-2026-000123",
    });
  });

  it("handles volunteer not found (404) cleanly", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ error: "volunteer_not_found" }), { status: 404 }),
    );

    await expect(
      lookupYouthRepublicMember(
        { organizationId: "org-1", youthRepublicId: "NON-EXISTENT" },
        "session-token",
      ),
    ).rejects.toThrow("volunteer_not_found");
  });
});

describe("listChapterTeamMembers", () => {
  it("posts to list-chapter-team-members and returns roster", async () => {
    const mockRoster = [
      {
        id: "mem-1",
        chapterId: "chap-1",
        volunteerCode: "YR-2026-0001",
        fullName: "Ahmed Ali",
        email: "ahmed@example.com",
        avatarUrl: null,
        designation: "President",
        term: "2025–2026",
        status: "active" as const,
        createdAt: "2026-01-01T00:00:00Z",
      },
    ];
    mockOk({ teamMembers: mockRoster });

    const result = await listChapterTeamMembers({ chapterId: "chap-1" }, "session-token");
    expect(result.teamMembers).toEqual(mockRoster);

    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe(`${FUNCTIONS_URL}/list-chapter-team-members`);
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ chapterId: "chap-1" });
  });
});

describe("requestPublicAssetUpload", () => {
  it("posts to upload-public-asset and returns uploadUrl, publicUrl, objectKey", async () => {
    mockOk({
      uploadUrl: "https://r2.example.com/signed-put-url",
      publicUrl: "https://cdn.example.com/logos/org-1/uuid.png",
      objectKey: "logos/org-1/uuid.png",
    });

    const result = await requestPublicAssetUpload(
      { domain: "logo", contentType: "image/png" },
      "session-token",
    );

    expect(result).toEqual({
      uploadUrl: "https://r2.example.com/signed-put-url",
      publicUrl: "https://cdn.example.com/logos/org-1/uuid.png",
      objectKey: "logos/org-1/uuid.png",
    });

    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe(`${FUNCTIONS_URL}/upload-public-asset`);
    expect((init as RequestInit).method).toBe("POST");
    expect((init as RequestInit).headers).toEqual({
      "Content-Type": "application/json",
      Authorization: "Bearer session-token",
    });
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      domain: "logo",
      contentType: "image/png",
    });
  });

  it("prioritizes NEXT_PUBLIC_YOUTH_REPUBLIC_FUNCTIONS_URL when set", async () => {
    process.env.NEXT_PUBLIC_YOUTH_REPUBLIC_FUNCTIONS_URL = "https://yr-functions.supabase.co/functions/v1";
    mockOk({
      uploadUrl: "https://r2.example.com/signed-put-url",
      publicUrl: "https://cdn.example.com/logos/uuid.jpg",
      objectKey: "logos/uuid.jpg",
    });

    await requestPublicAssetUpload(
      { domain: "logo", contentType: "image/jpeg", fileName: "logo.jpg" },
      "session-token",
    );

    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("https://yr-functions.supabase.co/functions/v1/upload-public-asset");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      domain: "logo",
      contentType: "image/jpeg",
      fileName: "logo.jpg",
    });

    delete process.env.NEXT_PUBLIC_YOUTH_REPUBLIC_FUNCTIONS_URL;
  });

  it("throws error when neither functions URL env var is configured", async () => {
    delete process.env.NEXT_PUBLIC_FUNCTIONS_URL;
    delete process.env.NEXT_PUBLIC_YOUTH_REPUBLIC_FUNCTIONS_URL;

    await expect(
      requestPublicAssetUpload({ domain: "logo", contentType: "image/png" }, "token"),
    ).rejects.toThrow("NEXT_PUBLIC_YOUTH_REPUBLIC_FUNCTIONS_URL is not set");
  });

  it("throws error when API returns error", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ error: "invalid_content_type" }), { status: 400 }),
    );

    await expect(
      requestPublicAssetUpload({ domain: "logo", contentType: "application/pdf" }, "token"),
    ).rejects.toThrow("invalid_content_type");
  });
});


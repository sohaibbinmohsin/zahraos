# Platform Frontend Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `platform` admin-hub shell — staff login, forced password change, the org switcher + claims-driven nav, the module registry mechanism, and the `platform_owner`/`org_admin` management screens (organizations, module enablement, staff, roles) — as a working Next.js app with zero module UIs mounted yet.

**Architecture:** Next.js App Router, authenticated-only (no public pages). Two Supabase identities stay deliberately separate: `platform`'s own Supabase session (used for every read/write against `platform`'s own tables — staff, organizations, modules, roles — all gated by the RLS already built in the backend plan) and the cross-project staff JWT (`mintStaffToken()`), fetched once per session purely to derive nav data from `module_access`, never used to call `platform`'s own tables. The module registry (`registry/modules.ts`) starts empty — this plan builds the mechanism the shell iterates over, not any module's screens.

**Tech Stack:** Next.js (App Router) + TypeScript + Tailwind CSS, `@supabase/ssr` for browser/server Supabase clients, Vitest + React Testing Library for tests, deployed on Vercel.

**Spec:** [docs/superpowers/specs/2026-08-27-platform-design.md](../specs/2026-08-27-platform-design.md) (§4 Auth & JWT Issuance, §5 Admin Hub Shell & Module Structure, §7 Cross-Repo Integration) — no dedicated frontend spec exists; this plan works directly from platform-design.md, matching how `youth-republic`'s `vms-frontend` plan worked directly from `vms-design.md` without its own spec.

**Depends on:** [docs/superpowers/plans/2026-08-27-platform-backend.md](2026-08-27-platform-backend.md) — every Edge Function this plan's UI calls already exists there: `mint-staff-token`, `create-staff`, `set-password`, `create-organization`, `update-organization`, `enable-module`, `assign-staff-module-role`, `create-custom-role`, `deactivate-staff`. This plan also reads `platform`'s own tables (`staff`, `organizations`, `modules`, `org_modules`, `staff_org_roles`, `staff_module_roles`, `roles`, `permissions`) directly through `platform`'s Supabase client, relying on the RLS policies that plan's Task 10 already built.

## Global Constraints

- No public pages anywhere in this app — every route requires an authenticated `platform` staff session (spec §5). The only route reachable while signed out is `/login`.
- `must_change_password` gates everything else reachable after login (spec §4) — a staff member with that flag set sees only `/set-password` until it clears.
- The staff JWT (`mintStaffToken()`) is fetched and attached only when calling a module backend's Edge Functions/PostgREST directly — it is never used for `platform`'s own Supabase calls, and `platform`'s own Supabase session is never sent to a module backend (spec §4).
- A module's code lives entirely under its own `modules/<key>/` subfolder in `app/`, `lib/`, and `components/`; the only file that "knows about" every module is `registry/modules.ts` (spec §5). This plan creates that file **empty** — populating it with a `vms` entry, and building `app/modules/vms/`, `lib/modules/vms/client.ts`, and `components/modules/vms/`, is explicitly out of scope, deferred to the next plan.
- `org_tier` (`admin`/`super_admin`) is read directly from `platform`'s own `staff_org_roles` table for UI gating — it is a `platform`-internal concept and never appears in the staff JWT (platform-backend spec §3, §4).
- Staff aren't invited, they're created — the "create staff" screen shows the system-generated temporary password once, in the response, and never re-fetches or persists it client-side (spec §2, §4).
- Module enablement (`org_modules`) and organization creation are `platform_owner`-only; custom roles and staff/module-role management are `org_admin`/`org_super_admin`-only, per the organization currently selected (spec §2).

---

## File Structure

```
tmp-partner-admin/
  package.json
  next.config.ts
  tsconfig.json
  tailwind.config.ts
  postcss.config.js
  vitest.config.ts
  vitest.setup.ts
  .env.local.example
  middleware.ts
  supabase/                             (already exists — platform-backend plan)
  registry/
    modules.ts
  app/
    layout.tsx
    globals.css
    page.tsx                            (post-login landing / empty states)
    login/
      page.tsx
    set-password/
      page.tsx
    organizations/
      page.tsx                          (platform_owner: list, create, module enablement)
    staff/
      page.tsx                          (org_admin/org_super_admin: list, create, deactivate)
    roles/
      page.tsx                          (org_admin/org_super_admin: list, create custom role, assign staff module role)
    modules/                            (empty — next plan adds modules/vms/ here)
  lib/
    supabase/
      browserClient.ts
      serverClient.ts
    middlewareRedirect.ts               (pure, unit-tested redirect logic middleware.ts calls)
    staffToken.ts
    platformFunctions.ts
    selectedOrg.ts
    modules/                            (empty — next plan adds modules/vms/client.ts here)
  components/
    shell/
      AppShell.tsx
      OrgSwitcher.tsx
    modules/                            (empty — next plan adds modules/vms/ here)
    LoginForm.tsx
    SetPasswordForm.tsx
    OrganizationsList.tsx
    CreateOrganizationForm.tsx
    ModuleEnablementPanel.tsx
    StaffList.tsx
    CreateStaffForm.tsx
    DeactivateStaffButton.tsx
    RolesList.tsx
    CreateCustomRoleForm.tsx
    AssignStaffModuleRoleForm.tsx
```

Client-vs-server split follows the same convention as `vms/frontend`: every page that reads the staff's own session or handles form interactivity is a `"use client"` component using `lib/supabase/browserClient.ts`. There is no server-rendering requirement here (no SEO/social-preview concern like `vms/frontend`'s public opportunity pages), so no page needs to be a server component — `lib/supabase/serverClient.ts` exists only for `middleware.ts`.

---

### Task 1: Project bootstrap

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.js`
- Create: `vitest.config.ts`, `vitest.setup.ts`
- Create: `.env.local.example`
- Create: `app/layout.tsx`, `app/globals.css`, `app/page.tsx`

**Interfaces:**
- Produces: the Next.js app shell and test runner, required by every later task. `supabase/` (already committed by the backend plan) is untouched by this task — `create-next-app` must be run without overwriting it.

- [ ] **Step 1: Scaffold the Next.js app without touching `supabase/`**

```bash
cd /Users/sohaibbinmohsin/Developer/rizq/tmp-partner-admin
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir --import-alias "@/*" --eslint
```

Answer "No" if prompted about a non-empty directory overwrite warning tied to `docs/`, `supabase/`, or `README.md` — `create-next-app` only touches files it needs to create (`package.json`, `app/`, etc.) and will not delete existing directories it doesn't own.

- [ ] **Step 2: Install Supabase and test dependencies**

```bash
npm install @supabase/ssr @supabase/supabase-js
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

- [ ] **Step 3: Configure Vitest**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
```

Create `vitest.setup.ts`:

```typescript
import "@testing-library/jest-dom/vitest";
```

Add to `package.json` scripts: `"test": "vitest run"`.

- [ ] **Step 4: Document required environment variables**

Create `.env.local.example`:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_FUNCTIONS_URL=
```

`NEXT_PUBLIC_FUNCTIONS_URL` is `platform`'s own Edge Functions base (e.g. `http://localhost:54321/functions/v1` locally) — distinct from any module backend's functions URL, which this app never calls directly from the browser except through a module's own typed client (not built in this plan).

- [ ] **Step 5: Write a smoke test for the home page**

Create `app/page.test.tsx`:

```typescript
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import Home from "./page";

describe("Home", () => {
  it("renders a heading", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npm test -- app/page.test.tsx`
Expected: FAIL — the scaffolded `page.tsx` has no `<h1>`, or the test can't resolve the component export shape.

- [ ] **Step 7: Write a placeholder home page**

Replace `app/page.tsx` (Task 9 replaces this with the real landing logic):

```tsx
export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-2xl font-semibold">Admin Hub</h1>
    </main>
  );
}
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npm test -- app/page.test.tsx`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add package.json next.config.ts tsconfig.json tailwind.config.ts postcss.config.js vitest.config.ts vitest.setup.ts .env.local.example app/layout.tsx app/globals.css app/page.tsx app/page.test.tsx .gitignore
git commit -m "chore: bootstrap platform frontend Next.js app"
```

---

### Task 2: Supabase clients and the middleware redirect gate

**Files:**
- Create: `lib/supabase/browserClient.ts`
- Create: `lib/supabase/serverClient.ts`
- Create: `lib/middlewareRedirect.ts`
- Create: `lib/middlewareRedirect.test.ts`
- Create: `middleware.ts`

**Interfaces:**
- Produces: `getBrowserSupabaseClient(): SupabaseClient`, `getServerSupabaseClient(): Promise<SupabaseClient>` (both used by every later client/server component in this plan). `computeMiddlewareRedirect(input: { pathname: string; isAuthenticated: boolean; mustChangePassword: boolean }): string | null` — the pure decision function `middleware.ts` calls; returns a path to redirect to, or `null` to let the request through. Pulled out as a pure function specifically so the two-gate logic (session gate, then password-change gate) is unit-testable without mocking Next.js's request/response types or Supabase.

- [ ] **Step 1: Write the failing test for the redirect logic**

Create `lib/middlewareRedirect.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { computeMiddlewareRedirect } from "./middlewareRedirect";

describe("computeMiddlewareRedirect", () => {
  it("redirects an unauthenticated request on a protected path to /login", () => {
    const result = computeMiddlewareRedirect({ pathname: "/staff", isAuthenticated: false, mustChangePassword: false });
    expect(result).toBe("/login");
  });

  it("lets an unauthenticated request through on /login itself", () => {
    const result = computeMiddlewareRedirect({ pathname: "/login", isAuthenticated: false, mustChangePassword: false });
    expect(result).toBeNull();
  });

  it("redirects an authenticated request that must change password to /set-password", () => {
    const result = computeMiddlewareRedirect({ pathname: "/staff", isAuthenticated: true, mustChangePassword: true });
    expect(result).toBe("/set-password");
  });

  it("lets an authenticated must-change-password request through on /set-password itself", () => {
    const result = computeMiddlewareRedirect({ pathname: "/set-password", isAuthenticated: true, mustChangePassword: true });
    expect(result).toBeNull();
  });

  it("redirects away from /set-password once the password no longer needs changing", () => {
    const result = computeMiddlewareRedirect({ pathname: "/set-password", isAuthenticated: true, mustChangePassword: false });
    expect(result).toBe("/");
  });

  it("redirects an authenticated request away from /login to the home page", () => {
    const result = computeMiddlewareRedirect({ pathname: "/login", isAuthenticated: true, mustChangePassword: false });
    expect(result).toBe("/");
  });

  it("lets a fully authenticated, password-set request through on any other path", () => {
    const result = computeMiddlewareRedirect({ pathname: "/staff", isAuthenticated: true, mustChangePassword: false });
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/middlewareRedirect.test.ts`
Expected: FAIL — `middlewareRedirect.ts` does not exist.

- [ ] **Step 3: Write the implementation**

Create `lib/middlewareRedirect.ts`:

```typescript
export interface MiddlewareRedirectInput {
  pathname: string;
  isAuthenticated: boolean;
  mustChangePassword: boolean;
}

export function computeMiddlewareRedirect(input: MiddlewareRedirectInput): string | null {
  const { pathname, isAuthenticated, mustChangePassword } = input;
  const isLoginPath = pathname === "/login" || pathname.startsWith("/login/");
  const isSetPasswordPath = pathname === "/set-password" || pathname.startsWith("/set-password/");

  if (!isAuthenticated) {
    return isLoginPath ? null : "/login";
  }

  if (mustChangePassword) {
    return isSetPasswordPath ? null : "/set-password";
  }

  if (isSetPasswordPath || isLoginPath) {
    return "/";
  }

  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/middlewareRedirect.test.ts`
Expected: PASS on all 7 tests.

- [ ] **Step 5: Write the Supabase client modules**

Create `lib/supabase/browserClient.ts`:

```typescript
import { createBrowserClient } from "@supabase/ssr";

export function getBrowserSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

Create `lib/supabase/serverClient.ts`:

```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function getServerSupabaseClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        },
      },
    },
  );
}
```

- [ ] **Step 6: Write `middleware.ts`**

Create `middleware.ts`:

```typescript
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { computeMiddlewareRedirect } from "./lib/middlewareRedirect";

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();

  let mustChangePassword = false;
  if (user) {
    const { data: staffRow } = await supabase
      .from("staff")
      .select("must_change_password")
      .eq("auth_user_id", user.id)
      .single();
    mustChangePassword = staffRow?.must_change_password ?? false;
  }

  const redirectTo = computeMiddlewareRedirect({
    pathname: request.nextUrl.pathname,
    isAuthenticated: Boolean(user),
    mustChangePassword,
  });

  if (redirectTo) {
    return NextResponse.redirect(new URL(redirectTo, request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

`staff.must_change_password` is readable here under the `staff_self_select` RLS policy (`auth_user_id = auth.uid()`, platform-backend spec Task 10) — no service-role key needed in middleware.

- [ ] **Step 7: Commit**

```bash
git add lib/supabase/ lib/middlewareRedirect.ts lib/middlewareRedirect.test.ts middleware.ts
git commit -m "feat: add Supabase clients and auth/password-change middleware gate"
```

---

### Task 3: `lib/staffToken.ts`

**Files:**
- Create: `lib/staffToken.ts`
- Create: `lib/staffToken.test.ts`

**Interfaces:**
- Produces: `fetchStaffToken(platformAccessToken: string): Promise<string>` (calls `mint-staff-token`), `decodeStaffTokenClaims(token: string): StaffTokenClaims`. `StaffTokenClaims = { actorType: string; staffId: string; platformOwner: boolean; orgRoles: { organizationId: string }[]; moduleAccess: { organizationId: string; module: string; permissions: string[] }[] }`. Used by `AppShell` (Task 6) to build nav data, and is the exact seam the next plan's `lib/modules/vms/client.ts` will reuse to attach the staff JWT to module-backend calls.
- Consumes: `NEXT_PUBLIC_FUNCTIONS_URL` (Task 1).

`decodeStaffTokenClaims` only base64-decodes the JWT payload for UI display purposes — it never verifies the signature. That's safe here because this claims value is never used to authorize anything client-side; every module backend independently re-verifies the token's signature server-side (`verifyStaffToken()`, `youth-republic` vms-backend plan Task 12) before trusting any claim in it.

- [ ] **Step 1: Write the failing tests**

Create `lib/staffToken.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- lib/staffToken.test.ts`
Expected: FAIL — `staffToken.ts` does not exist.

- [ ] **Step 3: Write the implementation**

Create `lib/staffToken.ts`:

```typescript
export interface StaffTokenClaims {
  actorType: string;
  staffId: string;
  platformOwner: boolean;
  orgRoles: { organizationId: string }[];
  moduleAccess: { organizationId: string; module: string; permissions: string[] }[];
}

export async function fetchStaffToken(platformAccessToken: string): Promise<string> {
  const baseUrl = process.env.NEXT_PUBLIC_FUNCTIONS_URL;
  if (!baseUrl) {
    throw new Error("NEXT_PUBLIC_FUNCTIONS_URL is not set");
  }

  const response = await fetch(`${baseUrl}/mint-staff-token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${platformAccessToken}`,
    },
    body: JSON.stringify({}),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "request_failed");
  }
  return data.token as string;
}

export function decodeStaffTokenClaims(token: string): StaffTokenClaims {
  const [, payloadSegment] = token.split(".");
  const payload = JSON.parse(atob(payloadSegment)) as Record<string, unknown>;

  return {
    actorType: String(payload.actor_type ?? "staff"),
    staffId: String(payload.staff_id ?? ""),
    platformOwner: Boolean(payload.platform_owner),
    orgRoles: Array.isArray(payload.org_roles)
      ? (payload.org_roles as Array<Record<string, unknown>>).map((r) => ({
        organizationId: String(r.organization_id),
      }))
      : [],
    moduleAccess: Array.isArray(payload.module_access)
      ? (payload.module_access as Array<Record<string, unknown>>).map((m) => ({
        organizationId: String(m.organization_id),
        module: String(m.module),
        permissions: Array.isArray(m.permissions) ? (m.permissions as unknown[]).map(String) : [],
      }))
      : [],
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- lib/staffToken.test.ts`
Expected: PASS on all 3 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/staffToken.ts lib/staffToken.test.ts
git commit -m "feat: add staff JWT fetch and claims decode for nav building"
```

---

### Task 4: `lib/platformFunctions.ts`

**Files:**
- Create: `lib/platformFunctions.ts`
- Create: `lib/platformFunctions.test.ts`

**Interfaces:**
- Produces: `createStaff`, `setPassword`, `createOrganization`, `updateOrganization`, `enableModule`, `assignStaffModuleRole`, `createCustomRole`, `deactivateStaff` — typed wrappers over `fetch`, each taking `platform`'s own session access token (never the staff JWT — these all call `platform`'s own backend, not a module backend). Used by Tasks 8–12.

- [ ] **Step 1: Write the failing tests**

Create `lib/platformFunctions.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createStaff,
  setPassword,
  createOrganization,
  updateOrganization,
  enableModule,
  assignStaffModuleRole,
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- lib/platformFunctions.test.ts`
Expected: FAIL — `platformFunctions.ts` does not exist.

- [ ] **Step 3: Write the implementation**

Create `lib/platformFunctions.ts`:

```typescript
async function callFunction<TResponse>(
  name: string,
  body: unknown,
  accessToken: string,
): Promise<TResponse> {
  const baseUrl = process.env.NEXT_PUBLIC_FUNCTIONS_URL;
  if (!baseUrl) {
    throw new Error("NEXT_PUBLIC_FUNCTIONS_URL is not set");
  }

  const response = await fetch(`${baseUrl}/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "request_failed");
  }
  return data as TResponse;
}

export interface CreateStaffPayload {
  fullName: string;
  email: string;
  organizationId: string;
}
export interface CreateStaffResponse {
  staffId: string;
  temporaryPassword: string;
}
export function createStaff(payload: CreateStaffPayload, accessToken: string) {
  return callFunction<CreateStaffResponse>("create-staff", payload, accessToken);
}

export interface SetPasswordPayload {
  newPassword: string;
}
export interface SetPasswordResponse {
  staffId: string;
}
export function setPassword(payload: SetPasswordPayload, accessToken: string) {
  return callFunction<SetPasswordResponse>("set-password", payload, accessToken);
}

export interface CreateOrganizationPayload {
  name: string;
  slug: string;
}
export interface CreateOrganizationResponse {
  organizationId: string;
}
export function createOrganization(payload: CreateOrganizationPayload, accessToken: string) {
  return callFunction<CreateOrganizationResponse>("create-organization", payload, accessToken);
}

export interface UpdateOrganizationPayload {
  organizationId: string;
  name: string;
}
export interface UpdateOrganizationResponse {
  enabledModuleKeys: string[];
}
export function updateOrganization(payload: UpdateOrganizationPayload, accessToken: string) {
  return callFunction<UpdateOrganizationResponse>("update-organization", payload, accessToken);
}

export interface EnableModulePayload {
  organizationId: string;
  moduleKey: string;
}
export interface EnableModuleResponse {
  moduleKey: string;
}
export function enableModule(payload: EnableModulePayload, accessToken: string) {
  return callFunction<EnableModuleResponse>("enable-module", payload, accessToken);
}

export interface AssignStaffModuleRolePayload {
  staffId: string;
  organizationId: string;
  moduleId: string;
  roleId: string;
}
export interface AssignStaffModuleRoleResponse {
  staffId: string;
}
export function assignStaffModuleRole(payload: AssignStaffModuleRolePayload, accessToken: string) {
  return callFunction<AssignStaffModuleRoleResponse>("assign-staff-module-role", payload, accessToken);
}

export interface CreateCustomRolePayload {
  organizationId: string;
  moduleId: string;
  name: string;
  permissionIds: string[];
}
export interface CreateCustomRoleResponse {
  roleId: string;
}
export function createCustomRole(payload: CreateCustomRolePayload, accessToken: string) {
  return callFunction<CreateCustomRoleResponse>("create-custom-role", payload, accessToken);
}

export interface DeactivateStaffPayload {
  targetStaffId: string;
}
export interface DeactivateStaffResponse {
  staffId: string;
}
export function deactivateStaff(payload: DeactivateStaffPayload, accessToken: string) {
  return callFunction<DeactivateStaffResponse>("deactivate-staff", payload, accessToken);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- lib/platformFunctions.test.ts`
Expected: PASS on all 9 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/platformFunctions.ts lib/platformFunctions.test.ts
git commit -m "feat: add typed wrappers over platform's own Edge Functions"
```

---

### Task 5: `registry/modules.ts` and `lib/selectedOrg.ts`

**Files:**
- Create: `registry/modules.ts`
- Create: `registry/modules.test.ts`
- Create: `lib/selectedOrg.ts`
- Create: `lib/selectedOrg.test.ts`

**Interfaces:**
- Produces: `ModuleRegistryEntry = { key: string; navLabel: string; route: string; icon: string }`, `MODULE_REGISTRY: ModuleRegistryEntry[]` — starts as `[]`. A later plan (VMS admin UI) appends `{ key: "vms", navLabel: "Volunteers", route: "/modules/vms", icon: "🧑‍🤝‍🧑" }` here; nothing else in this file changes when that happens. `resolveOrgSwitcherOptions(orgRoles, moduleAccess): string[]` and `pickInitialOrgId(availableOrgIds, storedOrgId): string | null` (`lib/selectedOrg.ts`) — the pure logic `OrgSwitcher` (Task 6) uses to compute which orgs are switchable and which one is selected by default, kept separate from the component so it's unit-testable without rendering anything.

- [ ] **Step 1: Write the failing test for the registry**

Create `registry/modules.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { MODULE_REGISTRY } from "./modules";

describe("MODULE_REGISTRY", () => {
  it("starts empty — no module UI is mounted by the shell plan", () => {
    expect(MODULE_REGISTRY).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- registry/modules.test.ts`
Expected: FAIL — `modules.ts` does not exist.

- [ ] **Step 3: Write the registry**

Create `registry/modules.ts`:

```typescript
export interface ModuleRegistryEntry {
  key: string;
  navLabel: string;
  route: string;
  icon: string;
}

// Empty by design — this plan builds the mechanism the shell iterates
// over, not any module's screens. A module's own implementation plan
// appends its entry here as its own task; nothing else in this file
// changes when that happens (platform-design.md §5).
export const MODULE_REGISTRY: ModuleRegistryEntry[] = [];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- registry/modules.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing tests for `selectedOrg`**

Create `lib/selectedOrg.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { resolveOrgSwitcherOptions, pickInitialOrgId } from "./selectedOrg";

describe("resolveOrgSwitcherOptions", () => {
  it("returns the union of org_roles and module_access organization ids, de-duplicated", () => {
    const result = resolveOrgSwitcherOptions(
      [{ organizationId: "org-1" }],
      [{ organizationId: "org-1", module: "vms", permissions: [] }, { organizationId: "org-2", module: "vms", permissions: [] }],
    );
    expect(result.sort()).toEqual(["org-1", "org-2"]);
  });

  it("returns an empty array when the staff has no org affiliation at all", () => {
    expect(resolveOrgSwitcherOptions([], [])).toEqual([]);
  });
});

describe("pickInitialOrgId", () => {
  it("prefers a stored org id when it's still in the available list", () => {
    expect(pickInitialOrgId(["org-1", "org-2"], "org-2")).toBe("org-2");
  });

  it("falls back to the first available org when the stored id is no longer valid", () => {
    expect(pickInitialOrgId(["org-1", "org-2"], "org-9")).toBe("org-1");
  });

  it("falls back to the first available org when nothing is stored", () => {
    expect(pickInitialOrgId(["org-1", "org-2"], null)).toBe("org-1");
  });

  it("returns null when there are no available orgs at all", () => {
    expect(pickInitialOrgId([], null)).toBeNull();
  });
});
```

- [ ] **Step 6: Run tests to verify they fail**

Run: `npm test -- lib/selectedOrg.test.ts`
Expected: FAIL — `selectedOrg.ts` does not exist.

- [ ] **Step 7: Write the implementation**

Create `lib/selectedOrg.ts`:

```typescript
export function resolveOrgSwitcherOptions(
  orgRoles: { organizationId: string }[],
  moduleAccess: { organizationId: string }[],
): string[] {
  const ids = new Set<string>([
    ...orgRoles.map((r) => r.organizationId),
    ...moduleAccess.map((m) => m.organizationId),
  ]);
  return Array.from(ids);
}

export function pickInitialOrgId(availableOrgIds: string[], storedOrgId: string | null): string | null {
  if (storedOrgId && availableOrgIds.includes(storedOrgId)) {
    return storedOrgId;
  }
  return availableOrgIds[0] ?? null;
}

const STORAGE_KEY = "platform.selectedOrgId";

export function readStoredOrgId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function writeStoredOrgId(orgId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, orgId);
  } catch {
    // Storage can be unavailable (private browsing, quota); the org
    // switcher still works for the current session either way.
  }
}
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `npm test -- lib/selectedOrg.test.ts`
Expected: PASS on all 6 tests.

- [ ] **Step 9: Commit**

```bash
git add registry/modules.ts registry/modules.test.ts lib/selectedOrg.ts lib/selectedOrg.test.ts
git commit -m "feat: add empty module registry and org-switcher selection logic"
```

---

### Task 6: `AppShell` and `OrgSwitcher`

**Files:**
- Create: `components/shell/AppShell.tsx`
- Create: `components/shell/AppShell.test.tsx`
- Create: `components/shell/OrgSwitcher.tsx`
- Create: `components/shell/OrgSwitcher.test.tsx`
- Modify: `app/layout.tsx`

**Interfaces:**
- Consumes: `getBrowserSupabaseClient()` (Task 2), `fetchStaffToken()`/`decodeStaffTokenClaims()` (Task 3), `MODULE_REGISTRY` (Task 5), `resolveOrgSwitcherOptions()`/`pickInitialOrgId()`/`readStoredOrgId()`/`writeStoredOrgId()` (Task 5).
- Produces: `<AppShell>{children}</AppShell>` — fetches the signed-in staff's own `staff` row (`full_name`, `platform_owner`) and the staff JWT claims on mount, renders `OrgSwitcher` when there's more than one org, renders nav links for `Organizations` (platform_owner only), `Staff`/`Roles` (only when the staff has an `admin`/`super_admin` `staff_org_roles` row for the selected org), and one link per `MODULE_REGISTRY` entry the staff has `module_access` for in the selected org. Also exposes the selected org id and staff claims to descendants via React context (`useSelectedOrg()`, `useStaffClaims()`) — every page from Task 8 onward reads these instead of re-fetching.
- `<OrgSwitcher orgIds={string[]} selectedOrgId={string} onSelect={(orgId: string) => void} orgNames={Record<string, string>} />` — a plain `<select>` when there's more than one org; renders nothing when there's zero or one.

- [ ] **Step 1: Write the failing test for `OrgSwitcher`**

Create `components/shell/OrgSwitcher.test.tsx`:

```typescript
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { OrgSwitcher } from "./OrgSwitcher";

describe("OrgSwitcher", () => {
  it("renders nothing when there is only one org", () => {
    const { container } = render(
      <OrgSwitcher orgIds={["org-1"]} selectedOrgId="org-1" orgNames={{ "org-1": "Rizq" }} onSelect={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders a select with one option per org and calls onSelect on change", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(
      <OrgSwitcher
        orgIds={["org-1", "org-2"]}
        selectedOrgId="org-1"
        orgNames={{ "org-1": "Rizq", "org-2": "Second Org" }}
        onSelect={onSelect}
      />,
    );

    expect(screen.getByRole("option", { name: "Rizq" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Second Org" })).toBeInTheDocument();

    await user.selectOptions(screen.getByRole("combobox"), "org-2");
    expect(onSelect).toHaveBeenCalledWith("org-2");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- components/shell/OrgSwitcher.test.tsx`
Expected: FAIL — component does not exist.

- [ ] **Step 3: Write `OrgSwitcher`**

Create `components/shell/OrgSwitcher.tsx`:

```tsx
"use client";

export function OrgSwitcher({
  orgIds,
  selectedOrgId,
  orgNames,
  onSelect,
}: {
  orgIds: string[];
  selectedOrgId: string;
  orgNames: Record<string, string>;
  onSelect: (orgId: string) => void;
}) {
  if (orgIds.length <= 1) {
    return null;
  }

  return (
    <select
      aria-label="Organization"
      className="rounded border px-2 py-1 text-sm"
      value={selectedOrgId}
      onChange={(e) => onSelect(e.target.value)}
    >
      {orgIds.map((orgId) => (
        <option key={orgId} value={orgId}>
          {orgNames[orgId] ?? orgId}
        </option>
      ))}
    </select>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- components/shell/OrgSwitcher.test.tsx`
Expected: PASS on both tests.

- [ ] **Step 5: Write the failing test for `AppShell`**

Create `components/shell/AppShell.test.tsx`:

```typescript
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AppShell } from "./AppShell";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { fetchStaffToken } from "@/lib/staffToken";

vi.mock("@/lib/supabase/browserClient");
vi.mock("@/lib/staffToken", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/staffToken")>();
  return { ...actual, fetchStaffToken: vi.fn() };
});

function encodeFakeToken(payload: Record<string, unknown>) {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.sig`;
}

function mockSupabase(options: {
  staffRow: { full_name: string; platform_owner: boolean };
  orgTierRows: Array<{ organization_id: string; org_tier: string }>;
  organizations: Array<{ id: string; name: string }>;
}) {
  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: "platform-token" } } }),
    },
    from(table: string) {
      if (table === "staff") {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: options.staffRow, error: null }),
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
            in: () => Promise.resolve({ data: options.organizations, error: null }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
}

describe("AppShell", () => {
  beforeEach(() => {
    vi.mocked(fetchStaffToken).mockReset();
  });

  it("renders children, the staff's name, and an Organizations link for a platform_owner", async () => {
    vi.mocked(getBrowserSupabaseClient).mockReturnValue(
      mockSupabase({
        staffRow: { full_name: "Owner Person", platform_owner: true },
        orgTierRows: [],
        organizations: [],
      }) as never,
    );
    vi.mocked(fetchStaffToken).mockResolvedValue(
      encodeFakeToken({ actor_type: "staff", staff_id: "s1", platform_owner: true, org_roles: [], module_access: [] }),
    );

    render(
      <AppShell>
        <p>page content</p>
      </AppShell>,
    );

    expect(screen.getByText("page content")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Owner Person")).toBeInTheDocument());
    expect(screen.getByRole("link", { name: "Organizations" })).toBeInTheDocument();
  });

  it("shows Staff and Roles links only when the staff is admin/super_admin for the selected org", async () => {
    vi.mocked(getBrowserSupabaseClient).mockReturnValue(
      mockSupabase({
        staffRow: { full_name: "Org Admin", platform_owner: false },
        orgTierRows: [{ organization_id: "org-1", org_tier: "admin" }],
        organizations: [{ id: "org-1", name: "Rizq" }],
      }) as never,
    );
    vi.mocked(fetchStaffToken).mockResolvedValue(
      encodeFakeToken({
        actor_type: "staff",
        staff_id: "s2",
        platform_owner: false,
        org_roles: [{ organization_id: "org-1" }],
        module_access: [],
      }),
    );

    render(
      <AppShell>
        <p>page content</p>
      </AppShell>,
    );

    await waitFor(() => expect(screen.getByRole("link", { name: "Staff" })).toBeInTheDocument());
    expect(screen.getByRole("link", { name: "Roles" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Organizations" })).not.toBeInTheDocument();
  });

  it("shows neither Staff/Roles nor Organizations for a regular staff member with no org_tier", async () => {
    vi.mocked(getBrowserSupabaseClient).mockReturnValue(
      mockSupabase({
        staffRow: { full_name: "Regular Staff", platform_owner: false },
        orgTierRows: [],
        organizations: [{ id: "org-1", name: "Rizq" }],
      }) as never,
    );
    vi.mocked(fetchStaffToken).mockResolvedValue(
      encodeFakeToken({
        actor_type: "staff",
        staff_id: "s3",
        platform_owner: false,
        org_roles: [],
        module_access: [{ organization_id: "org-1", module: "vms", permissions: ["applications:read"] }],
      }),
    );

    render(
      <AppShell>
        <p>page content</p>
      </AppShell>,
    );

    await waitFor(() => expect(screen.getByText("Regular Staff")).toBeInTheDocument());
    expect(screen.queryByRole("link", { name: "Staff" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Organizations" })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run tests to verify they fail**

Run: `npm test -- components/shell/AppShell.test.tsx`
Expected: FAIL — `AppShell.tsx` does not exist.

- [ ] **Step 7: Write `AppShell`**

Create `components/shell/AppShell.tsx`:

```tsx
"use client";

import { createContext, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { fetchStaffToken, decodeStaffTokenClaims, type StaffTokenClaims } from "@/lib/staffToken";
import { resolveOrgSwitcherOptions, pickInitialOrgId, readStoredOrgId, writeStoredOrgId } from "@/lib/selectedOrg";
import { MODULE_REGISTRY } from "@/registry/modules";
import { OrgSwitcher } from "./OrgSwitcher";

interface ShellContextValue {
  selectedOrgId: string | null;
  staffClaims: StaffTokenClaims | null;
  orgTier: string | null;
}

const ShellContext = createContext<ShellContextValue>({ selectedOrgId: null, staffClaims: null, orgTier: null });

export function useSelectedOrg() {
  return useContext(ShellContext).selectedOrgId;
}

export function useStaffClaims() {
  return useContext(ShellContext).staffClaims;
}

export function useOrgTier() {
  return useContext(ShellContext).orgTier;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [fullName, setFullName] = useState<string | null>(null);
  const [platformOwner, setPlatformOwner] = useState(false);
  const [claims, setClaims] = useState<StaffTokenClaims | null>(null);
  const [orgNames, setOrgNames] = useState<Record<string, string>>({});
  const [orgTiers, setOrgTiers] = useState<Record<string, string>>({});
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = getBrowserSupabaseClient();
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return;

      const { data: user } = await supabase.auth.getSession();
      const authUserId = user.session?.user.id;

      const staffToken = await fetchStaffToken(sessionData.session.access_token);
      const decoded = decodeStaffTokenClaims(staffToken);
      setClaims(decoded);
      setPlatformOwner(decoded.platformOwner);

      const { data: staffRow } = await supabase
        .from("staff")
        .select("full_name, platform_owner")
        .eq("auth_user_id", authUserId)
        .single();
      if (staffRow) setFullName(staffRow.full_name);

      const { data: orgTierRows } = await supabase
        .from("staff_org_roles")
        .select("organization_id, org_tier")
        .eq("staff_id", decoded.staffId);
      const tiersByOrg: Record<string, string> = {};
      for (const row of orgTierRows ?? []) {
        tiersByOrg[row.organization_id] = row.org_tier;
      }
      setOrgTiers(tiersByOrg);

      const availableOrgIds = resolveOrgSwitcherOptions(decoded.orgRoles, decoded.moduleAccess);
      const initialOrgId = pickInitialOrgId(availableOrgIds, readStoredOrgId());
      setSelectedOrgId(initialOrgId);

      if (availableOrgIds.length > 0) {
        const { data: organizations } = await supabase.from("organizations").select("id, name").in("id", availableOrgIds);
        const names: Record<string, string> = {};
        for (const org of organizations ?? []) {
          names[org.id] = org.name;
        }
        setOrgNames(names);
      }
    }
    load();
  }, []);

  function handleSelectOrg(orgId: string) {
    setSelectedOrgId(orgId);
    writeStoredOrgId(orgId);
  }

  const availableOrgIds = claims ? resolveOrgSwitcherOptions(claims.orgRoles, claims.moduleAccess) : [];
  const orgTier = selectedOrgId ? orgTiers[selectedOrgId] ?? null : null;
  const isOrgAdminOrAbove = orgTier === "admin" || orgTier === "super_admin";
  const moduleLinks = selectedOrgId
    ? MODULE_REGISTRY.filter((m) => claims?.moduleAccess.some((a) => a.organizationId === selectedOrgId && a.module === m.key))
    : [];

  return (
    <ShellContext.Provider value={{ selectedOrgId, staffClaims: claims, orgTier }}>
      <div className="min-h-screen">
        <header className="border-b border-gray-200">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <div className="flex items-center gap-4">
              <Link href="/" className="font-semibold">Admin Hub</Link>
              <nav className="flex gap-4 text-sm">
                {platformOwner && <Link href="/organizations">Organizations</Link>}
                {isOrgAdminOrAbove && <Link href="/staff">Staff</Link>}
                {isOrgAdminOrAbove && <Link href="/roles">Roles</Link>}
                {moduleLinks.map((m) => (
                  <Link key={m.key} href={m.route}>{m.navLabel}</Link>
                ))}
              </nav>
            </div>
            <div className="flex items-center gap-3 text-sm">
              {selectedOrgId && (
                <OrgSwitcher orgIds={availableOrgIds} selectedOrgId={selectedOrgId} orgNames={orgNames} onSelect={handleSelectOrg} />
              )}
              {fullName && <span>{fullName}</span>}
            </div>
          </div>
        </header>
        <div className="mx-auto max-w-5xl px-4 py-6">{children}</div>
      </div>
    </ShellContext.Provider>
  );
}
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `npm test -- components/shell/AppShell.test.tsx`
Expected: PASS on all 3 tests.

- [ ] **Step 9: Wire `AppShell` into the root layout**

Modify `app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { AppShell } from "@/components/shell/AppShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Admin Hub",
  description: "Platform staff administration",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
```

`AppShell` is deliberately mounted at the root layout even though `/login` and `/set-password` don't need nav or org context — its `useEffect` no-ops cleanly when there's no session (`sessionData.session` is `null`), so it renders just the header shell with no name/links, which is harmless on those two pages.

- [ ] **Step 10: Commit**

```bash
git add components/shell/ app/layout.tsx
git commit -m "feat: add AppShell with claims-driven nav and org switcher"
```

---

### Task 7: Login page

**Files:**
- Create: `components/LoginForm.tsx`
- Create: `components/LoginForm.test.tsx`
- Create: `app/login/page.tsx`

**Interfaces:**
- Consumes: `getBrowserSupabaseClient()` (Task 2).
- Produces: `<LoginForm />` — email/password sign-in; on success, `middleware.ts` (Task 2) handles routing the now-authenticated request to `/set-password` or `/` on the next navigation.

- [ ] **Step 1: Write the failing test**

Create `components/LoginForm.test.tsx`:

```typescript
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { LoginForm } from "./LoginForm";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";

vi.mock("@/lib/supabase/browserClient");
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

describe("LoginForm", () => {
  const signInWithPassword = vi.fn();

  beforeEach(() => {
    signInWithPassword.mockReset();
    vi.mocked(getBrowserSupabaseClient).mockReturnValue({
      auth: { signInWithPassword },
    } as never);
  });

  it("submits credentials and shows an error on failure", async () => {
    signInWithPassword.mockResolvedValue({ data: { session: null }, error: { message: "Invalid credentials" } });
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText("Email"), "staff@example.com");
    await user.type(screen.getByLabelText("Password"), "wrong-password");
    await user.click(screen.getByRole("button", { name: "Log in" }));

    expect(await screen.findByText("Invalid credentials")).toBeInTheDocument();
  });

  it("calls signInWithPassword with the entered credentials", async () => {
    signInWithPassword.mockResolvedValue({ data: { session: { access_token: "t" } }, error: null });
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText("Email"), "staff@example.com");
    await user.type(screen.getByLabelText("Password"), "correct-password");
    await user.click(screen.getByRole("button", { name: "Log in" }));

    await waitFor(() => {
      expect(signInWithPassword).toHaveBeenCalledWith({ email: "staff@example.com", password: "correct-password" });
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- components/LoginForm.test.tsx`
Expected: FAIL — component does not exist.

- [ ] **Step 3: Write `LoginForm`**

Create `components/LoginForm.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const supabase = getBrowserSupabaseClient();
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError || !data.session) {
      setError(signInError?.message ?? "login_failed");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm">Email</label>
        <input id="email" type="email" className="mt-1 w-full rounded border px-3 py-2" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm">Password</label>
        <input id="password" type="password" className="mt-1 w-full rounded border px-3 py-2" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" className="w-full rounded bg-gray-900 py-2 text-white">Log in</button>
    </form>
  );
}
```

`router.refresh()` after a successful login forces `middleware.ts` to re-run on the client's next navigation with the now-authenticated session, so the `must_change_password` redirect takes effect immediately rather than on some later navigation.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- components/LoginForm.test.tsx`
Expected: PASS on both tests.

- [ ] **Step 5: Write the login page**

Create `app/login/page.tsx`:

```tsx
import { LoginForm } from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-4 text-xl font-semibold">Admin Hub Login</h1>
      <LoginForm />
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add components/LoginForm.tsx components/LoginForm.test.tsx app/login/
git commit -m "feat: add staff login page"
```

---

### Task 8: Set-password page

**Files:**
- Create: `components/SetPasswordForm.tsx`
- Create: `components/SetPasswordForm.test.tsx`
- Create: `app/set-password/page.tsx`

**Interfaces:**
- Consumes: `getBrowserSupabaseClient()` (Task 2), `setPassword()` (Task 4).
- Produces: `<SetPasswordForm />` — the forced first-login password change (spec §4). On success, `router.refresh()` so middleware re-evaluates `must_change_password` and lets the request through to `/`.

- [ ] **Step 1: Write the failing test**

Create `components/SetPasswordForm.test.tsx`:

```typescript
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SetPasswordForm } from "./SetPasswordForm";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import * as platformFunctions from "@/lib/platformFunctions";

vi.mock("@/lib/supabase/browserClient");
vi.mock("@/lib/platformFunctions");
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

describe("SetPasswordForm", () => {
  beforeEach(() => {
    vi.mocked(platformFunctions.setPassword).mockReset();
    vi.mocked(getBrowserSupabaseClient).mockReturnValue({
      auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: "session-token" } } }) },
    } as never);
  });

  it("rejects when the two password fields don't match", async () => {
    const user = userEvent.setup();
    render(<SetPasswordForm />);

    await user.type(screen.getByLabelText("New password"), "brand-new-password-1");
    await user.type(screen.getByLabelText("Confirm password"), "different-password");
    await user.click(screen.getByRole("button", { name: "Set password" }));

    expect(await screen.findByText("Passwords do not match")).toBeInTheDocument();
    expect(platformFunctions.setPassword).not.toHaveBeenCalled();
  });

  it("submits the new password using the current session's access token", async () => {
    vi.mocked(platformFunctions.setPassword).mockResolvedValue({ staffId: "s1" });
    const user = userEvent.setup();
    render(<SetPasswordForm />);

    await user.type(screen.getByLabelText("New password"), "brand-new-password-1");
    await user.type(screen.getByLabelText("Confirm password"), "brand-new-password-1");
    await user.click(screen.getByRole("button", { name: "Set password" }));

    await waitFor(() => {
      expect(platformFunctions.setPassword).toHaveBeenCalledWith(
        { newPassword: "brand-new-password-1" },
        "session-token",
      );
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- components/SetPasswordForm.test.tsx`
Expected: FAIL — component does not exist.

- [ ] **Step 3: Write `SetPasswordForm`**

Create `components/SetPasswordForm.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { setPassword } from "@/lib/platformFunctions";

export function SetPasswordForm() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setSubmitting(true);
    try {
      const supabase = getBrowserSupabaseClient();
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        setError("unauthorized");
        return;
      }
      await setPassword({ newPassword }, sessionData.session.access_token);
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "unknown_error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="newPassword" className="block text-sm">New password</label>
        <input id="newPassword" type="password" className="mt-1 w-full rounded border px-3 py-2" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
      </div>
      <div>
        <label htmlFor="confirmPassword" className="block text-sm">Confirm password</label>
        <input id="confirmPassword" type="password" className="mt-1 w-full rounded border px-3 py-2" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={submitting} className="w-full rounded bg-gray-900 py-2 text-white disabled:opacity-50">
        Set password
      </button>
    </form>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- components/SetPasswordForm.test.tsx`
Expected: PASS on both tests.

- [ ] **Step 5: Write the set-password page**

Create `app/set-password/page.tsx`:

```tsx
import { SetPasswordForm } from "@/components/SetPasswordForm";

export default function SetPasswordPage() {
  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-4 text-xl font-semibold">Set a new password</h1>
      <p className="mb-4 text-sm text-gray-600">
        You must set your own password before continuing.
      </p>
      <SetPasswordForm />
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add components/SetPasswordForm.tsx components/SetPasswordForm.test.tsx app/set-password/
git commit -m "feat: add forced first-login set-password page"
```

---

### Task 9: Home page (post-login landing and empty states)

**Files:**
- Create: `app/page.tsx` (replaces Task 1's placeholder)
- Create: `app/page.test.tsx` (replaces Task 1's smoke test)

**Interfaces:**
- Consumes: `useSelectedOrg()`, `useStaffClaims()`, `useOrgTier()` (Task 6, `AppShell`'s context hooks).
- Produces: the landing page shown after login (and after `/set-password` completes). Handles the two empty states from the design: zero org/module access at all, and a selected org with zero modules enabled.

- [ ] **Step 1: Write the failing tests**

Replace `app/page.test.tsx`:

```typescript
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import Home from "./page";
import * as shell from "@/components/shell/AppShell";

vi.mock("@/components/shell/AppShell", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/shell/AppShell")>();
  return { ...actual, useSelectedOrg: vi.fn(), useStaffClaims: vi.fn(), useOrgTier: vi.fn() };
});

describe("Home", () => {
  it("shows a no-access message when the staff has no org at all", () => {
    vi.mocked(shell.useSelectedOrg).mockReturnValue(null);
    vi.mocked(shell.useStaffClaims).mockReturnValue({
      actorType: "staff", staffId: "s1", platformOwner: false, orgRoles: [], moduleAccess: [],
    });
    vi.mocked(shell.useOrgTier).mockReturnValue(null);

    render(<Home />);

    expect(screen.getByText(/don't have access to any organization yet/i)).toBeInTheDocument();
  });

  it("shows a no-modules-enabled message for a selected org with no module_access entries", () => {
    vi.mocked(shell.useSelectedOrg).mockReturnValue("org-1");
    vi.mocked(shell.useStaffClaims).mockReturnValue({
      actorType: "staff", staffId: "s1", platformOwner: false,
      orgRoles: [{ organizationId: "org-1" }], moduleAccess: [],
    });
    vi.mocked(shell.useOrgTier).mockReturnValue("admin");

    render(<Home />);

    expect(screen.getByText(/no modules are enabled for this organization yet/i)).toBeInTheDocument();
  });

  it("renders a heading when the staff has at least one module available", () => {
    vi.mocked(shell.useSelectedOrg).mockReturnValue("org-1");
    vi.mocked(shell.useStaffClaims).mockReturnValue({
      actorType: "staff", staffId: "s1", platformOwner: false,
      orgRoles: [{ organizationId: "org-1" }],
      moduleAccess: [{ organizationId: "org-1", module: "vms", permissions: ["applications:read"] }],
    });
    vi.mocked(shell.useOrgTier).mockReturnValue(null);

    render(<Home />);

    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.queryByText(/don't have access/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- app/page.test.tsx`
Expected: FAIL — Task 1's placeholder `page.tsx` doesn't read shell context or render these messages.

- [ ] **Step 3: Write the home page**

Replace `app/page.tsx`:

```tsx
"use client";

import { useSelectedOrg, useStaffClaims } from "@/components/shell/AppShell";

export default function Home() {
  const selectedOrgId = useSelectedOrg();
  const claims = useStaffClaims();

  if (!claims || (claims.orgRoles.length === 0 && claims.moduleAccess.length === 0)) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12 text-center">
        <h1 className="text-2xl font-semibold">Welcome</h1>
        <p className="mt-4 text-gray-600">
          You don&apos;t have access to any organization yet. Contact your platform administrator.
        </p>
      </main>
    );
  }

  const hasModuleAccessForSelectedOrg = claims.moduleAccess.some((m) => m.organizationId === selectedOrgId);

  if (selectedOrgId && !hasModuleAccessForSelectedOrg) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12 text-center">
        <h1 className="text-2xl font-semibold">Welcome</h1>
        <p className="mt-4 text-gray-600">
          No modules are enabled for this organization yet, or you haven&apos;t been granted access to one.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold">Welcome</h1>
      <p className="mt-4 text-gray-600">Select a module from the navigation above.</p>
    </main>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- app/page.test.tsx`
Expected: PASS on all 3 tests.

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx app/page.test.tsx
git commit -m "feat: add home page with zero-access and zero-module empty states"
```

---

### Task 10: Organizations page (`platform_owner`)

**Files:**
- Create: `components/OrganizationsList.tsx`
- Create: `components/OrganizationsList.test.tsx`
- Create: `components/CreateOrganizationForm.tsx`
- Create: `components/CreateOrganizationForm.test.tsx`
- Create: `components/ModuleEnablementPanel.tsx`
- Create: `components/ModuleEnablementPanel.test.tsx`
- Create: `app/organizations/page.tsx`

**Interfaces:**
- Consumes: `getBrowserSupabaseClient()` (Task 2), `createOrganization()`/`enableModule()` (Task 4), `useStaffClaims()` (Task 6).
- Produces: `<OrganizationsList organizations={{ id, name, slug, status }[]} />`, `<CreateOrganizationForm accessToken onCreated />`, `<ModuleEnablementPanel organizationId allModules={{ id, key, displayName }[]} enabledModuleKeys={string[]} accessToken onEnabled />`.

- [ ] **Step 1: Write the failing test for `OrganizationsList`**

Create `components/OrganizationsList.test.tsx`:

```typescript
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { OrganizationsList } from "./OrganizationsList";

describe("OrganizationsList", () => {
  it("renders one row per organization", () => {
    render(
      <OrganizationsList
        organizations={[
          { id: "org-1", name: "Rizq", slug: "rizq", status: "active" },
          { id: "org-2", name: "Second Org", slug: "second-org", status: "active" },
        ]}
      />,
    );
    expect(screen.getByText("Rizq")).toBeInTheDocument();
    expect(screen.getByText("Second Org")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- components/OrganizationsList.test.tsx`
Expected: FAIL — component does not exist.

- [ ] **Step 3: Write `OrganizationsList`**

Create `components/OrganizationsList.tsx`:

```tsx
export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
  status: string;
}

export function OrganizationsList({ organizations }: { organizations: OrganizationSummary[] }) {
  return (
    <ul className="divide-y divide-gray-200">
      {organizations.map((org) => (
        <li key={org.id} className="flex items-center justify-between py-3">
          <div>
            <p className="font-medium">{org.name}</p>
            <p className="text-sm text-gray-500">{org.slug}</p>
          </div>
          <span className="text-sm text-gray-600">{org.status}</span>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- components/OrganizationsList.test.tsx`
Expected: PASS.

- [ ] **Step 5: Write the failing test for `CreateOrganizationForm`**

Create `components/CreateOrganizationForm.test.tsx`:

```typescript
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CreateOrganizationForm } from "./CreateOrganizationForm";
import * as platformFunctions from "@/lib/platformFunctions";

vi.mock("@/lib/platformFunctions");

describe("CreateOrganizationForm", () => {
  beforeEach(() => {
    vi.mocked(platformFunctions.createOrganization).mockReset();
  });

  it("submits name and a slugified slug, then calls onCreated", async () => {
    vi.mocked(platformFunctions.createOrganization).mockResolvedValue({ organizationId: "org-1" });
    const onCreated = vi.fn();
    const user = userEvent.setup();

    render(<CreateOrganizationForm accessToken="session-token" onCreated={onCreated} />);

    await user.type(screen.getByLabelText("Organization name"), "Second Org");
    await user.click(screen.getByRole("button", { name: "Create organization" }));

    await waitFor(() => {
      expect(platformFunctions.createOrganization).toHaveBeenCalledWith(
        { name: "Second Org", slug: "second-org" },
        "session-token",
      );
      expect(onCreated).toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npm test -- components/CreateOrganizationForm.test.tsx`
Expected: FAIL — component does not exist.

- [ ] **Step 7: Write `CreateOrganizationForm`**

Create `components/CreateOrganizationForm.tsx`:

```tsx
"use client";

import { useState } from "react";
import { createOrganization } from "@/lib/platformFunctions";

function slugify(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function CreateOrganizationForm({ accessToken, onCreated }: { accessToken: string; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await createOrganization({ name, slug: slugify(name) }, accessToken);
      setName("");
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "unknown_error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2">
      <div className="flex-1">
        <label htmlFor="orgName" className="block text-sm">Organization name</label>
        <input id="orgName" className="mt-1 w-full rounded border px-3 py-2" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <button type="submit" disabled={submitting} className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-50">
        Create organization
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npm test -- components/CreateOrganizationForm.test.tsx`
Expected: PASS.

- [ ] **Step 9: Write the failing test for `ModuleEnablementPanel`**

Create `components/ModuleEnablementPanel.test.tsx`:

```typescript
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ModuleEnablementPanel } from "./ModuleEnablementPanel";
import * as platformFunctions from "@/lib/platformFunctions";

vi.mock("@/lib/platformFunctions");

describe("ModuleEnablementPanel", () => {
  beforeEach(() => {
    vi.mocked(platformFunctions.enableModule).mockReset();
  });

  it("shows enabled modules as enabled and offers to enable the rest", async () => {
    vi.mocked(platformFunctions.enableModule).mockResolvedValue({ moduleKey: "health" });
    const onEnabled = vi.fn();
    const user = userEvent.setup();

    render(
      <ModuleEnablementPanel
        organizationId="org-1"
        allModules={[{ id: "mod-vms", key: "vms", displayName: "Volunteer Management System" }, { id: "mod-health", key: "health", displayName: "Health" }]}
        enabledModuleKeys={["vms"]}
        accessToken="session-token"
        onEnabled={onEnabled}
      />,
    );

    expect(screen.getByText("Volunteer Management System")).toBeInTheDocument();
    expect(screen.getByText("Enabled")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Enable" }));

    await waitFor(() => {
      expect(platformFunctions.enableModule).toHaveBeenCalledWith(
        { organizationId: "org-1", moduleKey: "health" },
        "session-token",
      );
      expect(onEnabled).toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 10: Run test to verify it fails**

Run: `npm test -- components/ModuleEnablementPanel.test.tsx`
Expected: FAIL — component does not exist.

- [ ] **Step 11: Write `ModuleEnablementPanel`**

Create `components/ModuleEnablementPanel.tsx`:

```tsx
"use client";

import { useState } from "react";
import { enableModule } from "@/lib/platformFunctions";

export interface ModuleSummary {
  id: string;
  key: string;
  displayName: string;
}

export function ModuleEnablementPanel({
  organizationId,
  allModules,
  enabledModuleKeys,
  accessToken,
  onEnabled,
}: {
  organizationId: string;
  allModules: ModuleSummary[];
  enabledModuleKeys: string[];
  accessToken: string;
  onEnabled: () => void;
}) {
  const [error, setError] = useState<string | null>(null);

  async function handleEnable(moduleKey: string) {
    setError(null);
    try {
      await enableModule({ organizationId, moduleKey }, accessToken);
      onEnabled();
    } catch (err) {
      setError(err instanceof Error ? err.message : "unknown_error");
    }
  }

  return (
    <ul className="divide-y divide-gray-200">
      {allModules.map((module) => {
        const isEnabled = enabledModuleKeys.includes(module.key);
        return (
          <li key={module.id} className="flex items-center justify-between py-2">
            <span>{module.displayName}</span>
            {isEnabled ? (
              <span className="text-sm text-green-700">Enabled</span>
            ) : (
              <button
                type="button"
                onClick={() => handleEnable(module.key)}
                className="rounded bg-gray-900 px-3 py-1 text-sm text-white"
              >
                Enable
              </button>
            )}
          </li>
        );
      })}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </ul>
  );
}
```

- [ ] **Step 12: Run test to verify it passes**

Run: `npm test -- components/ModuleEnablementPanel.test.tsx`
Expected: PASS.

- [ ] **Step 13: Write the organizations page**

Create `app/organizations/page.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { OrganizationsList, type OrganizationSummary } from "@/components/OrganizationsList";
import { CreateOrganizationForm } from "@/components/CreateOrganizationForm";
import { ModuleEnablementPanel, type ModuleSummary } from "@/components/ModuleEnablementPanel";

export default function OrganizationsPage() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationSummary[]>([]);
  const [allModules, setAllModules] = useState<ModuleSummary[]>([]);
  const [enabledByOrg, setEnabledByOrg] = useState<Record<string, string[]>>({});
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = getBrowserSupabaseClient();
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) return;
    setAccessToken(sessionData.session.access_token);

    const { data: orgs } = await supabase.from("organizations").select("id, name, slug, status").order("created_at", { ascending: false });
    setOrganizations(orgs ?? []);

    const { data: modules } = await supabase.from("modules").select("id, key, display_name");
    setAllModules((modules ?? []).map((m) => ({ id: m.id, key: m.key, displayName: m.display_name })));

    const { data: orgModules } = await supabase.from("org_modules").select("organization_id, modules(key)");
    const grouped: Record<string, string[]> = {};
    for (const row of orgModules ?? []) {
      const key = (row.modules as unknown as { key: string }).key;
      grouped[row.organization_id] = [...(grouped[row.organization_id] ?? []), key];
    }
    setEnabledByOrg(grouped);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (!accessToken) {
    return <p>Loading…</p>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="mb-4 text-xl font-semibold">Organizations</h1>
        <OrganizationsList organizations={organizations} />
      </div>

      <div>
        <h2 className="mb-2 text-lg font-medium">Create organization</h2>
        <CreateOrganizationForm accessToken={accessToken} onCreated={load} />
      </div>

      <div>
        <h2 className="mb-2 text-lg font-medium">Module enablement</h2>
        <label htmlFor="orgForModules" className="block text-sm">Organization</label>
        <select
          id="orgForModules"
          className="mt-1 mb-4 rounded border px-3 py-2"
          value={selectedOrgId ?? ""}
          onChange={(e) => setSelectedOrgId(e.target.value || null)}
        >
          <option value="">Select an organization</option>
          {organizations.map((org) => (
            <option key={org.id} value={org.id}>{org.name}</option>
          ))}
        </select>

        {selectedOrgId && (
          <ModuleEnablementPanel
            organizationId={selectedOrgId}
            allModules={allModules}
            enabledModuleKeys={enabledByOrg[selectedOrgId] ?? []}
            accessToken={accessToken}
            onEnabled={load}
          />
        )}
      </div>
    </div>
  );
}
```

Reads (`organizations`, `modules`, `org_modules`) go directly through the browser client under the `organizations_select`/`modules_select`/`org_modules_select` RLS policies (platform-backend spec Task 10) — a `platform_owner` passes all three. This page has no client-side guard against a non-`platform_owner` visiting it directly; that's acceptable because RLS itself returns nothing for `org_modules`/limited rows for `organizations` to a non-owner, and `enableModule()`'s own Edge Function independently re-checks `platform_owner` server-side and returns `forbidden` regardless of what the UI shows — the nav link in `AppShell` (Task 6) just keeps a non-owner from finding the page, it isn't the enforcement.

- [ ] **Step 14: Commit**

```bash
git add components/OrganizationsList.tsx components/OrganizationsList.test.tsx components/CreateOrganizationForm.tsx components/CreateOrganizationForm.test.tsx components/ModuleEnablementPanel.tsx components/ModuleEnablementPanel.test.tsx app/organizations/
git commit -m "feat: add organizations page with creation and module enablement"
```

---

### Task 11: Staff page (`org_admin`/`org_super_admin`)

**Files:**
- Create: `components/StaffList.tsx`
- Create: `components/StaffList.test.tsx`
- Create: `components/CreateStaffForm.tsx`
- Create: `components/CreateStaffForm.test.tsx`
- Create: `components/DeactivateStaffButton.tsx`
- Create: `components/DeactivateStaffButton.test.tsx`
- Create: `app/staff/page.tsx`

**Interfaces:**
- Consumes: `getBrowserSupabaseClient()` (Task 2), `createStaff()`/`deactivateStaff()` (Task 4), `useSelectedOrg()` (Task 6).
- Produces: `<StaffList staff={{ id, fullName, email, status, orgTier }[]} onDeactivated />`, `<CreateStaffForm organizationId accessToken onCreated />` (shows the returned `temporaryPassword` once), `<DeactivateStaffButton targetStaffId accessToken onDeactivated />`.

- [ ] **Step 1: Write the failing test for `StaffList`**

Create `components/StaffList.test.tsx`:

```typescript
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { StaffList } from "./StaffList";

describe("StaffList", () => {
  it("renders one row per staff member with a deactivate control for active staff", () => {
    render(
      <StaffList
        staff={[
          { id: "s1", fullName: "Admin Person", email: "admin@example.com", status: "active", orgTier: "admin" },
          { id: "s2", fullName: "Regular Person", email: "regular@example.com", status: "deactivated", orgTier: null },
        ]}
        accessToken="session-token"
        onDeactivated={vi.fn()}
      />,
    );

    expect(screen.getByText("Admin Person")).toBeInTheDocument();
    expect(screen.getByText("Regular Person")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Deactivate" })).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- components/StaffList.test.tsx`
Expected: FAIL — component does not exist.

- [ ] **Step 3: Write `DeactivateStaffButton` first (StaffList depends on it)**

Create `components/DeactivateStaffButton.test.tsx`:

```typescript
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DeactivateStaffButton } from "./DeactivateStaffButton";
import * as platformFunctions from "@/lib/platformFunctions";

vi.mock("@/lib/platformFunctions");

describe("DeactivateStaffButton", () => {
  beforeEach(() => {
    vi.mocked(platformFunctions.deactivateStaff).mockReset();
  });

  it("calls deactivateStaff with the target id and then onDeactivated", async () => {
    vi.mocked(platformFunctions.deactivateStaff).mockResolvedValue({ staffId: "s1" });
    const onDeactivated = vi.fn();
    const user = userEvent.setup();

    render(<DeactivateStaffButton targetStaffId="s1" accessToken="session-token" onDeactivated={onDeactivated} />);
    await user.click(screen.getByRole("button", { name: "Deactivate" }));

    await waitFor(() => {
      expect(platformFunctions.deactivateStaff).toHaveBeenCalledWith({ targetStaffId: "s1" }, "session-token");
      expect(onDeactivated).toHaveBeenCalled();
    });
  });

  it("shows the server's error message on failure", async () => {
    vi.mocked(platformFunctions.deactivateStaff).mockRejectedValue(new Error("forbidden"));
    const user = userEvent.setup();

    render(<DeactivateStaffButton targetStaffId="s1" accessToken="session-token" onDeactivated={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Deactivate" }));

    expect(await screen.findByText("forbidden")).toBeInTheDocument();
  });
});
```

Create `components/DeactivateStaffButton.tsx`:

```tsx
"use client";

import { useState } from "react";
import { deactivateStaff } from "@/lib/platformFunctions";

export function DeactivateStaffButton({
  targetStaffId,
  accessToken,
  onDeactivated,
}: {
  targetStaffId: string;
  accessToken: string;
  onDeactivated: () => void;
}) {
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);
    try {
      await deactivateStaff({ targetStaffId }, accessToken);
      onDeactivated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "unknown_error");
    }
  }

  return (
    <div>
      <button type="button" onClick={handleClick} className="rounded border border-red-300 px-3 py-1 text-sm text-red-700">
        Deactivate
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
```

Run: `npm test -- components/DeactivateStaffButton.test.tsx`
Expected: PASS on both tests, after implementing.

- [ ] **Step 4: Write `StaffList`**

Create `components/StaffList.tsx`:

```tsx
import { DeactivateStaffButton } from "./DeactivateStaffButton";

export interface StaffSummary {
  id: string;
  fullName: string;
  email: string;
  status: "active" | "deactivated";
  orgTier: string | null;
}

export function StaffList({
  staff,
  accessToken,
  onDeactivated,
}: {
  staff: StaffSummary[];
  accessToken: string;
  onDeactivated: () => void;
}) {
  return (
    <ul className="divide-y divide-gray-200">
      {staff.map((member) => (
        <li key={member.id} className="flex items-center justify-between py-3">
          <div>
            <p className="font-medium">{member.fullName}</p>
            <p className="text-sm text-gray-500">{member.email} {member.orgTier ? `· ${member.orgTier}` : ""}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">{member.status}</span>
            {member.status === "active" && (
              <DeactivateStaffButton targetStaffId={member.id} accessToken={accessToken} onDeactivated={onDeactivated} />
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- components/StaffList.test.tsx components/DeactivateStaffButton.test.tsx`
Expected: PASS on all 3 tests.

- [ ] **Step 6: Write the failing test for `CreateStaffForm`**

Create `components/CreateStaffForm.test.tsx`:

```typescript
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CreateStaffForm } from "./CreateStaffForm";
import * as platformFunctions from "@/lib/platformFunctions";

vi.mock("@/lib/platformFunctions");

describe("CreateStaffForm", () => {
  beforeEach(() => {
    vi.mocked(platformFunctions.createStaff).mockReset();
  });

  it("submits the form and shows the temporary password once, on success", async () => {
    vi.mocked(platformFunctions.createStaff).mockResolvedValue({ staffId: "s1", temporaryPassword: "temp-abc-123" });
    const onCreated = vi.fn();
    const user = userEvent.setup();

    render(<CreateStaffForm organizationId="org-1" accessToken="session-token" onCreated={onCreated} />);

    await user.type(screen.getByLabelText("Full name"), "New Staff");
    await user.type(screen.getByLabelText("Email"), "new-staff@example.com");
    await user.click(screen.getByRole("button", { name: "Create staff" }));

    expect(await screen.findByText("temp-abc-123")).toBeInTheDocument();
    expect(platformFunctions.createStaff).toHaveBeenCalledWith(
      { fullName: "New Staff", email: "new-staff@example.com", organizationId: "org-1" },
      "session-token",
    );
    expect(onCreated).toHaveBeenCalled();
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `npm test -- components/CreateStaffForm.test.tsx`
Expected: FAIL — component does not exist.

- [ ] **Step 8: Write `CreateStaffForm`**

Create `components/CreateStaffForm.tsx`:

```tsx
"use client";

import { useState } from "react";
import { createStaff } from "@/lib/platformFunctions";

export function CreateStaffForm({
  organizationId,
  accessToken,
  onCreated,
}: {
  organizationId: string;
  accessToken: string;
  onCreated: () => void;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await createStaff({ fullName, email, organizationId }, accessToken);
      setTemporaryPassword(result.temporaryPassword);
      setFullName("");
      setEmail("");
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "unknown_error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-3">
      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        <div>
          <label htmlFor="staffFullName" className="block text-sm">Full name</label>
          <input id="staffFullName" className="mt-1 rounded border px-3 py-2" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div>
          <label htmlFor="staffEmail" className="block text-sm">Email</label>
          <input id="staffEmail" type="email" className="mt-1 rounded border px-3 py-2" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <button type="submit" disabled={submitting} className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-50">
          Create staff
        </button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {temporaryPassword && (
        <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">
          Temporary password (shown once, share it securely — it cannot be retrieved again): <code>{temporaryPassword}</code>
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 9: Run test to verify it passes**

Run: `npm test -- components/CreateStaffForm.test.tsx`
Expected: PASS.

- [ ] **Step 10: Write the staff page**

Create `app/staff/page.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { useSelectedOrg } from "@/components/shell/AppShell";
import { StaffList, type StaffSummary } from "@/components/StaffList";
import { CreateStaffForm } from "@/components/CreateStaffForm";

export default function StaffPage() {
  const organizationId = useSelectedOrg();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [staff, setStaff] = useState<StaffSummary[]>([]);

  const load = useCallback(async () => {
    if (!organizationId) return;
    const supabase = getBrowserSupabaseClient();
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) return;
    setAccessToken(sessionData.session.access_token);

    const { data: orgTierRows } = await supabase
      .from("staff_org_roles")
      .select("staff_id, org_tier")
      .eq("organization_id", organizationId);
    const { data: moduleRoleRows } = await supabase
      .from("staff_module_roles")
      .select("staff_id")
      .eq("organization_id", organizationId);

    const tierByStaffId = new Map((orgTierRows ?? []).map((r) => [r.staff_id, r.org_tier as string]));
    const staffIds = new Set<string>([
      ...(orgTierRows ?? []).map((r) => r.staff_id),
      ...(moduleRoleRows ?? []).map((r) => r.staff_id),
    ]);
    if (staffIds.size === 0) {
      setStaff([]);
      return;
    }

    const { data: staffRows } = await supabase
      .from("staff")
      .select("id, full_name, email, status")
      .in("id", Array.from(staffIds));

    setStaff(
      (staffRows ?? []).map((row) => ({
        id: row.id,
        fullName: row.full_name,
        email: row.email,
        status: row.status,
        orgTier: tierByStaffId.get(row.id) ?? null,
      })),
    );
  }, [organizationId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!organizationId) {
    return <p>Select an organization to manage its staff.</p>;
  }

  if (!accessToken) {
    return <p>Loading…</p>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="mb-4 text-xl font-semibold">Staff</h1>
        <StaffList staff={staff} accessToken={accessToken} onDeactivated={load} />
      </div>
      <div>
        <h2 className="mb-2 text-lg font-medium">Create staff</h2>
        <CreateStaffForm organizationId={organizationId} accessToken={accessToken} onCreated={load} />
      </div>
    </div>
  );
}
```

The staff list is the union of `staff_org_roles` and `staff_module_roles` rows for the selected org, matching `AppShell`'s own affiliation logic — a regular staff member who only holds a module grant (no `org_tier` row) must still show up here to be manageable, the same requirement Finding 1's fix in `platform-backend`'s `deactivateStaff()` depends on.

- [ ] **Step 11: Commit**

```bash
git add components/StaffList.tsx components/StaffList.test.tsx components/CreateStaffForm.tsx components/CreateStaffForm.test.tsx components/DeactivateStaffButton.tsx components/DeactivateStaffButton.test.tsx app/staff/
git commit -m "feat: add staff management page with creation and deactivation"
```

---

### Task 12: Roles page (`org_admin`/`org_super_admin`)

**Files:**
- Create: `components/RolesList.tsx`
- Create: `components/RolesList.test.tsx`
- Create: `components/CreateCustomRoleForm.tsx`
- Create: `components/CreateCustomRoleForm.test.tsx`
- Create: `components/AssignStaffModuleRoleForm.tsx`
- Create: `components/AssignStaffModuleRoleForm.test.tsx`
- Create: `app/roles/page.tsx`

**Interfaces:**
- Consumes: `getBrowserSupabaseClient()` (Task 2), `createCustomRole()`/`assignStaffModuleRole()` (Task 4), `useSelectedOrg()` (Task 6).
- Produces: `<RolesList roles={{ id, name, isSystem, moduleKey }[]} />`, `<CreateCustomRoleForm organizationId modules={{ id, key }[]} permissionsByModuleId={Record<string, { id, resource, action }[]>} accessToken onCreated />`, `<AssignStaffModuleRoleForm organizationId staffOptions={{ id, fullName }[]} moduleOptions={{ id, key }[]} roleOptionsByModuleId={Record<string, { id, name }[]>} accessToken onAssigned />`.

- [ ] **Step 1: Write the failing test for `RolesList`**

Create `components/RolesList.test.tsx`:

```typescript
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { RolesList } from "./RolesList";

describe("RolesList", () => {
  it("distinguishes system roles from custom roles", () => {
    render(
      <RolesList
        roles={[
          { id: "r1", name: "Viewer", isSystem: true, moduleKey: "vms" },
          { id: "r2", name: "Hours Verifier", isSystem: false, moduleKey: "vms" },
        ]}
      />,
    );
    expect(screen.getByText("Viewer")).toBeInTheDocument();
    expect(screen.getByText("System")).toBeInTheDocument();
    expect(screen.getByText("Hours Verifier")).toBeInTheDocument();
    expect(screen.getByText("Custom")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- components/RolesList.test.tsx`
Expected: FAIL — component does not exist.

- [ ] **Step 3: Write `RolesList`**

Create `components/RolesList.tsx`:

```tsx
export interface RoleSummary {
  id: string;
  name: string;
  isSystem: boolean;
  moduleKey: string;
}

export function RolesList({ roles }: { roles: RoleSummary[] }) {
  return (
    <ul className="divide-y divide-gray-200">
      {roles.map((role) => (
        <li key={role.id} className="flex items-center justify-between py-2">
          <span>{role.name} <span className="text-sm text-gray-500">({role.moduleKey})</span></span>
          <span className="text-sm text-gray-600">{role.isSystem ? "System" : "Custom"}</span>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- components/RolesList.test.tsx`
Expected: PASS.

- [ ] **Step 5: Write the failing test for `CreateCustomRoleForm`**

Create `components/CreateCustomRoleForm.test.tsx`:

```typescript
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CreateCustomRoleForm } from "./CreateCustomRoleForm";
import * as platformFunctions from "@/lib/platformFunctions";

vi.mock("@/lib/platformFunctions");

describe("CreateCustomRoleForm", () => {
  beforeEach(() => {
    vi.mocked(platformFunctions.createCustomRole).mockReset();
  });

  it("submits the selected module, name, and checked permissions", async () => {
    vi.mocked(platformFunctions.createCustomRole).mockResolvedValue({ roleId: "role-1" });
    const onCreated = vi.fn();
    const user = userEvent.setup();

    render(
      <CreateCustomRoleForm
        organizationId="org-1"
        modules={[{ id: "mod-vms", key: "vms" }]}
        permissionsByModuleId={{ "mod-vms": [{ id: "perm-1", resource: "hours", action: "update" }] }}
        accessToken="session-token"
        onCreated={onCreated}
      />,
    );

    await user.selectOptions(screen.getByLabelText("Module"), "mod-vms");
    await user.type(screen.getByLabelText("Role name"), "Hours Verifier");
    await user.click(screen.getByLabelText("hours:update"));
    await user.click(screen.getByRole("button", { name: "Create role" }));

    await waitFor(() => {
      expect(platformFunctions.createCustomRole).toHaveBeenCalledWith(
        { organizationId: "org-1", moduleId: "mod-vms", name: "Hours Verifier", permissionIds: ["perm-1"] },
        "session-token",
      );
      expect(onCreated).toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npm test -- components/CreateCustomRoleForm.test.tsx`
Expected: FAIL — component does not exist.

- [ ] **Step 7: Write `CreateCustomRoleForm`**

Create `components/CreateCustomRoleForm.tsx`:

```tsx
"use client";

import { useState } from "react";
import { createCustomRole } from "@/lib/platformFunctions";

export interface ModuleOption {
  id: string;
  key: string;
}
export interface PermissionOption {
  id: string;
  resource: string;
  action: string;
}

export function CreateCustomRoleForm({
  organizationId,
  modules,
  permissionsByModuleId,
  accessToken,
  onCreated,
}: {
  organizationId: string;
  modules: ModuleOption[];
  permissionsByModuleId: Record<string, PermissionOption[]>;
  accessToken: string;
  onCreated: () => void;
}) {
  const [moduleId, setModuleId] = useState(modules[0]?.id ?? "");
  const [name, setName] = useState("");
  const [checkedPermissionIds, setCheckedPermissionIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const availablePermissions = permissionsByModuleId[moduleId] ?? [];

  function togglePermission(permissionId: string) {
    setCheckedPermissionIds((prev) => {
      const next = new Set(prev);
      if (next.has(permissionId)) next.delete(permissionId);
      else next.add(permissionId);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await createCustomRole(
        { organizationId, moduleId, name, permissionIds: Array.from(checkedPermissionIds) },
        accessToken,
      );
      setName("");
      setCheckedPermissionIds(new Set());
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "unknown_error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label htmlFor="roleModule" className="block text-sm">Module</label>
        <select
          id="roleModule"
          className="mt-1 rounded border px-3 py-2"
          value={moduleId}
          onChange={(e) => { setModuleId(e.target.value); setCheckedPermissionIds(new Set()); }}
        >
          {modules.map((m) => (
            <option key={m.id} value={m.id}>{m.key}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="roleName" className="block text-sm">Role name</label>
        <input id="roleName" className="mt-1 w-full rounded border px-3 py-2" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <fieldset className="space-y-1">
        <legend className="text-sm">Permissions</legend>
        {availablePermissions.map((perm) => {
          const label = `${perm.resource}:${perm.action}`;
          return (
            <label key={perm.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                aria-label={label}
                checked={checkedPermissionIds.has(perm.id)}
                onChange={() => togglePermission(perm.id)}
              />
              {label}
            </label>
          );
        })}
      </fieldset>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={submitting} className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-50">
        Create role
      </button>
    </form>
  );
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npm test -- components/CreateCustomRoleForm.test.tsx`
Expected: PASS.

- [ ] **Step 9: Write the failing test for `AssignStaffModuleRoleForm`**

Create `components/AssignStaffModuleRoleForm.test.tsx`:

```typescript
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AssignStaffModuleRoleForm } from "./AssignStaffModuleRoleForm";
import * as platformFunctions from "@/lib/platformFunctions";

vi.mock("@/lib/platformFunctions");

describe("AssignStaffModuleRoleForm", () => {
  beforeEach(() => {
    vi.mocked(platformFunctions.assignStaffModuleRole).mockReset();
  });

  it("submits the selected staff, module, and role", async () => {
    vi.mocked(platformFunctions.assignStaffModuleRole).mockResolvedValue({ staffId: "s2" });
    const onAssigned = vi.fn();
    const user = userEvent.setup();

    render(
      <AssignStaffModuleRoleForm
        organizationId="org-1"
        staffOptions={[{ id: "s2", fullName: "Target Staff" }]}
        moduleOptions={[{ id: "mod-vms", key: "vms" }]}
        roleOptionsByModuleId={{ "mod-vms": [{ id: "role-editor", name: "Editor" }] }}
        accessToken="session-token"
        onAssigned={onAssigned}
      />,
    );

    await user.selectOptions(screen.getByLabelText("Staff member"), "s2");
    await user.selectOptions(screen.getByLabelText("Module"), "mod-vms");
    await user.selectOptions(screen.getByLabelText("Role"), "role-editor");
    await user.click(screen.getByRole("button", { name: "Assign role" }));

    await waitFor(() => {
      expect(platformFunctions.assignStaffModuleRole).toHaveBeenCalledWith(
        { staffId: "s2", organizationId: "org-1", moduleId: "mod-vms", roleId: "role-editor" },
        "session-token",
      );
      expect(onAssigned).toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 10: Run test to verify it fails**

Run: `npm test -- components/AssignStaffModuleRoleForm.test.tsx`
Expected: FAIL — component does not exist.

- [ ] **Step 11: Write `AssignStaffModuleRoleForm`**

Create `components/AssignStaffModuleRoleForm.tsx`:

```tsx
"use client";

import { useState } from "react";
import { assignStaffModuleRole } from "@/lib/platformFunctions";

export interface StaffOption {
  id: string;
  fullName: string;
}
export interface ModuleOption {
  id: string;
  key: string;
}
export interface RoleOption {
  id: string;
  name: string;
}

export function AssignStaffModuleRoleForm({
  organizationId,
  staffOptions,
  moduleOptions,
  roleOptionsByModuleId,
  accessToken,
  onAssigned,
}: {
  organizationId: string;
  staffOptions: StaffOption[];
  moduleOptions: ModuleOption[];
  roleOptionsByModuleId: Record<string, RoleOption[]>;
  accessToken: string;
  onAssigned: () => void;
}) {
  const [staffId, setStaffId] = useState(staffOptions[0]?.id ?? "");
  const [moduleId, setModuleId] = useState(moduleOptions[0]?.id ?? "");
  const [roleId, setRoleId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const availableRoles = roleOptionsByModuleId[moduleId] ?? [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await assignStaffModuleRole({ staffId, organizationId, moduleId, roleId }, accessToken);
      onAssigned();
    } catch (err) {
      setError(err instanceof Error ? err.message : "unknown_error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2">
      <div>
        <label htmlFor="assignStaff" className="block text-sm">Staff member</label>
        <select id="assignStaff" className="mt-1 rounded border px-3 py-2" value={staffId} onChange={(e) => setStaffId(e.target.value)}>
          {staffOptions.map((s) => (
            <option key={s.id} value={s.id}>{s.fullName}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="assignModule" className="block text-sm">Module</label>
        <select
          id="assignModule"
          className="mt-1 rounded border px-3 py-2"
          value={moduleId}
          onChange={(e) => { setModuleId(e.target.value); setRoleId(""); }}
        >
          {moduleOptions.map((m) => (
            <option key={m.id} value={m.id}>{m.key}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="assignRole" className="block text-sm">Role</label>
        <select id="assignRole" className="mt-1 rounded border px-3 py-2" value={roleId} onChange={(e) => setRoleId(e.target.value)}>
          <option value="">Select a role</option>
          {availableRoles.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      </div>
      <button type="submit" disabled={submitting || !roleId} className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-50">
        Assign role
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
```

- [ ] **Step 12: Run test to verify it passes**

Run: `npm test -- components/AssignStaffModuleRoleForm.test.tsx`
Expected: PASS.

- [ ] **Step 13: Write the roles page**

Create `app/roles/page.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { useSelectedOrg } from "@/components/shell/AppShell";
import { RolesList, type RoleSummary } from "@/components/RolesList";
import { CreateCustomRoleForm, type ModuleOption, type PermissionOption } from "@/components/CreateCustomRoleForm";
import { AssignStaffModuleRoleForm, type StaffOption, type RoleOption } from "@/components/AssignStaffModuleRoleForm";

export default function RolesPage() {
  const organizationId = useSelectedOrg();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [roles, setRoles] = useState<RoleSummary[]>([]);
  const [modules, setModules] = useState<ModuleOption[]>([]);
  const [permissionsByModuleId, setPermissionsByModuleId] = useState<Record<string, PermissionOption[]>>({});
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [roleOptionsByModuleId, setRoleOptionsByModuleId] = useState<Record<string, RoleOption[]>>({});

  const load = useCallback(async () => {
    if (!organizationId) return;
    const supabase = getBrowserSupabaseClient();
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) return;
    setAccessToken(sessionData.session.access_token);

    const { data: orgModuleRows } = await supabase
      .from("org_modules")
      .select("module_id, modules(id, key)")
      .eq("organization_id", organizationId);
    const enabledModules = (orgModuleRows ?? []).map((r) => r.modules as unknown as ModuleOption);
    setModules(enabledModules);

    const { data: roleRows } = await supabase
      .from("roles")
      .select("id, name, is_system, module_id, modules(key)")
      .eq("organization_id", organizationId);
    setRoles(
      (roleRows ?? []).map((r) => ({
        id: r.id,
        name: r.name,
        isSystem: r.is_system,
        moduleKey: (r.modules as unknown as { key: string }).key,
      })),
    );

    const permsByModule: Record<string, PermissionOption[]> = {};
    const rolesByModule: Record<string, RoleOption[]> = {};
    for (const module of enabledModules) {
      const { data: perms } = await supabase.from("permissions").select("id, resource, action").eq("module_id", module.id);
      permsByModule[module.id] = perms ?? [];
      rolesByModule[module.id] = (roleRows ?? [])
        .filter((r) => r.module_id === module.id)
        .map((r) => ({ id: r.id, name: r.name }));
    }
    setPermissionsByModuleId(permsByModule);
    setRoleOptionsByModuleId(rolesByModule);

    const { data: orgTierRows } = await supabase.from("staff_org_roles").select("staff_id").eq("organization_id", organizationId);
    const { data: moduleRoleRows } = await supabase.from("staff_module_roles").select("staff_id").eq("organization_id", organizationId);
    const staffIds = new Set<string>([...(orgTierRows ?? []).map((r) => r.staff_id), ...(moduleRoleRows ?? []).map((r) => r.staff_id)]);
    if (staffIds.size > 0) {
      const { data: staffRows } = await supabase.from("staff").select("id, full_name").in("id", Array.from(staffIds));
      setStaffOptions((staffRows ?? []).map((s) => ({ id: s.id, fullName: s.full_name })));
    } else {
      setStaffOptions([]);
    }
  }, [organizationId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!organizationId) {
    return <p>Select an organization to manage its roles.</p>;
  }

  if (!accessToken) {
    return <p>Loading…</p>;
  }

  if (modules.length === 0) {
    return <p>No modules are enabled for this organization yet — enable one from Organizations first.</p>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="mb-4 text-xl font-semibold">Roles</h1>
        <RolesList roles={roles} />
      </div>
      <div>
        <h2 className="mb-2 text-lg font-medium">Create custom role</h2>
        <CreateCustomRoleForm
          organizationId={organizationId}
          modules={modules}
          permissionsByModuleId={permissionsByModuleId}
          accessToken={accessToken}
          onCreated={load}
        />
      </div>
      <div>
        <h2 className="mb-2 text-lg font-medium">Assign staff a module role</h2>
        {staffOptions.length === 0 ? (
          <p className="text-sm text-gray-600">No staff in this organization yet — create one on the Staff page first.</p>
        ) : (
          <AssignStaffModuleRoleForm
            organizationId={organizationId}
            staffOptions={staffOptions}
            moduleOptions={modules}
            roleOptionsByModuleId={roleOptionsByModuleId}
            accessToken={accessToken}
            onAssigned={load}
          />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 14: Commit**

```bash
git add components/RolesList.tsx components/RolesList.test.tsx components/CreateCustomRoleForm.tsx components/CreateCustomRoleForm.test.tsx components/AssignStaffModuleRoleForm.tsx components/AssignStaffModuleRoleForm.test.tsx app/roles/
git commit -m "feat: add roles page with custom role creation and staff module-role assignment"
```

---

## Post-plan checklist (not a task — verify before starting the VMS admin UI plan)

- [ ] `npm test` passes in full.
- [ ] `npm run build` succeeds with no type errors.
- [ ] Manually walk the golden path against a local `supabase` instance (already scripted by the platform-backend plan): sign up a `platform_owner` staff row directly in the DB (no self-serve signup exists) → log in → confirm the forced `/set-password` redirect → create an organization → enable the `vms` module for it → create a regular staff member for that org → confirm the shown temporary password logs them in and forces `/set-password` again → as an `org_admin`, create a custom role and assign it to that staff member → deactivate that staff member and confirm they can no longer do anything requiring `staff_has_permission()` server-side (the module backend, not this UI, is what actually enforces that).
- [ ] Confirm the empty states render correctly: a freshly created staff row with no `staff_org_roles`/`staff_module_roles` at all sees the "you don't have access to any organization yet" message; an org with zero `org_modules` rows sees "no modules are enabled."
- [ ] `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_FUNCTIONS_URL` are documented in `.env.local.example` and set in the Vercel project.
- [ ] Confirm `registry/modules.ts` is still `[]` and `app/modules/`, `lib/modules/`, `components/modules/` are still empty directories — this plan must not have grown VMS-specific code; that's the next plan's job.
- [ ] Resize the browser and confirm the shell nav and forms remain usable below 640px — not a stated hard requirement here (unlike `vms/frontend`'s public pages), but staff should not be blocked from managing things on a phone in a pinch.

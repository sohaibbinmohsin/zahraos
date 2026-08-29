# VMS Admin Portal Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Register `vms` as the shell's first real module and build its 5 admin screens (Dashboard, Volunteers, Opportunities, Applications, Hours), wired to the 7 new `vms/backend` read endpoints and the module's already-existing write endpoints.

**Architecture:** One `registry/modules.ts` entry (`vms` → `/modules/vms`), one top-level route redirecting to `/modules/vms/dashboard`, five sibling screens under a shared module layout with its own tab nav — mirroring how Staff/Roles/Organizations already sit as siblings under `AppShell`'s top nav, one level deeper. Every screen's data comes from a new `lib/vmsFunctions.ts` (mirrors `platformFunctions.ts`'s `callFunction()` pattern, but targets a new `NEXT_PUBLIC_VMS_FUNCTIONS_URL` and sends the staff JWT from `fetchStaffToken()`, not the platform session token).

**Tech Stack:** Next.js App Router, React, existing `getBrowserSupabaseClient()`/`fetchStaffToken()`/`decodeStaffTokenClaims()`, Vitest + React Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-30-vms-admin-portal-design.md` §2, §6.
**Companion plan (must land first):** `youth-republic/docs/superpowers/plans/2026-08-30-vms-admin-backend-reads.md` — every screen in this plan calls a function that plan builds. Do not start Task 3 onward until that plan's Tasks 1–7 are deployed to the hosted `vms/backend` project (`supabase functions deploy <name> --project-ref kbotpktgojpvkotigrjh --no-verify-jwt --import-map ./supabase/deno.jsonc`, run from `youth-republic/backend`).

## Global Constraints

- Every screen reads `organizationId` via `useSelectedOrg()` from `@/components/shell/AppShell` — never introduce a second org-selection mechanism.
- Every screen gets the platform access token via `getBrowserSupabaseClient().auth.getSession()`, then the staff JWT via `fetchStaffToken(accessToken)`, before calling any `vmsFunctions` wrapper — same two-step every existing claims-dependent page already does.
- No screen ever renders `activity_hours.admin_notes` except the Volunteer detail and Hours screens (the only two `vms/backend` endpoints that return it) — per spec §5, this is enforced by which endpoint returns the field, not by a UI-level check, but don't add a stray extra render of it if you see it in a response shape.
- Full local test command after every task: `npm test` (must show 0 failed, run from the repo root). Full build check before the final task: `npm run build`.
- `git commit`, do not push — this repo's established workflow gives push commands to the user at the end, not mid-plan.

---

### Task 1: `NEXT_PUBLIC_VMS_FUNCTIONS_URL` + `lib/vmsFunctions.ts`

**Files:**
- Modify: `.env`, `.env.example` (append the new var; do not touch any existing line)
- Create: `lib/vmsFunctions.ts`
- Create: `lib/vmsFunctions.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks (this is the first task).
- Produces: `listVolunteers`, `getVolunteerDetail`, `listOpportunities`, `listParticipationForOpportunity`, `listApplications`, `listActivityHours`, `getKpiSummary`, `createOpportunity`, `updateOpportunity`, `decideApplication`, `verifyHours`, `bulkAssignHours`, `exportVmsCsv` — all exported from `lib/vmsFunctions.ts`, each `(payload, staffToken: string) => Promise<...>` (JSON ones) or `(payload, staffToken: string) => Promise<string>` (the CSV one). Every later task imports from this file, never calls `fetch` directly.

- [ ] **Step 1: Add the env var**

Append to `.env` (real value, gitignored) and `.env.example` (placeholder):

```
# .env
NEXT_PUBLIC_VMS_FUNCTIONS_URL=https://kbotpktgojpvkotigrjh.supabase.co/functions/v1
```

```
# .env.example
NEXT_PUBLIC_VMS_FUNCTIONS_URL=
```

- [ ] **Step 2: Write the failing test**

```typescript
// lib/vmsFunctions.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  listVolunteers,
  getVolunteerDetail,
  listOpportunities,
  listParticipationForOpportunity,
  listApplications,
  listActivityHours,
  getKpiSummary,
  createOpportunity,
  updateOpportunity,
  decideApplication,
  verifyHours,
  bulkAssignHours,
  exportVmsCsv,
} from "./vmsFunctions";

const VMS_FUNCTIONS_URL = "http://localhost:54322/functions/v1";
const STAFF_TOKEN = "staff-jwt-token";

beforeEach(() => {
  process.env.NEXT_PUBLIC_VMS_FUNCTIONS_URL = VMS_FUNCTIONS_URL;
  vi.stubGlobal("fetch", vi.fn());
});

function mockOk(body: unknown) {
  vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => body } as Response);
}

function mockOkText(body: string) {
  vi.mocked(fetch).mockResolvedValue({ ok: true, text: async () => body } as Response);
}

describe("vmsFunctions", () => {
  it("listVolunteers posts to list-volunteers with the staff token", async () => {
    mockOk({ volunteers: [], total: 0 });
    const result = await listVolunteers({ organizationId: "org-1" }, STAFF_TOKEN);
    expect(fetch).toHaveBeenCalledWith(
      `${VMS_FUNCTIONS_URL}/list-volunteers`,
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: `Bearer ${STAFF_TOKEN}` }),
        body: JSON.stringify({ organizationId: "org-1" }),
      }),
    );
    expect(result).toEqual({ volunteers: [], total: 0 });
  });

  it("getVolunteerDetail posts to get-volunteer-detail", async () => {
    mockOk({ id: "vol-1" });
    await getVolunteerDetail({ organizationId: "org-1", volunteerId: "vol-1" }, STAFF_TOKEN);
    expect(fetch).toHaveBeenCalledWith(`${VMS_FUNCTIONS_URL}/get-volunteer-detail`, expect.anything());
  });

  it("listOpportunities posts to list-opportunities", async () => {
    mockOk({ opportunities: [], total: 0 });
    await listOpportunities({ organizationId: "org-1" }, STAFF_TOKEN);
    expect(fetch).toHaveBeenCalledWith(`${VMS_FUNCTIONS_URL}/list-opportunities`, expect.anything());
  });

  it("listParticipationForOpportunity posts to list-participation-for-opportunity", async () => {
    mockOk({ applicants: [], participants: [] });
    await listParticipationForOpportunity({ organizationId: "org-1", opportunityId: "opp-1" }, STAFF_TOKEN);
    expect(fetch).toHaveBeenCalledWith(`${VMS_FUNCTIONS_URL}/list-participation-for-opportunity`, expect.anything());
  });

  it("listApplications posts to list-applications", async () => {
    mockOk({ applications: [], total: 0 });
    await listApplications({ organizationId: "org-1" }, STAFF_TOKEN);
    expect(fetch).toHaveBeenCalledWith(`${VMS_FUNCTIONS_URL}/list-applications`, expect.anything());
  });

  it("listActivityHours posts to list-activity-hours", async () => {
    mockOk({ activity: [], total: 0 });
    await listActivityHours({ organizationId: "org-1" }, STAFF_TOKEN);
    expect(fetch).toHaveBeenCalledWith(`${VMS_FUNCTIONS_URL}/list-activity-hours`, expect.anything());
  });

  it("getKpiSummary posts to get-kpi-summary", async () => {
    mockOk({ totalRegistered: 0 });
    await getKpiSummary({ organizationId: "org-1" }, STAFF_TOKEN);
    expect(fetch).toHaveBeenCalledWith(`${VMS_FUNCTIONS_URL}/get-kpi-summary`, expect.anything());
  });

  it("createOpportunity posts to create-opportunity", async () => {
    mockOk({ opportunityId: "opp-1" });
    await createOpportunity({ organizationId: "org-1", name: "Test", type: "environment" }, STAFF_TOKEN);
    expect(fetch).toHaveBeenCalledWith(`${VMS_FUNCTIONS_URL}/create-opportunity`, expect.anything());
  });

  it("updateOpportunity posts to update-opportunity", async () => {
    mockOk({ opportunityId: "opp-1" });
    await updateOpportunity({ opportunityId: "opp-1", organizationId: "org-1", name: "Renamed" }, STAFF_TOKEN);
    expect(fetch).toHaveBeenCalledWith(`${VMS_FUNCTIONS_URL}/update-opportunity`, expect.anything());
  });

  it("decideApplication posts to decide-application (no organizationId — the handler derives it from the application row itself)", async () => {
    mockOk({ applicationId: "app-1", participationId: null });
    await decideApplication({ applicationId: "app-1", decision: "selected" }, STAFF_TOKEN);
    expect(fetch).toHaveBeenCalledWith(
      `${VMS_FUNCTIONS_URL}/decide-application`,
      expect.objectContaining({ body: JSON.stringify({ applicationId: "app-1", decision: "selected" }) }),
    );
  });

  it("verifyHours posts to verify-hours with a required decision field", async () => {
    mockOk({ activityHoursId: "ah-1" });
    await verifyHours({ activityHoursId: "ah-1", decision: "verified", hoursVerified: 5 }, STAFF_TOKEN);
    expect(fetch).toHaveBeenCalledWith(
      `${VMS_FUNCTIONS_URL}/verify-hours`,
      expect.objectContaining({ body: JSON.stringify({ activityHoursId: "ah-1", decision: "verified", hoursVerified: 5 }) }),
    );
  });

  it("bulkAssignHours posts to bulk-assign-hours with a specific list of participation ids", async () => {
    mockOk({ createdCount: 3 });
    await bulkAssignHours(
      { organizationId: "org-1", opportunityId: "opp-1", activityDate: "2026-02-01", hoursSubmitted: 3, participationIds: ["p-1", "p-2", "p-3"] },
      STAFF_TOKEN,
    );
    expect(fetch).toHaveBeenCalledWith(`${VMS_FUNCTIONS_URL}/bulk-assign-hours`, expect.anything());
  });

  it("exportVmsCsv posts to export-csv and returns the raw CSV text, not parsed JSON", async () => {
    mockOkText("name,type\nTest Opp,environment\n");
    const csv = await exportVmsCsv({ organizationId: "org-1", entity: "opportunities" }, STAFF_TOKEN);
    expect(fetch).toHaveBeenCalledWith(`${VMS_FUNCTIONS_URL}/export-csv`, expect.anything());
    expect(csv).toBe("name,type\nTest Opp,environment\n");
  });

  it("throws the server's error message when a JSON call fails", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, json: async () => ({ error: "forbidden" }) } as Response);
    await expect(listVolunteers({ organizationId: "org-1" }, STAFF_TOKEN)).rejects.toThrow("forbidden");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- lib/vmsFunctions.test.ts`
Expected: FAIL — `./vmsFunctions` module not found.

- [ ] **Step 4: Write `lib/vmsFunctions.ts`**

```typescript
// lib/vmsFunctions.ts
async function callVmsFunction<TResponse>(name: string, body: unknown, staffToken: string): Promise<TResponse> {
  const baseUrl = process.env.NEXT_PUBLIC_VMS_FUNCTIONS_URL;
  if (!baseUrl) {
    throw new Error("NEXT_PUBLIC_VMS_FUNCTIONS_URL is not set");
  }

  const response = await fetch(`${baseUrl}/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${staffToken}`,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "request_failed");
  }
  return data as TResponse;
}

async function callVmsFunctionForCsv(name: string, body: unknown, staffToken: string): Promise<string> {
  const baseUrl = process.env.NEXT_PUBLIC_VMS_FUNCTIONS_URL;
  if (!baseUrl) {
    throw new Error("NEXT_PUBLIC_VMS_FUNCTIONS_URL is not set");
  }

  const response = await fetch(`${baseUrl}/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${staffToken}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error ?? "request_failed");
  }
  return response.text();
}

export interface VolunteerSummary {
  id: string;
  volunteerCode: string;
  fullName: string;
  email: string;
  phone: string;
  city: string;
  province: string;
  institution: string;
  status: string;
}
export interface ListVolunteersPayload {
  organizationId: string;
  search?: string;
  city?: string;
  province?: string;
  institution?: string;
  status?: string;
  limit?: number;
  offset?: number;
}
export interface ListVolunteersResponse {
  volunteers: VolunteerSummary[];
  total: number;
}
export function listVolunteers(payload: ListVolunteersPayload, staffToken: string) {
  return callVmsFunction<ListVolunteersResponse>("list-volunteers", payload, staffToken);
}

export interface VolunteerDetail extends VolunteerSummary {
  applications: Array<{ id: string; status: string; opportunityName: string; appliedAt: string }>;
  participations: Array<{ id: string; status: string; opportunityName: string }>;
  activity: Array<{
    id: string; role: string | null; activityDate: string; hoursSubmitted: number;
    hoursVerified: number | null; verificationStatus: string; adminNotes: string | null; opportunityName: string;
  }>;
}
export function getVolunteerDetail(payload: { organizationId: string; volunteerId: string }, staffToken: string) {
  return callVmsFunction<VolunteerDetail>("get-volunteer-detail", payload, staffToken);
}

export interface OpportunitySummary {
  id: string;
  name: string;
  type: string;
  computedStatus: string;
  capacity: number | null;
}
export interface ListOpportunitiesPayload {
  organizationId: string;
  type?: string;
  status?: string;
  limit?: number;
  offset?: number;
}
export interface ListOpportunitiesResponse {
  opportunities: OpportunitySummary[];
  total: number;
}
export function listOpportunities(payload: ListOpportunitiesPayload, staffToken: string) {
  return callVmsFunction<ListOpportunitiesResponse>("list-opportunities", payload, staffToken);
}

export interface ParticipationForOpportunityResponse {
  applicants: Array<{ applicationId: string; volunteerId: string; volunteerName: string; status: string; appliedAt: string }>;
  participants: Array<{ participationId: string; volunteerId: string; volunteerName: string; status: string }>;
}
export function listParticipationForOpportunity(
  payload: { organizationId: string; opportunityId: string },
  staffToken: string,
) {
  return callVmsFunction<ParticipationForOpportunityResponse>("list-participation-for-opportunity", payload, staffToken);
}

export interface ApplicationListRow {
  id: string;
  volunteerId: string;
  volunteerName: string;
  opportunityId: string;
  opportunityName: string;
  status: string;
  appliedAt: string;
}
export interface ListApplicationsPayload {
  organizationId: string;
  opportunityId?: string;
  status?: string;
  limit?: number;
  offset?: number;
}
export interface ListApplicationsResponse {
  applications: ApplicationListRow[];
  total: number;
}
export function listApplications(payload: ListApplicationsPayload, staffToken: string) {
  return callVmsFunction<ListApplicationsResponse>("list-applications", payload, staffToken);
}

export interface ActivityListRow {
  id: string;
  volunteerName: string;
  opportunityName: string;
  activityType: string;
  role: string | null;
  activityDate: string;
  hoursSubmitted: number;
  hoursVerified: number | null;
  verificationStatus: string;
  adminNotes: string | null;
}
export interface ListActivityHoursPayload {
  organizationId: string;
  activityType?: string;
  participationStatus?: string;
  limit?: number;
  offset?: number;
}
export interface ListActivityHoursResponse {
  activity: ActivityListRow[];
  total: number;
}
export function listActivityHours(payload: ListActivityHoursPayload, staffToken: string) {
  return callVmsFunction<ListActivityHoursResponse>("list-activity-hours", payload, staffToken);
}

export interface KpiSummary {
  totalRegistered: number;
  active: number;
  completedParticipations: number;
  applicationsReceived: number;
  selected: number;
  totalVerifiedHours: number;
  byCity: Record<string, number>;
  byProvince: Record<string, number>;
  byInstitution: Record<string, number>;
  participationByOpportunity: Record<string, number>;
  participationByActivityType: Record<string, number>;
}
export function getKpiSummary(payload: { organizationId: string }, staffToken: string) {
  return callVmsFunction<KpiSummary>("get-kpi-summary", payload, staffToken);
}

export interface CreateOpportunityPayload {
  organizationId: string;
  name: string;
  type: string;
  description?: string;
  location?: string;
  isOnline?: boolean;
  applicationOpenAt?: string;
  applicationDeadline?: string;
  activityStartAt?: string;
  activityEndAt?: string;
  eligibilityCriteria?: string;
  capacity?: number;
}
export function createOpportunity(payload: CreateOpportunityPayload, staffToken: string) {
  return callVmsFunction<{ opportunityId: string }>("create-opportunity", payload, staffToken);
}

export interface UpdateOpportunityPayload {
  opportunityId: string;
  organizationId: string;
  name?: string;
  description?: string;
  location?: string;
  isOnline?: boolean;
  applicationOpenAt?: string;
  applicationDeadline?: string;
  activityStartAt?: string;
  activityEndAt?: string;
  eligibilityCriteria?: string;
  capacity?: number;
  statusOverride?: string;
  deactivatedAt?: string | null;
}
export function updateOpportunity(payload: UpdateOpportunityPayload, staffToken: string) {
  return callVmsFunction<{ opportunityId: string }>("update-opportunity", payload, staffToken);
}

// No organizationId here — decideApplication derives it from the
// application row itself server-side (the cross-tenant-trust fix from the
// earlier review), so there's nothing for the client to pass or trust.
export interface DecideApplicationPayload {
  applicationId: string;
  decision: "selected" | "waitlisted" | "rejected" | "under_review";
}
export interface DecideApplicationResponse {
  applicationId: string;
  participationId: string | null;
}
export function decideApplication(payload: DecideApplicationPayload, staffToken: string) {
  return callVmsFunction<DecideApplicationResponse>("decide-application", payload, staffToken);
}

// decision is required — the handler has no separate "verify" vs "reject"
// endpoint, one call does both depending on this field. No organizationId
// (same reason as decideApplication) and no adminNotes param exists on this
// handler today.
export interface VerifyHoursPayload {
  activityHoursId: string;
  decision: "verified" | "rejected";
  hoursVerified?: number;
  rejectionReason?: string;
}
export function verifyHours(payload: VerifyHoursPayload, staffToken: string) {
  return callVmsFunction<{ activityHoursId: string }>("verify-hours", payload, staffToken);
}

// Assigns hours to a specific set of participations, not "everyone in this
// opportunity" — participationIds is how the caller picks who's included.
export interface BulkAssignHoursPayload {
  organizationId: string;
  opportunityId: string;
  activityDate: string;
  hoursSubmitted: number;
  participationIds: string[];
}
export function bulkAssignHours(payload: BulkAssignHoursPayload, staffToken: string) {
  return callVmsFunction<{ createdCount: number }>("bulk-assign-hours", payload, staffToken);
}

export function exportVmsCsv(payload: { organizationId: string; entity: "volunteers" | "applications" | "opportunities" | "activity_hours" }, staffToken: string) {
  return callVmsFunctionForCsv("export-csv", payload, staffToken);
}
```

Before finalizing, read `backend/supabase/functions/decide-application/handler.ts`, `verify-hours/handler.ts`, and `bulk-assign-hours/handler.ts` in the `youth-republic` repo to confirm their exact existing input field names and return shapes — the ones above are this plan author's best reconstruction from the earlier session's own work on those files, not freshly re-verified against the live source at plan-writing time. Correct any mismatch here before moving to Step 5; every later task's forms depend on getting this file's types right once.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- lib/vmsFunctions.test.ts`
Expected: `14 passed`.

- [ ] **Step 6: Commit**

```bash
git add .env.example lib/vmsFunctions.ts lib/vmsFunctions.test.ts
git commit -m "feat: add lib/vmsFunctions.ts and NEXT_PUBLIC_VMS_FUNCTIONS_URL"
```

(`.env` is gitignored — it will not appear in `git status`; confirm it's not staged by mistake before committing.)

---

### Task 2: Module registration, route, and tab layout

**Files:**
- Modify: `registry/modules.ts`
- Create: `app/modules/vms/layout.tsx`
- Create: `app/modules/vms/layout.test.tsx`
- Create: `app/modules/vms/page.tsx` (redirect only)

**Interfaces:**
- Consumes: `useSelectedOrg` from `@/components/shell/AppShell`; `usePathname` from `next/navigation`.
- Produces: the `ModuleRegistryEntry` for `vms`; a `VmsModuleLayout` wrapping the 5 screens with tab nav — later tasks each add one screen under `app/modules/vms/<screen>/page.tsx` and never touch this layout again.

- [ ] **Step 1: Write the failing test**

```typescript
// app/modules/vms/layout.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import VmsModuleLayout from "./layout";

vi.mock("next/navigation", () => ({
  usePathname: () => "/modules/vms/dashboard",
}));

describe("VmsModuleLayout", () => {
  it("renders a tab for each of the 5 admin screens plus the page content", () => {
    render(
      <VmsModuleLayout>
        <p>screen content</p>
      </VmsModuleLayout>,
    );

    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Volunteers" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Opportunities" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Applications" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Hours" })).toBeInTheDocument();
    expect(screen.getByText("screen content")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- app/modules/vms/layout.test.tsx`
Expected: FAIL — `./layout` module not found.

- [ ] **Step 3: Register the module**

```typescript
// registry/modules.ts
export interface ModuleRegistryEntry {
  key: string;
  navLabel: string;
  route: string;
  icon: string;
}

export const MODULE_REGISTRY: ModuleRegistryEntry[] = [
  { key: "vms", navLabel: "VMS", route: "/modules/vms", icon: "🤝" },
];
```

- [ ] **Step 4: Write the module layout**

```tsx
// app/modules/vms/layout.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/modules/vms/dashboard", label: "Dashboard" },
  { href: "/modules/vms/volunteers", label: "Volunteers" },
  { href: "/modules/vms/opportunities", label: "Opportunities" },
  { href: "/modules/vms/applications", label: "Applications" },
  { href: "/modules/vms/hours", label: "Hours" },
];

export default function VmsModuleLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div>
      <nav className="mb-6 flex gap-4 border-b border-gray-200 text-sm">
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={`border-b-2 pb-2 ${pathname?.startsWith(tab.href) ? "border-gray-900 font-medium" : "border-transparent text-gray-600"}`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
```

- [ ] **Step 5: Write the redirect page**

```tsx
// app/modules/vms/page.tsx
import { redirect } from "next/navigation";

export default function VmsModuleIndexPage() {
  redirect("/modules/vms/dashboard");
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- app/modules/vms/layout.test.tsx`
Expected: `1 passed`.

- [ ] **Step 7: Commit**

```bash
git add registry/modules.ts app/modules/vms/layout.tsx app/modules/vms/layout.test.tsx app/modules/vms/page.tsx
git commit -m "feat: register vms module and add its tab layout"
```

---

### Task 3: Dashboard screen

**Files:**
- Create: `app/modules/vms/dashboard/page.tsx`
- Create: `app/modules/vms/dashboard/page.test.tsx`

**Interfaces:**
- Consumes: `getKpiSummary`, `KpiSummary` from `@/lib/vmsFunctions`; `fetchStaffToken` from `@/lib/staffToken`; `useSelectedOrg` from `@/components/shell/AppShell`; `getBrowserSupabaseClient`.

- [ ] **Step 1: Write the failing test**

```tsx
// app/modules/vms/dashboard/page.test.tsx
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import VmsDashboardPage from "./page";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { fetchStaffToken } from "@/lib/staffToken";
import * as vmsFunctions from "@/lib/vmsFunctions";
import * as shell from "@/components/shell/AppShell";

vi.mock("@/lib/supabase/browserClient");
vi.mock("@/lib/staffToken");
vi.mock("@/lib/vmsFunctions");
vi.mock("@/components/shell/AppShell", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/shell/AppShell")>();
  return { ...actual, useSelectedOrg: vi.fn() };
});

describe("VmsDashboardPage", () => {
  beforeEach(() => {
    vi.mocked(shell.useSelectedOrg).mockReturnValue("org-1");
    vi.mocked(getBrowserSupabaseClient).mockReturnValue({
      auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: "platform-token" } } }) },
    } as never);
    vi.mocked(fetchStaffToken).mockResolvedValue("staff-jwt");
  });

  it("shows all 10 KPI figures once loaded", async () => {
    vi.mocked(vmsFunctions.getKpiSummary).mockResolvedValue({
      totalRegistered: 42, active: 30, completedParticipations: 12, applicationsReceived: 55,
      selected: 20, totalVerifiedHours: 340, byCity: { Lahore: 20, Karachi: 22 },
      byProvince: { Punjab: 42 }, byInstitution: { LUMS: 42 },
      participationByOpportunity: { "Beach Cleanup": 8 }, participationByActivityType: { environment: 8 },
    });

    render(<VmsDashboardPage />);

    await waitFor(() => expect(screen.getByText("42")).toBeInTheDocument());
    expect(screen.getByText("30")).toBeInTheDocument();
    expect(screen.getByText("340")).toBeInTheDocument();
    expect(vmsFunctions.getKpiSummary).toHaveBeenCalledWith({ organizationId: "org-1" }, "staff-jwt");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- app/modules/vms/dashboard/page.test.tsx`
Expected: FAIL — `./page` module not found.

- [ ] **Step 3: Write the page**

```tsx
// app/modules/vms/dashboard/page.tsx
"use client";

import { useEffect, useState } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { fetchStaffToken } from "@/lib/staffToken";
import { getKpiSummary, type KpiSummary } from "@/lib/vmsFunctions";
import { useSelectedOrg } from "@/components/shell/AppShell";

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-gray-200 p-4">
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-sm text-gray-600">{label}</p>
    </div>
  );
}

function BreakdownList({ title, counts }: { title: string; counts: Record<string, number> }) {
  const entries = Object.entries(counts);
  return (
    <div>
      <h3 className="mb-2 text-sm font-medium text-gray-700">{title}</h3>
      {entries.length === 0 ? (
        <p className="text-sm text-gray-500">No data yet.</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {entries.map(([key, count]) => (
            <li key={key} className="flex justify-between">
              <span>{key}</span>
              <span>{count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function VmsDashboardPage() {
  const organizationId = useSelectedOrg();
  const [kpis, setKpis] = useState<KpiSummary | null>(null);

  useEffect(() => {
    async function load() {
      if (!organizationId) return;
      const supabase = getBrowserSupabaseClient();
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return;
      const staffToken = await fetchStaffToken(sessionData.session.access_token);
      const result = await getKpiSummary({ organizationId }, staffToken);
      setKpis(result);
    }
    load();
  }, [organizationId]);

  if (!organizationId) return <p>Select an organization to see its VMS dashboard.</p>;
  if (!kpis) return <p>Loading…</p>;

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold">VMS Dashboard</h1>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatTile label="Total registered" value={kpis.totalRegistered} />
        <StatTile label="Active" value={kpis.active} />
        <StatTile label="Completed participations" value={kpis.completedParticipations} />
        <StatTile label="Applications received" value={kpis.applicationsReceived} />
        <StatTile label="Selected" value={kpis.selected} />
        <StatTile label="Total verified hours" value={kpis.totalVerifiedHours} />
      </div>
      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
        <BreakdownList title="By city" counts={kpis.byCity} />
        <BreakdownList title="By province" counts={kpis.byProvince} />
        <BreakdownList title="By institution" counts={kpis.byInstitution} />
        <BreakdownList title="Participation by opportunity" counts={kpis.participationByOpportunity} />
        <BreakdownList title="Participation by activity type" counts={kpis.participationByActivityType} />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- app/modules/vms/dashboard/page.test.tsx`
Expected: `1 passed`.

- [ ] **Step 5: Commit**

```bash
git add app/modules/vms/dashboard/
git commit -m "feat: add VMS admin dashboard screen"
```

---

### Task 4: Volunteers list + detail screens

**Files:**
- Create: `app/modules/vms/volunteers/page.tsx`
- Create: `app/modules/vms/volunteers/page.test.tsx`
- Create: `app/modules/vms/volunteers/[id]/page.tsx`
- Create: `app/modules/vms/volunteers/[id]/page.test.tsx`

**Interfaces:**
- Consumes: `listVolunteers`, `getVolunteerDetail`, `exportVmsCsv` from `@/lib/vmsFunctions`.
- Produces: nothing later tasks import — this is a leaf screen pair.

- [ ] **Step 1: Write the failing list-screen test**

```tsx
// app/modules/vms/volunteers/page.test.tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import VmsVolunteersPage from "./page";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { fetchStaffToken } from "@/lib/staffToken";
import * as vmsFunctions from "@/lib/vmsFunctions";
import * as shell from "@/components/shell/AppShell";

vi.mock("@/lib/supabase/browserClient");
vi.mock("@/lib/staffToken");
vi.mock("@/lib/vmsFunctions");
vi.mock("@/components/shell/AppShell", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/shell/AppShell")>();
  return { ...actual, useSelectedOrg: vi.fn() };
});

describe("VmsVolunteersPage", () => {
  beforeEach(() => {
    vi.mocked(shell.useSelectedOrg).mockReturnValue("org-1");
    vi.mocked(getBrowserSupabaseClient).mockReturnValue({
      auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: "platform-token" } } }) },
    } as never);
    vi.mocked(fetchStaffToken).mockResolvedValue("staff-jwt");
    vi.mocked(vmsFunctions.listVolunteers).mockReset();
  });

  it("lists volunteers and re-fetches with the search term when submitted", async () => {
    vi.mocked(vmsFunctions.listVolunteers).mockResolvedValue({
      volunteers: [{
        id: "vol-1", volunteerCode: "YR-2026-00001", fullName: "Aisha Khan", email: "aisha@example.com",
        phone: "0300-1111111", city: "Lahore", province: "Punjab", institution: "LUMS", status: "active",
      }],
      total: 1,
    });
    const user = userEvent.setup();

    render(<VmsVolunteersPage />);

    expect(await screen.findByText("Aisha Khan")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Search"), "Aisha");
    await user.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => {
      expect(vmsFunctions.listVolunteers).toHaveBeenLastCalledWith(
        expect.objectContaining({ organizationId: "org-1", search: "Aisha" }),
        "staff-jwt",
      );
    });
  });

  it("links each row to its volunteer detail page", async () => {
    vi.mocked(vmsFunctions.listVolunteers).mockResolvedValue({
      volunteers: [{
        id: "vol-1", volunteerCode: "YR-2026-00001", fullName: "Aisha Khan", email: "aisha@example.com",
        phone: "0300-1111111", city: "Lahore", province: "Punjab", institution: "LUMS", status: "active",
      }],
      total: 1,
    });

    render(<VmsVolunteersPage />);

    const link = await screen.findByRole("link", { name: "Aisha Khan" });
    expect(link).toHaveAttribute("href", "/modules/vms/volunteers/vol-1");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- app/modules/vms/volunteers/page.test.tsx`
Expected: FAIL — `./page` module not found.

- [ ] **Step 3: Write the list screen**

```tsx
// app/modules/vms/volunteers/page.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { fetchStaffToken } from "@/lib/staffToken";
import { listVolunteers, exportVmsCsv, type VolunteerSummary } from "@/lib/vmsFunctions";
import { useSelectedOrg } from "@/components/shell/AppShell";

export default function VmsVolunteersPage() {
  const organizationId = useSelectedOrg();
  const [volunteers, setVolunteers] = useState<VolunteerSummary[]>([]);
  const [search, setSearch] = useState("");
  const [staffToken, setStaffToken] = useState<string | null>(null);

  const load = useCallback(async (searchTerm: string) => {
    if (!organizationId) return;
    const supabase = getBrowserSupabaseClient();
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) return;
    const token = await fetchStaffToken(sessionData.session.access_token);
    setStaffToken(token);
    const result = await listVolunteers({ organizationId, search: searchTerm || undefined }, token);
    setVolunteers(result.volunteers);
  }, [organizationId]);

  useEffect(() => {
    load("");
  }, [load]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    await load(search);
  }

  async function handleExport() {
    if (!organizationId || !staffToken) return;
    const csv = await exportVmsCsv({ organizationId, entity: "volunteers" }, staffToken);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "volunteers.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!organizationId) return <p>Select an organization to see its volunteers.</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Volunteers</h1>
        <button type="button" onClick={handleExport} className="rounded border px-3 py-1.5 text-sm">
          Export CSV
        </button>
      </div>
      <form onSubmit={handleSearch} className="flex gap-2">
        <div>
          <label htmlFor="volunteerSearch" className="block text-sm">Search</label>
          <input id="volunteerSearch" className="mt-1 rounded border px-3 py-2" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button type="submit" className="mt-auto rounded bg-gray-900 px-4 py-2 text-white">Search</button>
      </form>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-gray-600">
              <th className="py-2 pr-4">Name</th>
              <th className="py-2 pr-4">City</th>
              <th className="py-2 pr-4">Institution</th>
              <th className="py-2 pr-4">Status</th>
            </tr>
          </thead>
          <tbody>
            {volunteers.map((v) => (
              <tr key={v.id} className="border-b border-gray-100">
                <td className="py-2 pr-4">
                  <Link href={`/modules/vms/volunteers/${v.id}`} className="underline">{v.fullName}</Link>
                </td>
                <td className="py-2 pr-4">{v.city}</td>
                <td className="py-2 pr-4">{v.institution}</td>
                <td className="py-2 pr-4">{v.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify the list screen passes**

Run: `npm test -- app/modules/vms/volunteers/page.test.tsx`
Expected: `2 passed`.

- [ ] **Step 5: Write the failing detail-screen test**

```tsx
// app/modules/vms/volunteers/[id]/page.test.tsx
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import VmsVolunteerDetailPage from "./page";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { fetchStaffToken } from "@/lib/staffToken";
import * as vmsFunctions from "@/lib/vmsFunctions";
import * as shell from "@/components/shell/AppShell";

vi.mock("@/lib/supabase/browserClient");
vi.mock("@/lib/staffToken");
vi.mock("@/lib/vmsFunctions");
vi.mock("@/components/shell/AppShell", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/shell/AppShell")>();
  return { ...actual, useSelectedOrg: vi.fn() };
});
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "vol-1" }),
}));

describe("VmsVolunteerDetailPage", () => {
  beforeEach(() => {
    vi.mocked(shell.useSelectedOrg).mockReturnValue("org-1");
    vi.mocked(getBrowserSupabaseClient).mockReturnValue({
      auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: "platform-token" } } }) },
    } as never);
    vi.mocked(fetchStaffToken).mockResolvedValue("staff-jwt");
  });

  it("shows the volunteer's profile, applications, participations, and activity (with admin notes)", async () => {
    vi.mocked(vmsFunctions.getVolunteerDetail).mockResolvedValue({
      id: "vol-1", volunteerCode: "YR-2026-00001", fullName: "Aisha Khan", email: "aisha@example.com",
      phone: "0300-1111111", city: "Lahore", province: "Punjab", institution: "LUMS", status: "active",
      applications: [{ id: "app-1", status: "selected", opportunityName: "Beach Cleanup", appliedAt: "2026-01-01T00:00:00Z" }],
      participations: [{ id: "p-1", status: "completed", opportunityName: "Beach Cleanup" }],
      activity: [{
        id: "ah-1", role: "Lead", activityDate: "2026-02-01", hoursSubmitted: 5, hoursVerified: 5,
        verificationStatus: "verified", adminNotes: "Showed great leadership", opportunityName: "Beach Cleanup",
      }],
    });

    render(<VmsVolunteerDetailPage />);

    expect(await screen.findByText("Aisha Khan")).toBeInTheDocument();
    expect(screen.getByText("Beach Cleanup")).toBeInTheDocument();
    expect(screen.getByText("Showed great leadership")).toBeInTheDocument();
    expect(vmsFunctions.getVolunteerDetail).toHaveBeenCalledWith(
      { organizationId: "org-1", volunteerId: "vol-1" },
      "staff-jwt",
    );
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npm test -- app/modules/vms/volunteers/[id]/page.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 7: Write the detail screen**

```tsx
// app/modules/vms/volunteers/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { fetchStaffToken } from "@/lib/staffToken";
import { getVolunteerDetail, type VolunteerDetail } from "@/lib/vmsFunctions";
import { useSelectedOrg } from "@/components/shell/AppShell";

export default function VmsVolunteerDetailPage() {
  const organizationId = useSelectedOrg();
  const { id } = useParams<{ id: string }>();
  const [detail, setDetail] = useState<VolunteerDetail | null>(null);

  useEffect(() => {
    async function load() {
      if (!organizationId) return;
      const supabase = getBrowserSupabaseClient();
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return;
      const staffToken = await fetchStaffToken(sessionData.session.access_token);
      const result = await getVolunteerDetail({ organizationId, volunteerId: id }, staffToken);
      setDetail(result);
    }
    load();
  }, [organizationId, id]);

  if (!organizationId) return <p>Select an organization to see this volunteer.</p>;
  if (!detail) return <p>Loading…</p>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">{detail.fullName}</h1>
        <p className="text-sm text-gray-600">{detail.email} · {detail.phone}</p>
        <p className="text-sm text-gray-600">{detail.city}, {detail.province} · {detail.institution}</p>
      </div>

      <div>
        <h2 className="mb-2 text-lg font-medium">Applications</h2>
        <ul className="space-y-2">
          {detail.applications.map((a) => (
            <li key={a.id} className="rounded border border-gray-200 p-3 text-sm">
              {a.opportunityName} — {a.status}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h2 className="mb-2 text-lg font-medium">Participations</h2>
        <ul className="space-y-2">
          {detail.participations.map((p) => (
            <li key={p.id} className="rounded border border-gray-200 p-3 text-sm">
              {p.opportunityName} — {p.status}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h2 className="mb-2 text-lg font-medium">Activity history</h2>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-gray-600">
              <th className="py-2 pr-4">Activity</th>
              <th className="py-2 pr-4">Role</th>
              <th className="py-2 pr-4">Date</th>
              <th className="py-2 pr-4">Hours</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4">Admin notes</th>
            </tr>
          </thead>
          <tbody>
            {detail.activity.map((a) => (
              <tr key={a.id} className="border-b border-gray-100">
                <td className="py-2 pr-4">{a.opportunityName}</td>
                <td className="py-2 pr-4">{a.role}</td>
                <td className="py-2 pr-4">{a.activityDate}</td>
                <td className="py-2 pr-4">{a.hoursVerified ?? a.hoursSubmitted}</td>
                <td className="py-2 pr-4">{a.verificationStatus}</td>
                <td className="py-2 pr-4">{a.adminNotes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npm test -- app/modules/vms/volunteers/[id]/page.test.tsx`
Expected: `1 passed`.

- [ ] **Step 9: Run the full suite and verify no regressions**

Run: `npm test`

- [ ] **Step 10: Commit**

```bash
git add app/modules/vms/volunteers/
git commit -m "feat: add VMS volunteers list and detail screens"
```

---

### Task 5: Opportunities screen

**Files:**
- Create: `app/modules/vms/opportunities/page.tsx`
- Create: `app/modules/vms/opportunities/page.test.tsx`
- Create: `components/vms/CreateOpportunityForm.tsx`
- Create: `components/vms/CreateOpportunityForm.test.tsx`

**Interfaces:**
- Consumes: `listOpportunities`, `createOpportunity`, `listParticipationForOpportunity`, `exportVmsCsv` from `@/lib/vmsFunctions`.

- [ ] **Step 1: Write the failing form test**

```tsx
// components/vms/CreateOpportunityForm.test.tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CreateOpportunityForm } from "./CreateOpportunityForm";
import * as vmsFunctions from "@/lib/vmsFunctions";

vi.mock("@/lib/vmsFunctions");

describe("CreateOpportunityForm", () => {
  beforeEach(() => {
    vi.mocked(vmsFunctions.createOpportunity).mockReset();
  });

  it("submits name and type to createOpportunity with the staff token", async () => {
    vi.mocked(vmsFunctions.createOpportunity).mockResolvedValue({ opportunityId: "opp-1" });
    const onCreated = vi.fn();
    const user = userEvent.setup();

    render(<CreateOpportunityForm organizationId="org-1" staffToken="staff-jwt" onCreated={onCreated} />);

    await user.type(screen.getByLabelText("Name"), "Beach Cleanup");
    await user.selectOptions(screen.getByLabelText("Type"), "environment");
    await user.click(screen.getByRole("button", { name: "Create opportunity" }));

    await waitFor(() => {
      expect(vmsFunctions.createOpportunity).toHaveBeenCalledWith(
        { organizationId: "org-1", name: "Beach Cleanup", type: "environment" },
        "staff-jwt",
      );
      expect(onCreated).toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- components/vms/CreateOpportunityForm.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the form**

```tsx
// components/vms/CreateOpportunityForm.tsx
"use client";

import { useState } from "react";
import { createOpportunity } from "@/lib/vmsFunctions";

export function CreateOpportunityForm({
  organizationId,
  staffToken,
  onCreated,
}: {
  organizationId: string;
  staffToken: string;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState("environment");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await createOpportunity({ organizationId, name, type }, staffToken);
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
      <div>
        <label htmlFor="oppName" className="block text-sm">Name</label>
        <input id="oppName" className="mt-1 rounded border px-3 py-2" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <label htmlFor="oppType" className="block text-sm">Type</label>
        <select id="oppType" className="mt-1 rounded border px-3 py-2" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="environment">Environment</option>
          <option value="health">Health</option>
          <option value="education">Education</option>
          <option value="community">Community</option>
        </select>
      </div>
      <button type="submit" disabled={submitting} className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-50">
        Create opportunity
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
```

Before finalizing, check `youth-republic/backend/supabase/functions/create-opportunity/handler.ts`'s `CreateOpportunityInput.type` field — if it's a free-form string with no fixed set of valid values (per the report's own §5C gap: "Type is a free string, not a fixed admin-extensible list" is explicitly *out of scope* for this task and left as a real backlog item in the volunteer-app-polish plan's counterpart), this dropdown's 4 options are a reasonable starting set, not a validated enum — don't add client-side validation restricting to only these 4.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- components/vms/CreateOpportunityForm.test.tsx`
Expected: `1 passed`.

- [ ] **Step 5: Write the failing list-screen test**

```tsx
// app/modules/vms/opportunities/page.test.tsx
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import VmsOpportunitiesPage from "./page";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { fetchStaffToken } from "@/lib/staffToken";
import * as vmsFunctions from "@/lib/vmsFunctions";
import * as shell from "@/components/shell/AppShell";

vi.mock("@/lib/supabase/browserClient");
vi.mock("@/lib/staffToken");
vi.mock("@/lib/vmsFunctions");
vi.mock("@/components/shell/AppShell", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/shell/AppShell")>();
  return { ...actual, useSelectedOrg: vi.fn() };
});

describe("VmsOpportunitiesPage", () => {
  beforeEach(() => {
    vi.mocked(shell.useSelectedOrg).mockReturnValue("org-1");
    vi.mocked(getBrowserSupabaseClient).mockReturnValue({
      auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: "platform-token" } } }) },
    } as never);
    vi.mocked(fetchStaffToken).mockResolvedValue("staff-jwt");
    vi.mocked(vmsFunctions.listOpportunities).mockResolvedValue({
      opportunities: [{ id: "opp-1", name: "Beach Cleanup", type: "environment", computedStatus: "open", capacity: 20 }],
      total: 1,
    });
  });

  it("lists opportunities with their computed status", async () => {
    render(<VmsOpportunitiesPage />);
    expect(await screen.findByText("Beach Cleanup")).toBeInTheDocument();
    expect(screen.getByText("open")).toBeInTheDocument();
  });

  it("refreshes the list after a new opportunity is created", async () => {
    render(<VmsOpportunitiesPage />);
    await screen.findByText("Beach Cleanup");
    expect(vmsFunctions.listOpportunities).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npm test -- app/modules/vms/opportunities/page.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 7: Write the list screen**

```tsx
// app/modules/vms/opportunities/page.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { fetchStaffToken } from "@/lib/staffToken";
import { listOpportunities, exportVmsCsv, type OpportunitySummary } from "@/lib/vmsFunctions";
import { useSelectedOrg } from "@/components/shell/AppShell";
import { CreateOpportunityForm } from "@/components/vms/CreateOpportunityForm";

export default function VmsOpportunitiesPage() {
  const organizationId = useSelectedOrg();
  const [opportunities, setOpportunities] = useState<OpportunitySummary[]>([]);
  const [staffToken, setStaffToken] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!organizationId) return;
    const supabase = getBrowserSupabaseClient();
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) return;
    const token = await fetchStaffToken(sessionData.session.access_token);
    setStaffToken(token);
    const result = await listOpportunities({ organizationId }, token);
    setOpportunities(result.opportunities);
  }, [organizationId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleExport() {
    if (!organizationId || !staffToken) return;
    const csv = await exportVmsCsv({ organizationId, entity: "opportunities" }, staffToken);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "opportunities.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!organizationId) return <p>Select an organization to see its opportunities.</p>;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Opportunities</h1>
        <button type="button" onClick={handleExport} className="rounded border px-3 py-1.5 text-sm">
          Export CSV
        </button>
      </div>

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-gray-600">
            <th className="py-2 pr-4">Name</th>
            <th className="py-2 pr-4">Type</th>
            <th className="py-2 pr-4">Status</th>
            <th className="py-2 pr-4">Capacity</th>
          </tr>
        </thead>
        <tbody>
          {opportunities.map((o) => (
            <tr key={o.id} className="border-b border-gray-100">
              <td className="py-2 pr-4">{o.name}</td>
              <td className="py-2 pr-4">{o.type}</td>
              <td className="py-2 pr-4">{o.computedStatus}</td>
              <td className="py-2 pr-4">{o.capacity ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div>
        <h2 className="mb-2 text-lg font-medium">Create opportunity</h2>
        {staffToken && <CreateOpportunityForm organizationId={organizationId} staffToken={staffToken} onCreated={load} />}
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npm test -- app/modules/vms/opportunities/page.test.tsx`
Expected: `2 passed`.

- [ ] **Step 9: Run the full suite and verify no regressions**

Run: `npm test`

- [ ] **Step 10: Commit**

```bash
git add app/modules/vms/opportunities/ components/vms/CreateOpportunityForm.tsx components/vms/CreateOpportunityForm.test.tsx
git commit -m "feat: add VMS opportunities screen with create form"
```

---

### Task 6: Applications screen

**Files:**
- Create: `app/modules/vms/applications/page.tsx`
- Create: `app/modules/vms/applications/page.test.tsx`

**Interfaces:**
- Consumes: `listApplications`, `decideApplication`, `exportVmsCsv` from `@/lib/vmsFunctions`.

- [ ] **Step 1: Write the failing test**

```tsx
// app/modules/vms/applications/page.test.tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import VmsApplicationsPage from "./page";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { fetchStaffToken } from "@/lib/staffToken";
import * as vmsFunctions from "@/lib/vmsFunctions";
import * as shell from "@/components/shell/AppShell";

vi.mock("@/lib/supabase/browserClient");
vi.mock("@/lib/staffToken");
vi.mock("@/lib/vmsFunctions");
vi.mock("@/components/shell/AppShell", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/shell/AppShell")>();
  return { ...actual, useSelectedOrg: vi.fn() };
});

describe("VmsApplicationsPage", () => {
  beforeEach(() => {
    vi.mocked(shell.useSelectedOrg).mockReturnValue("org-1");
    vi.mocked(getBrowserSupabaseClient).mockReturnValue({
      auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: "platform-token" } } }) },
    } as never);
    vi.mocked(fetchStaffToken).mockResolvedValue("staff-jwt");
    vi.mocked(vmsFunctions.listApplications).mockResolvedValue({
      applications: [{
        id: "app-1", volunteerId: "vol-1", volunteerName: "Aisha Khan", opportunityId: "opp-1",
        opportunityName: "Beach Cleanup", status: "submitted", appliedAt: "2026-01-01T00:00:00Z",
      }],
      total: 1,
    });
    vi.mocked(vmsFunctions.decideApplication).mockReset();
  });

  it("lists applications and decides one when a decision button is clicked", async () => {
    vi.mocked(vmsFunctions.decideApplication).mockResolvedValue({ applicationId: "app-1", participationId: "p-1" });
    const user = userEvent.setup();

    render(<VmsApplicationsPage />);

    expect(await screen.findByText("Aisha Khan")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Select" }));

    await waitFor(() => {
      expect(vmsFunctions.decideApplication).toHaveBeenCalledWith(
        { applicationId: "app-1", decision: "selected" },
        "staff-jwt",
      );
    });
  });

  it("promotes a waitlisted application to selected using the same decide action", async () => {
    vi.mocked(vmsFunctions.listApplications).mockResolvedValue({
      applications: [{
        id: "app-2", volunteerId: "vol-2", volunteerName: "Bilal Ahmed", opportunityId: "opp-1",
        opportunityName: "Beach Cleanup", status: "waitlisted", appliedAt: "2026-01-01T00:00:00Z",
      }],
      total: 1,
    });
    vi.mocked(vmsFunctions.decideApplication).mockResolvedValue({ applicationId: "app-2", participationId: "p-2" });
    const user = userEvent.setup();

    render(<VmsApplicationsPage />);

    expect(await screen.findByText("Bilal Ahmed")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Promote to selected" }));

    await waitFor(() => {
      expect(vmsFunctions.decideApplication).toHaveBeenCalledWith(
        { applicationId: "app-2", decision: "selected" },
        "staff-jwt",
      );
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- app/modules/vms/applications/page.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the screen**

```tsx
// app/modules/vms/applications/page.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { fetchStaffToken } from "@/lib/staffToken";
import { listApplications, decideApplication, exportVmsCsv, type ApplicationListRow, type DecideApplicationPayload } from "@/lib/vmsFunctions";
import { useSelectedOrg } from "@/components/shell/AppShell";

export default function VmsApplicationsPage() {
  const organizationId = useSelectedOrg();
  const [applications, setApplications] = useState<ApplicationListRow[]>([]);
  const [staffToken, setStaffToken] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!organizationId) return;
    const supabase = getBrowserSupabaseClient();
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) return;
    const token = await fetchStaffToken(sessionData.session.access_token);
    setStaffToken(token);
    const result = await listApplications({ organizationId }, token);
    setApplications(result.applications);
  }, [organizationId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDecide(applicationId: string, decision: DecideApplicationPayload["decision"]) {
    if (!staffToken) return;
    // No organizationId here — decideApplication derives it from the
    // application row itself server-side.
    await decideApplication({ applicationId, decision }, staffToken);
    await load();
  }

  async function handleExport() {
    if (!organizationId || !staffToken) return;
    const csv = await exportVmsCsv({ organizationId, entity: "applications" }, staffToken);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "applications.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!organizationId) return <p>Select an organization to see its applications.</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Applications</h1>
        <button type="button" onClick={handleExport} className="rounded border px-3 py-1.5 text-sm">
          Export CSV
        </button>
      </div>

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-gray-600">
            <th className="py-2 pr-4">Volunteer</th>
            <th className="py-2 pr-4">Opportunity</th>
            <th className="py-2 pr-4">Status</th>
            <th className="py-2 pr-4">Actions</th>
          </tr>
        </thead>
        <tbody>
          {applications.map((a) => (
            <tr key={a.id} className="border-b border-gray-100">
              <td className="py-2 pr-4">{a.volunteerName}</td>
              <td className="py-2 pr-4">{a.opportunityName}</td>
              <td className="py-2 pr-4">{a.status}</td>
              <td className="py-2 pr-4 space-x-2">
                {a.status === "waitlisted" ? (
                  <button type="button" onClick={() => handleDecide(a.id, "selected")} className="rounded border px-2 py-1 text-xs">
                    Promote to selected
                  </button>
                ) : (
                  <>
                    <button type="button" onClick={() => handleDecide(a.id, "selected")} className="rounded border px-2 py-1 text-xs">
                      Select
                    </button>
                    <button type="button" onClick={() => handleDecide(a.id, "waitlisted")} className="rounded border px-2 py-1 text-xs">
                      Waitlist
                    </button>
                    <button type="button" onClick={() => handleDecide(a.id, "rejected")} className="rounded border px-2 py-1 text-xs">
                      Reject
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- app/modules/vms/applications/page.test.tsx`
Expected: `2 passed`.

- [ ] **Step 5: Run the full suite and verify no regressions**

Run: `npm test`

- [ ] **Step 6: Commit**

```bash
git add app/modules/vms/applications/
git commit -m "feat: add VMS applications screen with decide/promote actions"
```

---

### Task 7: Hours screen

**Files:**
- Create: `app/modules/vms/hours/page.tsx`
- Create: `app/modules/vms/hours/page.test.tsx`
- Create: `components/vms/BulkAssignHoursForm.tsx`
- Create: `components/vms/BulkAssignHoursForm.test.tsx`

**Interfaces:**
- Consumes: `listActivityHours`, `verifyHours`, `bulkAssignHours`, `listOpportunities`, `listParticipationForOpportunity`, `exportVmsCsv` from `@/lib/vmsFunctions`.

`bulkAssignHours` takes a specific `participationIds: string[]`, not "everyone in an opportunity" — so this form needs to know which participants exist for a chosen opportunity before it can offer them as checkboxes. It takes that list as a prop (`participants`) rather than fetching it itself, keeping the form a pure "given these people, assign hours to the ones I pick" component; the page below owns fetching which opportunity/participants are in play.

- [ ] **Step 1: Write the failing form test**

```tsx
// components/vms/BulkAssignHoursForm.test.tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BulkAssignHoursForm } from "./BulkAssignHoursForm";
import * as vmsFunctions from "@/lib/vmsFunctions";

vi.mock("@/lib/vmsFunctions");

describe("BulkAssignHoursForm", () => {
  beforeEach(() => {
    vi.mocked(vmsFunctions.bulkAssignHours).mockReset();
  });

  it("submits date, hours, and only the checked participants' ids to bulkAssignHours", async () => {
    vi.mocked(vmsFunctions.bulkAssignHours).mockResolvedValue({ createdCount: 2 });
    const onAssigned = vi.fn();
    const user = userEvent.setup();

    render(
      <BulkAssignHoursForm
        organizationId="org-1"
        opportunityId="opp-1"
        participants={[
          { participationId: "p-1", volunteerName: "Aisha Khan" },
          { participationId: "p-2", volunteerName: "Bilal Ahmed" },
        ]}
        staffToken="staff-jwt"
        onAssigned={onAssigned}
      />,
    );

    await user.type(screen.getByLabelText("Activity date"), "2026-02-01");
    await user.type(screen.getByLabelText("Hours"), "3");
    await user.click(screen.getByLabelText("Aisha Khan"));
    await user.click(screen.getByRole("button", { name: "Bulk-assign hours" }));

    await waitFor(() => {
      expect(vmsFunctions.bulkAssignHours).toHaveBeenCalledWith(
        { organizationId: "org-1", opportunityId: "opp-1", activityDate: "2026-02-01", hoursSubmitted: 3, participationIds: ["p-1"] },
        "staff-jwt",
      );
      expect(onAssigned).toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- components/vms/BulkAssignHoursForm.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the form**

```tsx
// components/vms/BulkAssignHoursForm.tsx
"use client";

import { useState } from "react";
import { bulkAssignHours } from "@/lib/vmsFunctions";

export interface ParticipantOption {
  participationId: string;
  volunteerName: string;
}

export function BulkAssignHoursForm({
  organizationId,
  opportunityId,
  participants,
  staffToken,
  onAssigned,
}: {
  organizationId: string;
  opportunityId: string;
  participants: ParticipantOption[];
  staffToken: string;
  onAssigned: () => void;
}) {
  const [activityDate, setActivityDate] = useState("");
  const [hours, setHours] = useState("");
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function toggle(participationId: string) {
    setCheckedIds((prev) =>
      prev.includes(participationId) ? prev.filter((id) => id !== participationId) : [...prev, participationId],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await bulkAssignHours(
        { organizationId, opportunityId, activityDate, hoursSubmitted: Number(hours), participationIds: checkedIds },
        staffToken,
      );
      setActivityDate("");
      setHours("");
      setCheckedIds([]);
      onAssigned();
    } catch (err) {
      setError(err instanceof Error ? err.message : "unknown_error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex items-end gap-2">
        <div>
          <label htmlFor="bulkActivityDate" className="block text-sm">Activity date</label>
          <input id="bulkActivityDate" type="date" className="mt-1 rounded border px-3 py-2" value={activityDate} onChange={(e) => setActivityDate(e.target.value)} />
        </div>
        <div>
          <label htmlFor="bulkHours" className="block text-sm">Hours</label>
          <input id="bulkHours" type="number" className="mt-1 w-24 rounded border px-3 py-2" value={hours} onChange={(e) => setHours(e.target.value)} />
        </div>
      </div>
      <fieldset>
        <legend className="text-sm">Participants</legend>
        {participants.map((p) => (
          <label key={p.participationId} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={checkedIds.includes(p.participationId)}
              onChange={() => toggle(p.participationId)}
            />
            {p.volunteerName}
          </label>
        ))}
      </fieldset>
      <button type="submit" disabled={submitting || checkedIds.length === 0} className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-50">
        Bulk-assign hours
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- components/vms/BulkAssignHoursForm.test.tsx`
Expected: `1 passed`.

- [ ] **Step 5: Write the failing hours-screen test**

```tsx
// app/modules/vms/hours/page.test.tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import VmsHoursPage from "./page";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { fetchStaffToken } from "@/lib/staffToken";
import * as vmsFunctions from "@/lib/vmsFunctions";
import * as shell from "@/components/shell/AppShell";

vi.mock("@/lib/supabase/browserClient");
vi.mock("@/lib/staffToken");
vi.mock("@/lib/vmsFunctions");
vi.mock("@/components/shell/AppShell", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/shell/AppShell")>();
  return { ...actual, useSelectedOrg: vi.fn() };
});

describe("VmsHoursPage", () => {
  beforeEach(() => {
    vi.mocked(shell.useSelectedOrg).mockReturnValue("org-1");
    vi.mocked(getBrowserSupabaseClient).mockReturnValue({
      auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: "platform-token" } } }) },
    } as never);
    vi.mocked(fetchStaffToken).mockResolvedValue("staff-jwt");
    vi.mocked(vmsFunctions.listActivityHours).mockResolvedValue({
      activity: [{
        id: "ah-1", volunteerName: "Aisha Khan", opportunityName: "Beach Cleanup", activityType: "environment",
        role: "Lead", activityDate: "2026-02-01", hoursSubmitted: 5, hoursVerified: null,
        verificationStatus: "recorded", adminNotes: null,
      }],
      total: 1,
    });
    vi.mocked(vmsFunctions.listOpportunities).mockResolvedValue({
      opportunities: [{ id: "opp-1", name: "Beach Cleanup", type: "environment", computedStatus: "open", capacity: 20 }],
      total: 1,
    });
    vi.mocked(vmsFunctions.listParticipationForOpportunity).mockResolvedValue({
      applicants: [],
      participants: [{ participationId: "p-1", volunteerId: "vol-1", volunteerName: "Aisha Khan", status: "participating" }],
    });
    vi.mocked(vmsFunctions.verifyHours).mockReset();
    vi.mocked(vmsFunctions.bulkAssignHours).mockReset();
  });

  it("lists activity hours and verifies a row when Verify is clicked, passing the required decision field", async () => {
    vi.mocked(vmsFunctions.verifyHours).mockResolvedValue({ activityHoursId: "ah-1" });
    const user = userEvent.setup();

    render(<VmsHoursPage />);

    expect(await screen.findByText("Aisha Khan")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Verify" }));

    await waitFor(() => {
      expect(vmsFunctions.verifyHours).toHaveBeenCalledWith(
        { activityHoursId: "ah-1", decision: "verified", hoursVerified: 5 },
        "staff-jwt",
      );
    });
  });

  it("loads participants for the selected opportunity so bulk-assign can offer them", async () => {
    render(<VmsHoursPage />);

    await screen.findByText("Beach Cleanup", { selector: "option" });
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText("Bulk-assign for opportunity"), "opp-1");

    await waitFor(() => {
      expect(vmsFunctions.listParticipationForOpportunity).toHaveBeenCalledWith(
        { organizationId: "org-1", opportunityId: "opp-1" },
        "staff-jwt",
      );
    });
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npm test -- app/modules/vms/hours/page.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 7: Write the screen**

```tsx
// app/modules/vms/hours/page.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { fetchStaffToken } from "@/lib/staffToken";
import {
  listActivityHours,
  verifyHours,
  listOpportunities,
  listParticipationForOpportunity,
  exportVmsCsv,
  type ActivityListRow,
  type OpportunitySummary,
} from "@/lib/vmsFunctions";
import { useSelectedOrg } from "@/components/shell/AppShell";
import { BulkAssignHoursForm, type ParticipantOption } from "@/components/vms/BulkAssignHoursForm";

export default function VmsHoursPage() {
  const organizationId = useSelectedOrg();
  const [activity, setActivity] = useState<ActivityListRow[]>([]);
  const [opportunities, setOpportunities] = useState<OpportunitySummary[]>([]);
  const [selectedOpportunityId, setSelectedOpportunityId] = useState("");
  const [participants, setParticipants] = useState<ParticipantOption[]>([]);
  const [staffToken, setStaffToken] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!organizationId) return;
    const supabase = getBrowserSupabaseClient();
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) return;
    const token = await fetchStaffToken(sessionData.session.access_token);
    setStaffToken(token);
    const [hoursResult, opportunitiesResult] = await Promise.all([
      listActivityHours({ organizationId }, token),
      listOpportunities({ organizationId }, token),
    ]);
    setActivity(hoursResult.activity);
    setOpportunities(opportunitiesResult.opportunities);
  }, [organizationId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    async function loadParticipants() {
      if (!organizationId || !staffToken || !selectedOpportunityId) {
        setParticipants([]);
        return;
      }
      const result = await listParticipationForOpportunity(
        { organizationId, opportunityId: selectedOpportunityId },
        staffToken,
      );
      setParticipants(
        result.participants.map((p) => ({ participationId: p.participationId, volunteerName: p.volunteerName })),
      );
    }
    loadParticipants();
  }, [organizationId, staffToken, selectedOpportunityId]);

  async function handleVerify(activityHoursId: string, hoursSubmitted: number) {
    if (!staffToken) return;
    // decision is required — verifyHours has no separate reject endpoint,
    // this is always "verified" from this button (a reject action with a
    // reason is a separate, later concern, not built here).
    await verifyHours({ activityHoursId, decision: "verified", hoursVerified: hoursSubmitted }, staffToken);
    await load();
  }

  async function handleExport() {
    if (!organizationId || !staffToken) return;
    const csv = await exportVmsCsv({ organizationId, entity: "activity_hours" }, staffToken);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "activity_hours.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!organizationId) return <p>Select an organization to see its activity hours.</p>;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Hours</h1>
        <button type="button" onClick={handleExport} className="rounded border px-3 py-1.5 text-sm">
          Export CSV
        </button>
      </div>

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-gray-600">
            <th className="py-2 pr-4">Volunteer</th>
            <th className="py-2 pr-4">Opportunity</th>
            <th className="py-2 pr-4">Date</th>
            <th className="py-2 pr-4">Hours</th>
            <th className="py-2 pr-4">Status</th>
            <th className="py-2 pr-4">Actions</th>
          </tr>
        </thead>
        <tbody>
          {activity.map((a) => (
            <tr key={a.id} className="border-b border-gray-100">
              <td className="py-2 pr-4">{a.volunteerName}</td>
              <td className="py-2 pr-4">{a.opportunityName}</td>
              <td className="py-2 pr-4">{a.activityDate}</td>
              <td className="py-2 pr-4">{a.hoursVerified ?? a.hoursSubmitted}</td>
              <td className="py-2 pr-4">{a.verificationStatus}</td>
              <td className="py-2 pr-4">
                {a.verificationStatus === "recorded" && (
                  <button type="button" onClick={() => handleVerify(a.id, a.hoursSubmitted)} className="rounded border px-2 py-1 text-xs">
                    Verify
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div>
        <h2 className="mb-2 text-lg font-medium">Bulk-assign hours</h2>
        <label htmlFor="bulkOpportunity" className="block text-sm">Bulk-assign for opportunity</label>
        <select
          id="bulkOpportunity"
          className="mt-1 mb-3 rounded border px-3 py-2"
          value={selectedOpportunityId}
          onChange={(e) => setSelectedOpportunityId(e.target.value)}
        >
          <option value="">Select an opportunity</option>
          {opportunities.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
        {selectedOpportunityId && staffToken && (
          <BulkAssignHoursForm
            organizationId={organizationId}
            opportunityId={selectedOpportunityId}
            participants={participants}
            staffToken={staffToken}
            onAssigned={load}
          />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npm test -- app/modules/vms/hours/page.test.tsx`
Expected: `2 passed`.

- [ ] **Step 9: Run the full suite and the build, verify no regressions**

Run: `npm test`
Run: `npm run build`
Expected: both clean. This is the last task — a failure here is the last chance to catch a cross-task type mismatch before this plan is considered done.

- [ ] **Step 10: Commit**

```bash
git add app/modules/vms/hours/ components/vms/BulkAssignHoursForm.tsx components/vms/BulkAssignHoursForm.test.tsx
git commit -m "feat: add VMS hours screen with verify and bulk-assign"
```

---

## Self-Review Notes (for the plan author, not a task to execute)

- **Spec coverage**: §2 (env var + `vmsFunctions.ts`) → Task 1. §6 module registration + layout → Task 2. §6's 5 screens → Tasks 3–7 (Volunteers task also covers the volunteer-detail screen from §6/§5F). CSV export "on every list view" → present on Volunteers, Opportunities, Applications, Hours (Dashboard has no list to export, correctly excluded).
- **Type consistency checked**: every screen imports its types from `lib/vmsFunctions.ts` (Task 1) rather than re-declaring them — `VolunteerSummary`, `OpportunitySummary`, `ApplicationListRow`, `ActivityListRow`, `KpiSummary` are each defined once and reused verbatim across the task that defines them and every task that consumes them.
- **Known open item, flagged rather than silently resolved**: Task 1 Step 4 explicitly tells the implementer to re-verify `decideApplication`/`verifyHours`/`bulkAssignHours`'s exact existing field names against the live `youth-republic` source before finalizing, since this plan's author reconstructed them from an earlier session rather than re-reading the files at plan-writing time — this is the one place in this plan where "no placeholders" is satisfied by real, best-effort code plus an explicit correctness gate, not a guarantee.

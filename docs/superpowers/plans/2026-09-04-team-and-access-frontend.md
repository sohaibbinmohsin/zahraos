# Team & Access — Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the deployed `/staff` and `/roles` pages (and the hardcoded YR audit page) with the prototype's single **Team & Access** screen — three sub-tabs (Members / Roles & Permissions / Audit Log) under one contextual header — wired to the Team & Access backend.

**Architecture:** A `/team` route group whose `layout.tsx` renders the contextual sub-nav bar, the heading/subtitle, and one primary-action button that each page configures. Shared data (members, roles, chapters) loads once in a `TeamAccessProvider` context in the layout; drawers (`Invite`, `Edit Access`, `Create/Edit Role`) are owned by the layout so both the header button and per-row buttons can open them. The five-capability grid maps to permission keys via a browser mirror of the backend's `capabilityMap`. Sidebar gets a `TEAM & ACCESS` group with three links into `/team/*`.

**Tech Stack:** Next.js 16 App Router (client components), React 19, `@supabase/ssr` browser client + RLS reads, Vitest + Testing Library, Tailwind v4 utilities + the existing `globals.css` design system.

**Spec:** `docs/superpowers/specs/2026-09-04-team-and-access-design.md`

**Depends on:** `docs/superpowers/plans/2026-09-04-team-and-access-backend.md` — its migration (`staff_role_assignments`, `roles.description`, `admin_audit_log`, five YR system roles) and edge functions (`invite-staff-member`, `update-staff-access`, `remove-staff-member`, `create-custom-role` new shape, `update-custom-role`, `delete-custom-role`, `mint-staff-token` `chapters`, YR `list-chapters`) must be deployed first.

## Global Constraints

- All Team & Access pages are `"use client"`. Reads go through the browser Supabase client (`getBrowserSupabaseClient()`) against RLS-protected tables; writes go through edge functions via `lib/platformFunctions.ts` / `lib/youthRepublicFunctions.ts` with the appropriate bearer token.
- Two tokens: platform functions (`invite-staff-member`, roles, `remove-staff-member`, `update-staff-access`) take the **Supabase session access token** (`supabase.auth.getSession()`); YR functions (`list-chapters`, `create-chapter`, `update-chapter`) take the **staff token** (`fetchStaffToken(session.access_token)` from `@/lib/staffToken`). This matches `app/modules/youth-republic/opportunities/page.tsx`.
- Env: `NEXT_PUBLIC_FUNCTIONS_URL` (platform, exists), `NEXT_PUBLIC_YOUTH_REPUBLIC_FUNCTIONS_URL` (YR, exists — used by `lib/youthRepublicFunctions.ts`). No new env var.
- Only org admins reach these screens: the sidebar links and `/team/*` render is gated on `isOrgAdminOrAbove` (already computed in `AppShell.tsx` as `orgTier === "admin" || orgTier === "super_admin" || platformOwner`). Expose it to pages via the shell context.
- Design system: use existing classes `page-header`, `page-title`, `page-subtitle`, `page-toolbar`, `stat-grid`, `stat-card`, `stat-label`, `stat-value`, `stat-sub`, `table-card`, `table-responsive-wrapper`, `data-table`, `search-input`, `filter-select`, `btn`/`btn-primary`/`btn-secondary`/`btn-danger`/`btn-sm`/`btn-xs`, `badge`/`badge-pos`/`badge-neg`/`badge-pend`/`badge-neu`, `drawer`/`drawer-backdrop`/`drawer-header`/`drawer-title`/`drawer-body`/`drawer-footer`, `module-nav-bar`/`module-nav-wrap`/`module-tab`/`count-badge`, `form-group`/`form-label`/`form-input`/`form-select`/`form-textarea`, `grid-2col`, `avatar`, `icon-svg`, `nav-group-label`, `sidebar-nav-item`, `side-badge`. Classes added in Task 1: `scope-pill`, `perm-tag`, `badge-system`, `badge-custom`, `role-repeater-box`, `role-repeater-row`, `perm-matrix-group`, `perm-matrix-group-title`, `perm-checkbox-row`, plus `stat-card.accent-gold/.accent-green/.accent-dark/.accent-red`.
- Chapter `scope_label` cached on an assignment can go stale after a chapter rename. When rendering a member's scopes, if the assignment has a `chapter_id` that matches a live chapter, show that chapter's current `name`; else fall back to the stored `scope_label`.
- Prototype copy is authoritative for headings, subtitles, stat labels, empty states, toasts — copy them verbatim from `demos/youth-republic/prototype.html` (`#screen-team`, lines ~2485–2690 for markup, ~4294–5121 for behavior/strings).

---

## File Structure

- `app/globals.css` — modify: append the missing prototype classes.
- `lib/capabilityMap.ts` (+ `.test.ts`) — new: browser mirror of the backend helper + UI label/tag helpers.
- `lib/staffToken.ts` — modify: `chapters?: string[]` on `moduleAccess[]`.
- `lib/platformFunctions.ts` — modify: add role + staff-access wrappers, remove `createStaff`/`assignStaffModuleRole`.
- `lib/youthRepublicFunctions.ts` — modify: add `listChapters`/`createChapter`/`updateChapter`.
- `components/shell/AppShell.tsx` — modify: `TEAM & ACCESS` sidebar group; expose `isOrgAdminOrAbove` + `accessToken` on shell context.
- `app/team/layout.tsx` — new: contextual chrome + providers + drawers.
- `components/team/TeamAccessProvider.tsx` (+ `.test.tsx`) — new: shared data context.
- `components/team/teamHeader.ts` — new: `TeamHeaderContext` + `useTeamHeader`.
- `components/team/TeamDrawers.tsx` — new: `useTeamDrawers` + mounts the three drawers.
- `components/team/StatCard.tsx` — new.
- `components/team/RoleScopeRepeater.tsx` (+ `.test.tsx`) — new: repeatable role+scope rows, shared by invite + edit drawers.
- `components/team/MembersTable.tsx` (+ `.test.tsx`) — new.
- `components/team/InviteMemberDrawer.tsx` (+ `.test.tsx`) — new.
- `components/team/EditMemberDrawer.tsx` (+ `.test.tsx`) — new.
- `components/team/RolesTable.tsx` (+ `.test.tsx`) — new.
- `components/team/RoleDrawer.tsx` (+ `.test.tsx`) — new.
- `components/team/ChaptersPanel.tsx` (+ `.test.tsx`) — new.
- `components/team/AuditTable.tsx` (+ `.test.tsx`) — new.
- `app/team/members/page.tsx` — new.
- `app/team/roles/page.tsx` — new.
- `app/team/audit/page.tsx` — new.
- Delete: `app/staff/`, `app/roles/`, `app/modules/youth-republic/audit/`, `components/StaffList.tsx(+test)`, `components/CreateStaffForm.tsx(+test)`, `components/AssignStaffOrgRoleForm.tsx(+test)`, `components/RolesList.tsx(+test)`, `components/AssignStaffModuleRoleForm.tsx(+test)`, `components/CreateCustomRoleForm.tsx(+test)`.

---

## Task 1: `globals.css` — port missing prototype classes

**Files:**
- Modify: `app/globals.css` (append at end)

**Interfaces:** Produces CSS classes `scope-pill`, `perm-tag`, `badge-system`, `badge-custom`, `role-repeater-box`, `role-repeater-row`, `perm-matrix-group`, `perm-matrix-group-title`, `perm-checkbox-row`, and `.accent-gold/.accent-green/.accent-dark/.accent-red` modifiers on `.stat-card`.

- [ ] **Step 1: Append the classes**

Add to the end of `app/globals.css` (values ported from `demos/youth-republic/prototype.html` lines 800–811, 1458–1466, 1613–1701; `--brand-tint`/`--brand-bd`/`--on-brand` already exist in this file's `:root`):

```css
/* ---- Team & Access (ported from prototype #screen-team) ---- */
.stat-card.accent-gold { border-left: 3px solid var(--brand); }
.stat-card.accent-green { border-left: 3px solid var(--st-pos-fg, #1a7f4b); }
.stat-card.accent-dark { border-left: 3px solid var(--ink); }
.stat-card.accent-red { border-left: 3px solid var(--st-neg-fg, #b42318); }

.role-chip .scope-pill,
.scope-pill {
  color: var(--ink-2);
  font-weight: 500;
  font-size: var(--text-xs);
  background: var(--bg-page);
  padding: .1rem .35rem;
  border-radius: 4px;
  border: 1px solid var(--line-subtle);
}

.perm-tag {
  display: inline-flex;
  align-items: center;
  padding: .15rem .45rem;
  background: var(--bg-page);
  border: 1px solid var(--line);
  border-radius: 4px;
  font-size: var(--text-xs);
  font-weight: 600;
}

.badge-system {
  background: var(--ink);
  color: #fff;
  font-size: var(--text-2xs);
  font-weight: 600;
  letter-spacing: .04em;
  padding: .15rem .45rem;
  border-radius: 4px;
  text-transform: uppercase;
}
.badge-custom {
  background: var(--brand-tint);
  color: var(--on-brand);
  border: 1px solid var(--brand-bd);
  font-size: var(--text-2xs);
  font-weight: 600;
  letter-spacing: .04em;
  padding: .15rem .45rem;
  border-radius: 4px;
  text-transform: uppercase;
}

.role-repeater-box {
  display: flex;
  flex-direction: column;
  gap: .65rem;
  background: var(--bg-page);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: .85rem;
}
.role-repeater-row {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: .5rem;
  align-items: center;
}

.perm-matrix-group {
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: .85rem 1rem;
  display: flex;
  flex-direction: column;
  gap: .5rem;
}
.perm-matrix-group-title {
  font-size: var(--text-sm);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: .04em;
  color: var(--ink);
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.perm-checkbox-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: var(--text-sm);
  padding: .25rem 0;
  border-bottom: 1px dashed var(--line-subtle);
}
.perm-checkbox-row:last-child { border-bottom: none; }
```

- [ ] **Step 2: Verify the app still builds**

Run: `npm run build`
Expected: build succeeds (CSS is valid; no class collisions — grep first: `grep -n "\.perm-tag\|\.badge-system\|\.role-repeater-box" app/globals.css` should show only the new block).

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "style(team): port prototype Team & Access classes into globals.css"
```

---

## Task 2: Client API layer — `capabilityMap`, `staffToken`, function wrappers

**Files:**
- Create: `lib/capabilityMap.ts`, `lib/capabilityMap.test.ts`
- Modify: `lib/staffToken.ts:1-8` (the `StaffTokenClaims` interface) and its `decodeStaffTokenClaims` mapping
- Modify: `lib/platformFunctions.ts`
- Modify: `lib/youthRepublicFunctions.ts`

**Interfaces:**
- Produces (`lib/capabilityMap.ts`):
  - `type CapabilityKey = "drive" | "publish" | "triage" | "hours" | "team"`
  - `type CapabilityLevel = "granted" | "read_only" | "restricted"`
  - `type CapabilityGrid = Record<CapabilityKey, CapabilityLevel>`
  - `const CAPABILITY_KEYS: CapabilityKey[]`
  - `const CAPABILITY_META: Record<CapabilityKey, { column: string; levels: CapabilityLevel[] }>` — `column` is the roles-table header; `levels` is the select's options in order
  - `const RESTRICTED_GRID: CapabilityGrid` — all `"restricted"`
  - `function gridToPermissionKeys(grid: CapabilityGrid): string[]`
  - `function permissionKeysToGrid(keys: string[]): CapabilityGrid`
  - `function effectivePermissionTags(permissionKeyGroups: string[][]): string[]` — union across a member's roles → prototype tag list, in this fixed order: `Create Drives`, `Publish Noticeboard`, `Triage Apps`, `Approve Hours`, `Manage Team`, `View Apps (Read Only)`, `View Hours (Read Only)`
- Produces (`lib/platformFunctions.ts`): `inviteStaffMember`, `updateStaffAccess`, `removeStaffMember`, `createCustomRole` (new shape), `updateCustomRole`, `deleteCustomRole` + their payload/response types (below).
- Produces (`lib/youthRepublicFunctions.ts`): `listChapters`, `createChapter`, `updateChapter` + types.
- Produces (`lib/staffToken.ts`): `StaffTokenClaims.moduleAccess[]` gains `chapters?: string[]`.

- [ ] **Step 1: Write the failing `capabilityMap` test**

Create `lib/capabilityMap.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  gridToPermissionKeys,
  permissionKeysToGrid,
  effectivePermissionTags,
  RESTRICTED_GRID,
  type CapabilityGrid,
} from "./capabilityMap";

describe("capabilityMap", () => {
  it("expands a grid to sorted permission keys", () => {
    const grid: CapabilityGrid = {
      drive: "granted", publish: "restricted", triage: "granted", hours: "read_only", team: "granted",
    };
    expect(gridToPermissionKeys(grid)).toEqual([
      "applications:read", "applications:update", "hours:read", "opportunities:write", "team:write",
    ]);
  });

  it("round-trips grid <-> keys", () => {
    const grid: CapabilityGrid = {
      drive: "granted", publish: "granted", triage: "read_only", hours: "restricted", team: "restricted",
    };
    expect(permissionKeysToGrid(gridToPermissionKeys(grid))).toEqual(grid);
  });

  it("RESTRICTED_GRID is all restricted", () => {
    expect(RESTRICTED_GRID).toEqual({
      drive: "restricted", publish: "restricted", triage: "restricted", hours: "restricted", team: "restricted",
    });
  });

  it("effectivePermissionTags unions across roles and orders the tags", () => {
    const opsLead = ["opportunities:write", "noticeboard:write", "applications:update", "applications:read", "hours:update", "hours:read"];
    const auditor = ["applications:read", "hours:read"];
    expect(effectivePermissionTags([opsLead, auditor])).toEqual([
      "Create Drives", "Publish Noticeboard", "Triage Apps", "Approve Hours",
    ]);
    expect(effectivePermissionTags([auditor])).toEqual([
      "View Apps (Read Only)", "View Hours (Read Only)",
    ]);
  });
});
```

- [ ] **Step 2: Run it — expect fail**

Run: `npm test -- lib/capabilityMap.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/capabilityMap.ts`**

```ts
export type CapabilityKey = "drive" | "publish" | "triage" | "hours" | "team";
export type CapabilityLevel = "granted" | "read_only" | "restricted";
export type CapabilityGrid = Record<CapabilityKey, CapabilityLevel>;

export const CAPABILITY_KEYS: CapabilityKey[] = ["drive", "publish", "triage", "hours", "team"];

export const CAPABILITY_META: Record<CapabilityKey, { column: string; levels: CapabilityLevel[] }> = {
  drive:   { column: "Drive Creation",      levels: ["granted", "restricted"] },
  publish: { column: "Publish Noticeboard", levels: ["granted", "restricted"] },
  triage:  { column: "Triage Apps",         levels: ["granted", "read_only", "restricted"] },
  hours:   { column: "Approve Hours",       levels: ["granted", "read_only", "restricted"] },
  team:    { column: "Team Management",     levels: ["granted", "restricted"] },
};

export const RESTRICTED_GRID: CapabilityGrid = {
  drive: "restricted", publish: "restricted", triage: "restricted", hours: "restricted", team: "restricted",
};

const RULES: Record<CapabilityKey, { granted: string[]; read_only: string[] }> = {
  drive:   { granted: ["opportunities:write"],                     read_only: [] },
  publish: { granted: ["noticeboard:write"],                       read_only: [] },
  triage:  { granted: ["applications:update", "applications:read"], read_only: ["applications:read"] },
  hours:   { granted: ["hours:update", "hours:read"],              read_only: ["hours:read"] },
  team:    { granted: ["team:write"],                              read_only: [] },
};

export function gridToPermissionKeys(grid: CapabilityGrid): string[] {
  const keys = new Set<string>();
  for (const cap of CAPABILITY_KEYS) {
    if (grid[cap] === "granted") RULES[cap].granted.forEach((k) => keys.add(k));
    else if (grid[cap] === "read_only") RULES[cap].read_only.forEach((k) => keys.add(k));
  }
  return [...keys].sort();
}

export function permissionKeysToGrid(keys: string[]): CapabilityGrid {
  const has = (k: string) => keys.includes(k);
  const grid = {} as CapabilityGrid;
  for (const cap of CAPABILITY_KEYS) {
    if (RULES[cap].granted.length > 0 && RULES[cap].granted.every(has)) grid[cap] = "granted";
    else if (RULES[cap].read_only.length > 0 && RULES[cap].read_only.every(has)) grid[cap] = "read_only";
    else grid[cap] = "restricted";
  }
  return grid;
}

export function effectivePermissionTags(permissionKeyGroups: string[][]): string[] {
  const all = new Set(permissionKeyGroups.flat());
  const tags: string[] = [];
  if (all.has("opportunities:write")) tags.push("Create Drives");
  if (all.has("noticeboard:write")) tags.push("Publish Noticeboard");
  if (all.has("applications:update")) tags.push("Triage Apps");
  if (all.has("hours:update")) tags.push("Approve Hours");
  if (all.has("team:write")) tags.push("Manage Team");
  if (!all.has("applications:update") && all.has("applications:read")) tags.push("View Apps (Read Only)");
  if (!all.has("hours:update") && all.has("hours:read")) tags.push("View Hours (Read Only)");
  return tags;
}
```

- [ ] **Step 4: Run it — expect pass**

Run: `npm test -- lib/capabilityMap.test.ts` → PASS (4).

- [ ] **Step 5: Add `chapters` to `StaffTokenClaims`**

In `lib/staffToken.ts`, change the `moduleAccess` member type to:
```ts
  moduleAccess: { organizationId: string; module: string; permissions: string[]; chapters?: string[] }[];
```
and in `decodeStaffTokenClaims`, in the `moduleAccess` map, add:
```ts
        chapters: Array.isArray(m.chapters) ? (m.chapters as unknown[]).map(String) : undefined,
```
If `lib/staffToken.test.ts` asserts an exact object shape, update its expected `moduleAccess` entries to include `chapters: undefined` (or use `expect.objectContaining`). Run `npm test -- lib/staffToken` → PASS.

- [ ] **Step 6: Rewrite the staff/role wrappers in `lib/platformFunctions.ts`**

Remove `CreateStaffPayload`/`CreateStaffResponse`/`createStaff`, `AssignStaffModuleRolePayload`/`AssignStaffModuleRoleResponse`/`assignStaffModuleRole`, `CreateCustomRolePayload`/`CreateCustomRoleResponse`/`createCustomRole`. Add:

```ts
import type { CapabilityGrid } from "./capabilityMap";

export interface RoleAssignmentPayload {
  roleId: string;
  scopeKind: "org_wide" | "chapter";
  chapterId?: string | null;
  scopeLabel: string;
}

export interface InviteStaffMemberPayload {
  organizationId: string;
  fullName: string;
  email: string;
  phone?: string;
  roles: RoleAssignmentPayload[];
  sendActivationEmail: boolean;
  enforce2fa: boolean;
}
export interface InviteStaffMemberResponse { staffId: string; invitationId: string }
export function inviteStaffMember(payload: InviteStaffMemberPayload, accessToken: string) {
  return callFunction<InviteStaffMemberResponse>("invite-staff-member", payload, accessToken);
}

export interface UpdateStaffAccessPayload {
  staffId: string;
  organizationId: string;
  roles: RoleAssignmentPayload[];
  status: "active" | "invited" | "deactivated";
}
export interface UpdateStaffAccessResponse { staffId: string }
export function updateStaffAccess(payload: UpdateStaffAccessPayload, accessToken: string) {
  return callFunction<UpdateStaffAccessResponse>("update-staff-access", payload, accessToken);
}

export interface RemoveStaffMemberPayload { staffId: string; organizationId: string }
export interface RemoveStaffMemberResponse { staffId: string }
export function removeStaffMember(payload: RemoveStaffMemberPayload, accessToken: string) {
  return callFunction<RemoveStaffMemberResponse>("remove-staff-member", payload, accessToken);
}

export interface CreateCustomRolePayload {
  organizationId: string;
  moduleId: string;
  name: string;
  description: string;
  capabilities: CapabilityGrid;
}
export interface CreateCustomRoleResponse { roleId: string }
export function createCustomRole(payload: CreateCustomRolePayload, accessToken: string) {
  return callFunction<CreateCustomRoleResponse>("create-custom-role", payload, accessToken);
}

export interface UpdateCustomRolePayload {
  roleId: string;
  name: string;
  description: string;
  capabilities: CapabilityGrid;
}
export interface UpdateCustomRoleResponse { roleId: string }
export function updateCustomRole(payload: UpdateCustomRolePayload, accessToken: string) {
  return callFunction<UpdateCustomRoleResponse>("update-custom-role", payload, accessToken);
}

export interface DeleteCustomRolePayload { roleId: string }
export interface DeleteCustomRoleResponse { roleId: string }
export function deleteCustomRole(payload: DeleteCustomRolePayload, accessToken: string) {
  return callFunction<DeleteCustomRoleResponse>("delete-custom-role", payload, accessToken);
}
```
Keep `assignStaffOrgRole` unchanged. If `lib/platformFunctions.test.ts` references the removed exports, delete those cases.

- [ ] **Step 7: Add chapter wrappers to `lib/youthRepublicFunctions.ts`**

Append (uses the existing `callYouthRepublicFunction` in that file):

```ts
export interface Chapter {
  id: string;
  name: string;
  institution: string | null;
  city: string | null;
  province: string | null;
  status: string;
}
export function listChapters(payload: { organizationId: string }, staffToken: string) {
  return callYouthRepublicFunction<{ chapters: Chapter[] }>("list-chapters", payload, staffToken);
}
export function createChapter(
  payload: { organizationId: string; name: string; institution?: string; city?: string; province?: string },
  staffToken: string,
) {
  return callYouthRepublicFunction<{ chapterId: string }>("create-chapter", payload, staffToken);
}
export function updateChapter(
  payload: { chapterId: string; organizationId: string; name?: string; city?: string; province?: string; institution?: string; status?: "active" | "inactive" },
  staffToken: string,
) {
  return callYouthRepublicFunction<{ chapterId: string }>("update-chapter", payload, staffToken);
}
```

- [ ] **Step 8: Run the lib test sweep**

Run: `npm test -- lib/`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add lib/capabilityMap.ts lib/capabilityMap.test.ts lib/staffToken.ts lib/platformFunctions.ts lib/youthRepublicFunctions.ts lib/staffToken.test.ts lib/platformFunctions.test.ts
git commit -m "feat(team): client capability map, chapter/staff-access function wrappers, token chapters claim"
```

---

## Task 3: `AppShell.tsx` — TEAM & ACCESS sidebar group + shell context additions

**Files:**
- Modify: `components/shell/AppShell.tsx`
- Modify: `components/shell/AppShell.test.tsx`

**Interfaces:**
- Produces: shell context value gains `isOrgAdminOrAbove: boolean` and `accessToken: string | null`; new hooks `useIsOrgAdminOrAbove()` and `useShellAccessToken()`. Sidebar renders a `TEAM & ACCESS` group with links `/team/members`, `/team/roles`, `/team/audit` when `claims && isOrgAdminOrAbove`.

- [ ] **Step 1: Widen the shell context**

In `AppShell.tsx`, extend `ShellContextValue`:
```ts
interface ShellContextValue {
  selectedOrgId: string | null;
  staffClaims: StaffTokenClaims | null;
  orgTier: string | null;
  isOrgAdminOrAbove: boolean;
  accessToken: string | null;
}
```
Update the `createContext` default (`isOrgAdminOrAbove: false, accessToken: null`), both `ShellContext.Provider value={...}` sites (the auth-page branch and the main branch) to pass `isOrgAdminOrAbove` and `accessToken` (both already exist as locals: `isOrgAdminOrAbove` is computed near the module-links memo; `accessToken` is state). Add:
```ts
export function useIsOrgAdminOrAbove() {
  return useContext(ShellContext).isOrgAdminOrAbove;
}
export function useShellAccessToken() {
  return useContext(ShellContext).accessToken;
}
```

- [ ] **Step 2: Replace the Governance & Access group**

Find the `<div className="nav-group-label" style={{ marginTop: ".75rem" }}>Governance & Access</div>` block and the two `claims && isOrgAdminOrAbove` links (`/staff`, `/roles`). Replace the label text with `Team & Access` and the two links with three:

```tsx
<div className="nav-group-label" style={{ marginTop: ".75rem" }}>Team & Access</div>

{claims && isOrgAdminOrAbove && (
  <>
    <Link href="/team/members" aria-label="Team Members"
      className={`sidebar-nav-item ${pathname === "/team/members" ? "active" : ""}`}
      onClick={() => setMobileSidebarOpen(false)}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="icon-svg flex-shrink-0" aria-hidden="true">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
      <span className="nav-label">Team Members</span>
      <span className="side-badge" aria-hidden="true" id="side-badge-team" />
    </Link>
    <Link href="/team/roles" aria-label="Roles & Permissions"
      className={`sidebar-nav-item ${pathname === "/team/roles" ? "active" : ""}`}
      onClick={() => setMobileSidebarOpen(false)}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="icon-svg flex-shrink-0" aria-hidden="true">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
      <span className="nav-label">Roles &amp; Permissions</span>
    </Link>
    <Link href="/team/audit" aria-label="Audit Log"
      className={`sidebar-nav-item ${pathname === "/team/audit" ? "active" : ""}`}
      onClick={() => setMobileSidebarOpen(false)}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="icon-svg flex-shrink-0" aria-hidden="true">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </svg>
      <span className="nav-label">Audit Log</span>
    </Link>
  </>
)}
```

(The static `side-badge` count on the Team Members link is filled by the members page via `document.getElementById("side-badge-team")` — matching how the prototype does it — or left blank; keep it simple and leave the number to the page.)

- [ ] **Step 3: Update `AppShell.test.tsx`**

Any assertion for a `/staff` or `/roles` link → change to `/team/members` and `/team/roles`; add one for `/team/audit`. Any test rendering the provider and reading context should still pass (new keys are additive). Run `npm test -- components/shell/AppShell.test.tsx` and fix assertions until green.

- [ ] **Step 4: Commit**

```bash
git add components/shell/AppShell.tsx components/shell/AppShell.test.tsx
git commit -m "feat(shell): TEAM & ACCESS sidebar group + expose admin flag and access token"
```

---

## Task 4: `app/team/layout.tsx` + `TeamAccessProvider` + `teamHeader` context

**Files:**
- Create: `app/team/layout.tsx`
- Create: `components/team/TeamAccessProvider.tsx`, `components/team/TeamAccessProvider.test.tsx`
- Create: `components/team/teamHeader.ts`

**Interfaces:**
- Produces (`teamHeader.ts`):
  - `type TeamHeaderAction = { label: string; onClick: () => void; variant: "primary" | "secondary" }`
  - `TeamHeaderContext` with `{ action: TeamHeaderAction | null; setAction: (a: TeamHeaderAction | null) => void }`
  - `useTeamHeader(): { setAction: (a: TeamHeaderAction | null) => void }` — pages call `setAction` in a `useEffect`
- Produces (`TeamAccessProvider.tsx`):
  - `interface MemberAssignment { id: string; roleId: string; roleName: string; scopeKind: "org_wide" | "chapter"; chapterId: string | null; scopeLabel: string }`
  - `interface TeamMember { id: string; fullName: string; email: string; status: "active" | "invited" | "deactivated"; lastActiveLabel: string; enforce2fa: boolean; assignments: MemberAssignment[] }`
  - `interface TeamRole { id: string; name: string; description: string | null; isSystem: boolean; permissionKeys: string[] }`
  - `interface Chapter { id: string; name: string; city: string | null; status: string }`
  - `useTeamAccess(): { organizationId: string | null; accessToken: string | null; staffToken: string | null; moduleId: string | null; members: TeamMember[]; roles: TeamRole[]; chapters: Chapter[]; loading: boolean; error: string | null; refresh: () => Promise<void> }`

- [ ] **Step 1: Write the `TeamAccessProvider` test (data shaping)**

Create `components/team/TeamAccessProvider.test.tsx`. Mock `@/lib/supabase/browserClient`, `@/lib/staffToken`, `@/lib/youthRepublicFunctions`, and `@/components/shell/AppShell` so the provider runs against fixtures:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const chaptersMock = vi.fn();
vi.mock("@/lib/youthRepublicFunctions", () => ({ listChapters: (...a: unknown[]) => chaptersMock(...a) }));
vi.mock("@/lib/staffToken", () => ({ fetchStaffToken: vi.fn().mockResolvedValue("staff-token") }));
vi.mock("@/components/shell/AppShell", () => ({
  useSelectedOrg: () => "org-1",
  useShellAccessToken: () => "access-token",
}));

const from = vi.fn();
vi.mock("@/lib/supabase/browserClient", () => ({
  getBrowserSupabaseClient: () => ({
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: "access-token" } } }) },
    from,
  }),
}));

import { TeamAccessProvider, useTeamAccess } from "./TeamAccessProvider";

function Probe() {
  const { members, roles, chapters, loading } = useTeamAccess();
  if (loading) return <div>loading</div>;
  return (
    <div>
      <span data-testid="members">{members.map((m) => `${m.fullName}:${m.assignments.length}`).join("|")}</span>
      <span data-testid="roles">{roles.map((r) => `${r.name}:${r.isSystem}`).join("|")}</span>
      <span data-testid="chapters">{chapters.map((c) => c.name).join("|")}</span>
    </div>
  );
}

function tableStub(rows: Record<string, unknown>[]) {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "eq", "in", "order", "not"]) chain[m] = () => chain;
  chain.then = (res: (v: { data: Record<string, unknown>[] }) => unknown) => res({ data: rows });
  return chain;
}

describe("TeamAccessProvider", () => {
  beforeEach(() => {
    chaptersMock.mockResolvedValue({ chapters: [{ id: "c1", name: "Lahore Chapter", city: "Lahore", status: "active" }] });
    from.mockImplementation((table: string) => {
      if (table === "modules") return tableStub([{ id: "mod-1", key: "youth-republic" }]);
      if (table === "roles") return tableStub([
        { id: "r1", name: "Operations Lead", description: "d", is_system: true, role_permissions: [{ permissions: { resource: "opportunities", action: "write" } }] },
        { id: "r2", name: "Logistics", description: "d2", is_system: false, role_permissions: [] },
      ]);
      if (table === "staff_role_assignments") return tableStub([
        { id: "a1", staff_id: "s1", role_id: "r1", scope_kind: "org_wide", chapter_id: null, scope_label: "National / All Chapters" },
      ]);
      if (table === "staff") return tableStub([
        { id: "s1", full_name: "Amina Malik", email: "amina@x.org", status: "active", deactivated_at: null },
      ]);
      if (table === "staff_invitations") return tableStub([]);
      return tableStub([]);
    });
  });

  it("joins staff, assignments, roles, and chapters into typed collections", async () => {
    render(<TeamAccessProvider><Probe /></TeamAccessProvider>);
    await waitFor(() => expect(screen.queryByText("loading")).not.toBeInTheDocument());
    expect(screen.getByTestId("members")).toHaveTextContent("Amina Malik:1");
    expect(screen.getByTestId("roles")).toHaveTextContent("Operations Lead:true");
    expect(screen.getByTestId("chapters")).toHaveTextContent("Lahore Chapter");
  });
});
```

- [ ] **Step 2: Run it — expect fail**

Run: `npm test -- components/team/TeamAccessProvider.test.tsx` → FAIL (module missing).

- [ ] **Step 3: Implement `components/team/TeamAccessProvider.tsx`**

```tsx
"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { fetchStaffToken } from "@/lib/staffToken";
import { useSelectedOrg, useShellAccessToken } from "@/components/shell/AppShell";
import { listChapters } from "@/lib/youthRepublicFunctions";

export interface MemberAssignment {
  id: string;
  roleId: string;
  roleName: string;
  scopeKind: "org_wide" | "chapter";
  chapterId: string | null;
  scopeLabel: string;
}
export interface TeamMember {
  id: string;
  fullName: string;
  email: string;
  status: "active" | "invited" | "deactivated";
  lastActiveLabel: string;
  enforce2fa: boolean;
  assignments: MemberAssignment[];
}
export interface TeamRole {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissionKeys: string[];
}
export interface Chapter {
  id: string;
  name: string;
  city: string | null;
  status: string;
}

interface TeamAccessValue {
  organizationId: string | null;
  accessToken: string | null;
  staffToken: string | null;
  moduleId: string | null;
  members: TeamMember[];
  roles: TeamRole[];
  chapters: Chapter[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const TeamAccessContext = createContext<TeamAccessValue>({
  organizationId: null, accessToken: null, staffToken: null, moduleId: null,
  members: [], roles: [], chapters: [], loading: true, error: null, refresh: async () => {},
});

export function useTeamAccess() {
  return useContext(TeamAccessContext);
}

export function TeamAccessProvider({ children }: { children: React.ReactNode }) {
  const organizationId = useSelectedOrg();
  const accessToken = useShellAccessToken();
  const [staffToken, setStaffToken] = useState<string | null>(null);
  const [moduleId, setModuleId] = useState<string | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [roles, setRoles] = useState<TeamRole[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    setError(null);
    try {
      const supabase = getBrowserSupabaseClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token ?? null;
      const st = token ? await fetchStaffToken(token) : null;
      setStaffToken(st);

      const { data: moduleRow } = await supabase.from("modules").select("id").eq("key", "youth-republic").single();
      const modId = (moduleRow?.id as string) ?? null;
      setModuleId(modId);

      const { data: roleRows } = await supabase
        .from("roles")
        .select("id, name, description, is_system, role_permissions(permissions(resource, action))")
        .eq("organization_id", organizationId)
        .eq("module_id", modId);
      const typedRoles: TeamRole[] = (roleRows ?? []).map((r) => ({
        id: r.id as string,
        name: r.name as string,
        description: (r.description as string) ?? null,
        isSystem: Boolean(r.is_system),
        permissionKeys: ((r.role_permissions ?? []) as Array<{ permissions: { resource: string; action: string } }>)
          .map((rp) => `${rp.permissions.resource}:${rp.permissions.action}`),
      }));
      setRoles(typedRoles);
      const roleById = new Map(typedRoles.map((r) => [r.id, r]));

      const { data: assignmentRows } = await supabase
        .from("staff_role_assignments")
        .select("id, staff_id, role_id, scope_kind, chapter_id, scope_label")
        .eq("organization_id", organizationId)
        .eq("module_id", modId);
      const assignmentsByStaff = new Map<string, MemberAssignment[]>();
      for (const a of assignmentRows ?? []) {
        const list = assignmentsByStaff.get(a.staff_id as string) ?? [];
        list.push({
          id: a.id as string,
          roleId: a.role_id as string,
          roleName: roleById.get(a.role_id as string)?.name ?? "Unknown role",
          scopeKind: a.scope_kind as "org_wide" | "chapter",
          chapterId: (a.chapter_id as string) ?? null,
          scopeLabel: a.scope_label as string,
        });
        assignmentsByStaff.set(a.staff_id as string, list);
      }

      const staffIds = [...assignmentsByStaff.keys()];
      let staffRows: Array<Record<string, unknown>> = [];
      if (staffIds.length > 0) {
        const { data } = await supabase
          .from("staff")
          .select("id, full_name, email, status, deactivated_at")
          .in("id", staffIds);
        staffRows = data ?? [];
      }
      const { data: inviteRows } = await supabase
        .from("staff_invitations")
        .select("staff_id, enforce_2fa, status")
        .eq("organization_id", organizationId);
      const enforce2faByStaff = new Map(
        (inviteRows ?? []).map((i) => [i.staff_id as string, Boolean(i.enforce_2fa)]),
      );

      setMembers(staffRows.map((s) => ({
        id: s.id as string,
        fullName: s.full_name as string,
        email: s.email as string,
        status: s.status as "active" | "invited" | "deactivated",
        lastActiveLabel: s.status === "invited" ? "Invited (Pending Sign-in)" : "—",
        enforce2fa: enforce2faByStaff.get(s.id as string) ?? true,
        assignments: assignmentsByStaff.get(s.id as string) ?? [],
      })));

      if (st) {
        try {
          const res = await listChapters({ organizationId }, st);
          setChapters(res.chapters.map((c) => ({ id: c.id, name: c.name, city: c.city, status: c.status })));
        } catch {
          setChapters([]);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "load_failed");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => { refresh(); }, [refresh]);

  const value = useMemo<TeamAccessValue>(() => ({
    organizationId, accessToken, staffToken, moduleId, members, roles, chapters, loading, error, refresh,
  }), [organizationId, accessToken, staffToken, moduleId, members, roles, chapters, loading, error, refresh]);

  return <TeamAccessContext.Provider value={value}>{children}</TeamAccessContext.Provider>;
}
```

- [ ] **Step 4: Run the test — expect pass**

Run: `npm test -- components/team/TeamAccessProvider.test.tsx` → PASS. (If the Supabase mock chain in the test needs `.single()` support, add `chain.single = () => chain` in `tableStub` and have `.then` resolve `{ data: rows[0] ?? null }` when `single` was called — adjust the stub, not the provider.)

- [ ] **Step 5: Implement `components/team/teamHeader.ts`**

```ts
"use client";

import { createContext, useContext } from "react";

export interface TeamHeaderAction {
  label: string;
  onClick: () => void;
  variant: "primary" | "secondary";
}

export const TeamHeaderContext = createContext<{
  action: TeamHeaderAction | null;
  setAction: (a: TeamHeaderAction | null) => void;
}>({ action: null, setAction: () => {} });

export function useTeamHeader() {
  const { setAction } = useContext(TeamHeaderContext);
  return { setAction };
}
```

- [ ] **Step 6: Implement `app/team/layout.tsx`**

```tsx
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useIsOrgAdminOrAbove } from "@/components/shell/AppShell";
import { TeamAccessProvider } from "@/components/team/TeamAccessProvider";
import { TeamDrawersProvider } from "@/components/team/TeamDrawers";
import { TeamHeaderContext, type TeamHeaderAction } from "@/components/team/teamHeader";

const TABS = [
  { href: "/team/members", label: "Team Members" },
  { href: "/team/roles", label: "Roles & Permissions" },
  { href: "/team/audit", label: "Audit Log" },
];

const HEADINGS: Record<string, { title: string; subtitle: string }> = {
  "/team/members": {
    title: "Team Members Directory",
    subtitle: "Manage administrative team members, multi-role assignments, and chapter operational scopes.",
  },
  "/team/roles": {
    title: "Roles & Permissions Matrix",
    subtitle: "Configure granular capability privileges and operational access boundaries for system and custom roles.",
  },
  "/team/audit": {
    title: "Security & Operational Audit Log",
    subtitle: "Complete immutable chronological record of team administrative operations, role modifications, and security events.",
  },
};

export default function TeamLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/team/members";
  const isAdmin = useIsOrgAdminOrAbove();
  const [action, setAction] = useState<TeamHeaderAction | null>(null);
  const heading = HEADINGS[pathname] ?? HEADINGS["/team/members"];
  const headerValue = useMemo(() => ({ action, setAction }), [action]);

  if (!isAdmin) {
    return (
      <div className="panel p-8 text-center">
        <p className="text-[var(--ink-2)] font-medium">
          You need organization admin access to manage the team.
        </p>
      </div>
    );
  }

  return (
    <TeamAccessProvider>
      <TeamDrawersProvider>
        <TeamHeaderContext.Provider value={headerValue}>
          <div className="space-y-6">
            <div className="page-header">
              <div>
                <h1 className="page-title">{heading.title}</h1>
                <div className="page-subtitle">{heading.subtitle}</div>
              </div>
              {action && (
                <div className="page-toolbar">
                  <button
                    type="button"
                    className={`btn btn-${action.variant} btn-sm`}
                    onClick={action.onClick}
                  >
                    {action.label}
                  </button>
                </div>
              )}
            </div>

            <nav className="module-nav-bar -mx-8 -mt-2 border-b border-[var(--line)] bg-white">
              <div className="module-nav-wrap">
                {TABS.map((tab) => (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    className={`module-tab ${pathname === tab.href ? "active" : ""}`}
                  >
                    <span>{tab.label}</span>
                  </Link>
                ))}
              </div>
            </nav>

            {children}
          </div>
        </TeamHeaderContext.Provider>
      </TeamDrawersProvider>
    </TeamAccessProvider>
  );
}
```

(`TeamDrawersProvider` is created in Task 5; until then, temporarily wrap with a passthrough `({children}) => <>{children}</>` and swap it in Task 5 Step 4.)

- [ ] **Step 7: Commit**

```bash
git add app/team/layout.tsx components/team/TeamAccessProvider.tsx components/team/TeamAccessProvider.test.tsx components/team/teamHeader.ts
git commit -m "feat(team): /team layout, shared data provider, contextual header slot"
```

---

## Task 5: `RoleScopeRepeater` + `TeamDrawers` shell + `StatCard`

**Files:**
- Create: `components/team/StatCard.tsx`
- Create: `components/team/RoleScopeRepeater.tsx`, `components/team/RoleScopeRepeater.test.tsx`
- Create: `components/team/TeamDrawers.tsx`
- Modify: `app/team/layout.tsx` (swap in the real `TeamDrawersProvider`)

**Interfaces:**
- Produces (`StatCard.tsx`): `function StatCard(props: { accent: "gold" | "green" | "dark" | "red"; label: string; value: string; sub: string }): JSX.Element`
- Produces (`RoleScopeRepeater.tsx`):
  - `interface RoleScopeRow { key: string; roleId: string; scopeKind: "org_wide" | "chapter"; chapterId: string | null; scopeLabel: string }`
  - `function makeRoleScopeRow(roleId: string): RoleScopeRow`
  - `function RoleScopeRepeater(props: { rows: RoleScopeRow[]; roles: { id: string; name: string; isSystem: boolean }[]; chapters: { id: string; name: string }[]; onChange: (rows: RoleScopeRow[]) => void; addLabel: string }): JSX.Element`
  - `function rowsToAssignmentPayload(rows: RoleScopeRow[]): { roleId: string; scopeKind: "org_wide" | "chapter"; chapterId: string | null; scopeLabel: string }[]`
- Produces (`TeamDrawers.tsx`):
  - `function TeamDrawersProvider({ children }): JSX.Element` — mounts `<InviteMemberDrawer/>`, `<EditMemberDrawer/>`, `<RoleDrawer/>`
  - `useTeamDrawers(): { openInvite: () => void; openEditMember: (memberId: string) => void; openCreateRole: () => void; openEditRole: (roleId: string, readOnly: boolean) => void; openCloneRole: (roleId: string) => void }`

- [ ] **Step 1: Implement `StatCard.tsx`**

```tsx
export function StatCard(
  { accent, label, value, sub }: { accent: "gold" | "green" | "dark" | "red"; label: string; value: string; sub: string },
) {
  return (
    <div className={`stat-card accent-${accent}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-sub">{sub}</div>
    </div>
  );
}
```

- [ ] **Step 2: Write the `RoleScopeRepeater` failing test**

Create `components/team/RoleScopeRepeater.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { RoleScopeRepeater, makeRoleScopeRow, rowsToAssignmentPayload, type RoleScopeRow } from "./RoleScopeRepeater";

const roles = [
  { id: "r1", name: "Operations Lead", isSystem: true },
  { id: "r2", name: "Regional Logistics Lead", isSystem: false },
];
const chapters = [{ id: "c1", name: "Lahore Chapter" }, { id: "c2", name: "Karachi Chapter" }];

describe("RoleScopeRepeater", () => {
  it("adds and removes rows and reports changes", async () => {
    const user = userEvent.setup();
    let rows: RoleScopeRow[] = [makeRoleScopeRow("r1")];
    const onChange = vi.fn((next: RoleScopeRow[]) => { rows = next; });
    const { rerender } = render(
      <RoleScopeRepeater rows={rows} roles={roles} chapters={chapters} onChange={onChange} addLabel="+ Add Role" />,
    );
    await user.click(screen.getByRole("button", { name: "+ Add Role" }));
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls.at(-1)![0]).toHaveLength(2);

    rerender(
      <RoleScopeRepeater rows={onChange.mock.calls.at(-1)![0]} roles={roles} chapters={chapters} onChange={onChange} addLabel="+ Add Role" />,
    );
    const removeButtons = screen.getAllByRole("button", { name: /remove/i });
    await user.click(removeButtons[0]);
    expect(onChange.mock.calls.at(-1)![0]).toHaveLength(1);
  });

  it("maps rows to an assignment payload with resolved scope labels", () => {
    const rows: RoleScopeRow[] = [
      { key: "k1", roleId: "r1", scopeKind: "org_wide", chapterId: null, scopeLabel: "National / All Chapters" },
      { key: "k2", roleId: "r2", scopeKind: "chapter", chapterId: "c1", scopeLabel: "Lahore Chapter" },
    ];
    expect(rowsToAssignmentPayload(rows)).toEqual([
      { roleId: "r1", scopeKind: "org_wide", chapterId: null, scopeLabel: "National / All Chapters" },
      { roleId: "r2", scopeKind: "chapter", chapterId: "c1", scopeLabel: "Lahore Chapter" },
    ]);
  });
});
```

- [ ] **Step 3: Run it — expect fail; then implement `RoleScopeRepeater.tsx`**

```tsx
"use client";

const ORG_WIDE_LABEL = "National / All Chapters";

export interface RoleScopeRow {
  key: string;
  roleId: string;
  scopeKind: "org_wide" | "chapter";
  chapterId: string | null;
  scopeLabel: string;
}

export function makeRoleScopeRow(roleId: string): RoleScopeRow {
  return {
    key: crypto.randomUUID(),
    roleId,
    scopeKind: "org_wide",
    chapterId: null,
    scopeLabel: ORG_WIDE_LABEL,
  };
}

export function rowsToAssignmentPayload(rows: RoleScopeRow[]) {
  return rows.map((r) => ({
    roleId: r.roleId,
    scopeKind: r.scopeKind,
    chapterId: r.scopeKind === "chapter" ? r.chapterId : null,
    scopeLabel: r.scopeLabel,
  }));
}

export function RoleScopeRepeater({
  rows, roles, chapters, onChange, addLabel,
}: {
  rows: RoleScopeRow[];
  roles: { id: string; name: string; isSystem: boolean }[];
  chapters: { id: string; name: string }[];
  onChange: (rows: RoleScopeRow[]) => void;
  addLabel: string;
}) {
  function update(idx: number, patch: Partial<RoleScopeRow>) {
    onChange(rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }
  function setScope(idx: number, value: string) {
    if (value === "org_wide") {
      update(idx, { scopeKind: "org_wide", chapterId: null, scopeLabel: ORG_WIDE_LABEL });
    } else {
      const chapter = chapters.find((c) => c.id === value);
      update(idx, { scopeKind: "chapter", chapterId: value, scopeLabel: chapter?.name ?? "Chapter" });
    }
  }

  return (
    <div className="role-repeater-box">
      {rows.map((row, idx) => (
        <div className="role-repeater-row" key={row.key}>
          <select
            className="form-select"
            value={row.roleId}
            onChange={(e) => update(idx, { roleId: e.target.value })}
          >
            {roles.map((r) => (
              <option key={r.id} value={r.id}>{r.name}{r.isSystem ? "" : " (Custom)"}</option>
            ))}
          </select>
          <select
            className="form-select"
            value={row.scopeKind === "org_wide" ? "org_wide" : (row.chapterId ?? "")}
            onChange={(e) => setScope(idx, e.target.value)}
          >
            <option value="org_wide">{ORG_WIDE_LABEL}</option>
            {chapters.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {rows.length > 1 ? (
            <button
              type="button"
              className="btn btn-secondary btn-xs"
              aria-label="Remove role"
              onClick={() => onChange(rows.filter((_, i) => i !== idx))}
            >
              ✕
            </button>
          ) : <div />}
        </div>
      ))}
      <div>
        <button
          type="button"
          className="btn btn-secondary btn-xs"
          onClick={() => onChange([...rows, makeRoleScopeRow(roles[0]?.id ?? "")])}
        >
          {addLabel}
        </button>
      </div>
    </div>
  );
}
```

Run: `npm test -- components/team/RoleScopeRepeater.test.tsx` → PASS.

- [ ] **Step 4: Implement `TeamDrawers.tsx` (shell only; drawer bodies land in Tasks 6/7/9)**

```tsx
"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { InviteMemberDrawer } from "./InviteMemberDrawer";
import { EditMemberDrawer } from "./EditMemberDrawer";
import { RoleDrawer } from "./RoleDrawer";

interface DrawerState {
  invite: boolean;
  editMemberId: string | null;
  role: { mode: "create" | "edit" | "view" | "clone"; roleId: string | null } | null;
}

interface TeamDrawersValue {
  openInvite: () => void;
  openEditMember: (memberId: string) => void;
  openCreateRole: () => void;
  openEditRole: (roleId: string, readOnly: boolean) => void;
  openCloneRole: (roleId: string) => void;
  close: () => void;
  state: DrawerState;
}

const TeamDrawersContext = createContext<TeamDrawersValue | null>(null);

export function useTeamDrawers() {
  const ctx = useContext(TeamDrawersContext);
  if (!ctx) throw new Error("useTeamDrawers must be used inside TeamDrawersProvider");
  return ctx;
}

export function TeamDrawersProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DrawerState>({ invite: false, editMemberId: null, role: null });
  const close = useCallback(() => setState({ invite: false, editMemberId: null, role: null }), []);

  const value = useMemo<TeamDrawersValue>(() => ({
    openInvite: () => setState({ invite: true, editMemberId: null, role: null }),
    openEditMember: (memberId) => setState({ invite: false, editMemberId: memberId, role: null }),
    openCreateRole: () => setState({ invite: false, editMemberId: null, role: { mode: "create", roleId: null } }),
    openEditRole: (roleId, readOnly) =>
      setState({ invite: false, editMemberId: null, role: { mode: readOnly ? "view" : "edit", roleId } }),
    openCloneRole: (roleId) =>
      setState({ invite: false, editMemberId: null, role: { mode: "clone", roleId } }),
    close,
    state,
  }), [state, close]);

  return (
    <TeamDrawersContext.Provider value={value}>
      {children}
      <InviteMemberDrawer open={state.invite} onClose={close} />
      <EditMemberDrawer memberId={state.editMemberId} onClose={close} />
      <RoleDrawer request={state.role} onClose={close} />
    </TeamDrawersContext.Provider>
  );
}
```

Create minimal stub files so the build passes now; real bodies in later tasks:
- `components/team/InviteMemberDrawer.tsx`: `export function InviteMemberDrawer(_: { open: boolean; onClose: () => void }) { return null; }`
- `components/team/EditMemberDrawer.tsx`: `export function EditMemberDrawer(_: { memberId: string | null; onClose: () => void }) { return null; }`
- `components/team/RoleDrawer.tsx`: `export function RoleDrawer(_: { request: { mode: "create" | "edit" | "view" | "clone"; roleId: string | null } | null; onClose: () => void }) { return null; }`

Now edit `app/team/layout.tsx` to import the real `TeamDrawersProvider` from `@/components/team/TeamDrawers` (remove the passthrough).

- [ ] **Step 5: Build check**

Run: `npm run build` → succeeds.

- [ ] **Step 6: Commit**

```bash
git add components/team/StatCard.tsx components/team/RoleScopeRepeater.tsx components/team/RoleScopeRepeater.test.tsx components/team/TeamDrawers.tsx components/team/InviteMemberDrawer.tsx components/team/EditMemberDrawer.tsx components/team/RoleDrawer.tsx app/team/layout.tsx
git commit -m "feat(team): stat card, role/scope repeater, drawer provider shell"
```

---

## Task 6: `/team/members` page + `MembersTable`

**Files:**
- Create: `components/team/MembersTable.tsx`, `components/team/MembersTable.test.tsx`
- Create: `app/team/members/page.tsx`

**Interfaces:**
- Consumes: `useTeamAccess`, `useTeamHeader`, `useTeamDrawers`, `effectivePermissionTags` (Task 2), `StatCard`.
- Produces (`MembersTable.tsx`): `function MembersTable(props: { members: TeamMember[]; roles: TeamRole[]; chapters: Chapter[]; onEdit: (memberId: string) => void }): JSX.Element` — renders search + role/scope/status filters + the data table; filtering is internal state.

- [ ] **Step 1: Write the failing `MembersTable` test**

Create `components/team/MembersTable.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { MembersTable } from "./MembersTable";
import type { TeamMember, TeamRole, Chapter } from "./TeamAccessProvider";

const roles: TeamRole[] = [
  { id: "r1", name: "Operations Lead", description: "", isSystem: true, permissionKeys: ["opportunities:write", "applications:update"] },
  { id: "r2", name: "Auditor", description: "", isSystem: true, permissionKeys: ["applications:read", "hours:read"] },
];
const chapters: Chapter[] = [{ id: "c1", name: "Lahore Chapter", city: "Lahore", status: "active" }];
const members: TeamMember[] = [
  { id: "m1", fullName: "Amina Malik", email: "amina@x.org", status: "active", lastActiveLabel: "—", enforce2fa: true,
    assignments: [{ id: "a1", roleId: "r1", roleName: "Operations Lead", scopeKind: "chapter", chapterId: "c1", scopeLabel: "Lahore Chapter" }] },
  { id: "m2", fullName: "Usman Ghani", email: "usman@x.org", status: "invited", lastActiveLabel: "Invited (Pending Sign-in)", enforce2fa: true,
    assignments: [{ id: "a2", roleId: "r2", roleName: "Auditor", scopeKind: "org_wide", chapterId: null, scopeLabel: "National / All Chapters" }] },
];

describe("MembersTable", () => {
  it("renders role chips, scope pills, and computed effective permissions", () => {
    render(<MembersTable members={members} roles={roles} chapters={chapters} onEdit={vi.fn()} />);
    expect(screen.getByText("Amina Malik")).toBeInTheDocument();
    expect(screen.getByText("Lahore Chapter")).toBeInTheDocument();
    expect(screen.getByText("Create Drives")).toBeInTheDocument();
    expect(screen.getByText("Triage Apps")).toBeInTheDocument();
    expect(screen.getByText("View Hours (Read Only)")).toBeInTheDocument();
  });

  it("filters by status", async () => {
    const user = userEvent.setup();
    render(<MembersTable members={members} roles={roles} chapters={chapters} onEdit={vi.fn()} />);
    await user.selectOptions(screen.getByLabelText("Status filter"), "invited");
    expect(screen.queryByText("Amina Malik")).not.toBeInTheDocument();
    expect(screen.getByText("Usman Ghani")).toBeInTheDocument();
  });

  it("calls onEdit with the member id", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(<MembersTable members={members} roles={roles} chapters={chapters} onEdit={onEdit} />);
    await user.click(screen.getAllByRole("button", { name: /edit access/i })[0]);
    expect(onEdit).toHaveBeenCalledWith("m1");
  });
});
```

- [ ] **Step 2: Run it — expect fail; then implement `MembersTable.tsx`**

```tsx
"use client";

import { useMemo, useState } from "react";
import { effectivePermissionTags } from "@/lib/capabilityMap";
import type { Chapter, TeamMember, TeamRole } from "./TeamAccessProvider";

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

export function MembersTable({
  members, roles, chapters, onEdit,
}: {
  members: TeamMember[];
  roles: TeamRole[];
  chapters: Chapter[];
  onEdit: (memberId: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [scopeFilter, setScopeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const permKeysByRoleId = useMemo(
    () => new Map(roles.map((r) => [r.id, r.permissionKeys])),
    [roles],
  );
  const chapterNameById = useMemo(
    () => new Map(chapters.map((c) => [c.id, c.name])),
    [chapters],
  );

  const filtered = members.filter((m) => {
    const q = search.toLowerCase().trim();
    const matchSearch = !q
      || m.fullName.toLowerCase().includes(q)
      || m.email.toLowerCase().includes(q)
      || m.assignments.some((a) => a.roleName.toLowerCase().includes(q) || a.scopeLabel.toLowerCase().includes(q));
    const matchRole = roleFilter === "all" || m.assignments.some((a) => a.roleName === roleFilter);
    const matchScope = scopeFilter === "all"
      || m.assignments.some((a) => (a.scopeKind === "org_wide" ? "org_wide" : a.chapterId) === scopeFilter);
    const matchStatus = statusFilter === "all" || m.status === statusFilter;
    return matchSearch && matchRole && matchScope && matchStatus;
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="search-input"
          placeholder="Search member name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select aria-label="Role filter" className="filter-select" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="all">All Roles</option>
          {roles.map((r) => (
            <option key={r.id} value={r.name}>{r.name}{r.isSystem ? "" : " (Custom)"}</option>
          ))}
        </select>
        <select aria-label="Scope filter" className="filter-select" value={scopeFilter} onChange={(e) => setScopeFilter(e.target.value)}>
          <option value="all">All Scopes / Chapters</option>
          <option value="org_wide">National / All Chapters</option>
          {chapters.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select aria-label="Status filter" className="filter-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All Statuses</option>
          <option value="active">Active &amp; Verified</option>
          <option value="invited">Pending Invitation</option>
        </select>
      </div>

      <div className="table-card">
        <div className="table-responsive-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Member Name &amp; Email</th>
                <th>Assigned Roles &amp; Scopes</th>
                <th>Effective Permissions</th>
                <th>Last Active</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "2.5rem", color: "var(--ink-3)" }}>
                    No team members found matching your search filter criteria.
                  </td>
                </tr>
              ) : filtered.map((m) => {
                const tags = effectivePermissionTags(m.assignments.map((a) => permKeysByRoleId.get(a.roleId) ?? []));
                return (
                  <tr key={m.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: ".65rem" }}>
                        <div className="avatar" style={{ width: 28, height: 28, fontSize: "var(--text-xs)" }}>{initials(m.fullName)}</div>
                        <div>
                          <div style={{ fontWeight: 600 }}>{m.fullName}</div>
                          <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-2)" }}>{m.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: ".35rem" }}>
                        {m.assignments.map((a) => (
                          <span className="role-chip" key={a.id}>
                            <span>{a.roleName}</span>
                            <span className="scope-pill">
                              {a.chapterId ? (chapterNameById.get(a.chapterId) ?? a.scopeLabel) : a.scopeLabel}
                            </span>
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: ".25rem", maxWidth: 280 }}>
                        {tags.map((t) => <span className="perm-tag" key={t}>{t}</span>)}
                      </div>
                    </td>
                    <td><span style={{ fontSize: "var(--text-sm)", color: "var(--ink-2)" }}>{m.lastActiveLabel}</span></td>
                    <td>
                      <span className={`badge ${m.status === "active" ? "badge-pos" : m.status === "invited" ? "badge-pend" : "badge-neg"}`}>
                        {m.status === "active" ? "Active" : m.status === "invited" ? "Pending Invite" : "Suspended"}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button type="button" className="btn btn-secondary btn-xs" onClick={() => onEdit(m.id)}>
                        Edit Access
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
```

Run: `npm test -- components/team/MembersTable.test.tsx` → PASS (3).

- [ ] **Step 3: Implement `app/team/members/page.tsx`**

```tsx
"use client";

import { useEffect, useMemo } from "react";
import { useTeamAccess } from "@/components/team/TeamAccessProvider";
import { useTeamHeader } from "@/components/team/teamHeader";
import { useTeamDrawers } from "@/components/team/TeamDrawers";
import { MembersTable } from "@/components/team/MembersTable";
import { StatCard } from "@/components/team/StatCard";

const LEAD_ROLES = ["Operations Lead", "Drive Coordinator", "Regional Logistics Lead"];
const REVIEWER_ROLES = ["Application Reviewer", "Auditor"];
const ADMIN_ROLES = ["Super Admin"];

export default function TeamMembersPage() {
  const { members, roles, chapters, loading } = useTeamAccess();
  const { setAction } = useTeamHeader();
  const { openInvite, openEditMember } = useTeamDrawers();

  useEffect(() => {
    setAction({ label: "Invite Team Member", onClick: openInvite, variant: "primary" });
    return () => setAction(null);
  }, [setAction, openInvite]);

  const stats = useMemo(() => {
    const active = members.filter((m) => m.status === "active");
    const invited = members.filter((m) => m.status === "invited");
    const multi = members.filter((m) => m.assignments.length > 1);
    const bucket = (names: string[]) =>
      active.filter((m) => m.assignments.some((a) => names.includes(a.roleName))).length;
    const twoFa = active.length === 0 ? 100 : Math.round((active.filter((m) => m.enforce2fa).length / active.length) * 100);
    return {
      activeCount: active.length,
      activeSub: `${bucket(ADMIN_ROLES)} Admins · ${bucket(LEAD_ROLES)} Leads · ${bucket(REVIEWER_ROLES)} Reviewers`,
      invitedCount: invited.length,
      multiCount: multi.length,
      twoFa,
    };
  }, [members]);

  if (loading) return <p className="p-8 text-center text-[var(--ink-3)]">Loading team directory…</p>;

  return (
    <div className="flex flex-col gap-6">
      <div className="stat-grid">
        <StatCard accent="gold" label="Active Team" value={`${stats.activeCount} Members`} sub={stats.activeSub} />
        <StatCard accent="dark" label="Pending Invitations" value={`${stats.invitedCount} Sent`} sub="Awaiting account activation" />
        <StatCard accent="green" label="Multi-Role Staff" value={`${stats.multiCount} Members`} sub="Cross-functional chapter assignments" />
        <StatCard accent="red" label="2FA Compliance" value={`${stats.twoFa}%`} sub="Strict security enforcement" />
      </div>
      <MembersTable members={members} roles={roles} chapters={chapters} onEdit={openEditMember} />
    </div>
  );
}
```

- [ ] **Step 4: Manual smoke + build**

Run: `npm run build`. Then `npm run dev`, sign in as an org admin, open `/team/members` — expect the stat cards, filters, and the member rows with role chips + effective-permission tags. (Verified further after Tasks 7–11 via the Browser pane in Task 12.)

- [ ] **Step 5: Commit**

```bash
git add components/team/MembersTable.tsx components/team/MembersTable.test.tsx app/team/members/page.tsx
git commit -m "feat(team): members directory page + table with computed effective permissions"
```

---

## Task 7: `InviteMemberDrawer` + `EditMemberDrawer`

**Files:**
- Rewrite: `components/team/InviteMemberDrawer.tsx` (+ new `.test.tsx`)
- Rewrite: `components/team/EditMemberDrawer.tsx` (+ new `.test.tsx`)

**Interfaces:**
- Consumes: `useTeamAccess`, `RoleScopeRepeater` + `makeRoleScopeRow` + `rowsToAssignmentPayload`, `inviteStaffMember` / `updateStaffAccess` / `removeStaffMember` from `@/lib/platformFunctions`, `effectivePermissionTags`, `useToast`.
- Produces: `InviteMemberDrawer({ open, onClose })`, `EditMemberDrawer({ memberId, onClose })` — unchanged prop signatures from the Task 5 stubs.

- [ ] **Step 1: Write the `InviteMemberDrawer` failing test**

Create `components/team/InviteMemberDrawer.test.tsx`. Mock `@/components/team/TeamAccessProvider` (`useTeamAccess`), `@/lib/platformFunctions` (`inviteStaffMember`), `@/components/shell/ToastContext` (`useToast`):

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

const invite = vi.fn().mockResolvedValue({ staffId: "s9", invitationId: "i9" });
const refresh = vi.fn();
const showToast = vi.fn();
vi.mock("@/lib/platformFunctions", () => ({ inviteStaffMember: (...a: unknown[]) => invite(...a) }));
vi.mock("@/components/shell/ToastContext", () => ({ useToast: () => ({ showToast }) }));
vi.mock("@/components/team/TeamAccessProvider", () => ({
  useTeamAccess: () => ({
    organizationId: "org-1",
    accessToken: "access-token",
    moduleId: "mod-1",
    roles: [
      { id: "r1", name: "Operations Lead", isSystem: true, description: "", permissionKeys: [] },
      { id: "r2", name: "Auditor", isSystem: true, description: "", permissionKeys: [] },
    ],
    chapters: [{ id: "c1", name: "Lahore Chapter", city: "Lahore", status: "active" }],
    refresh,
  }),
}));

import { InviteMemberDrawer } from "./InviteMemberDrawer";

describe("InviteMemberDrawer", () => {
  beforeEach(() => vi.clearAllMocks());

  it("submits name, email, and role/scope rows then refreshes and closes", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<InviteMemberDrawer open onClose={onClose} />);

    await user.type(screen.getByLabelText(/Full Name/i), "Tariq Mehmood");
    await user.type(screen.getByLabelText(/Work Email/i), "tariq@x.org");
    await user.click(screen.getByRole("button", { name: /Send Official Invitation/i }));

    await waitFor(() => expect(invite).toHaveBeenCalledTimes(1));
    const [payload, token] = invite.mock.calls[0];
    expect(token).toBe("access-token");
    expect(payload).toMatchObject({
      organizationId: "org-1", fullName: "Tariq Mehmood", email: "tariq@x.org",
      sendActivationEmail: true, enforce2fa: true,
    });
    expect(payload.roles).toHaveLength(1);
    expect(payload.roles[0]).toMatchObject({ roleId: "r1", scopeKind: "org_wide" });
    expect(refresh).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("blocks submit with no name/email", async () => {
    const user = userEvent.setup();
    render(<InviteMemberDrawer open onClose={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /Send Official Invitation/i }));
    expect(invite).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith("Please enter candidate full name and work email.");
  });
});
```

- [ ] **Step 2: Run it — expect fail; then implement `InviteMemberDrawer.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useTeamAccess } from "./TeamAccessProvider";
import { useToast } from "@/components/shell/ToastContext";
import { inviteStaffMember } from "@/lib/platformFunctions";
import { RoleScopeRepeater, makeRoleScopeRow, rowsToAssignmentPayload, type RoleScopeRow } from "./RoleScopeRepeater";

export function InviteMemberDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { organizationId, accessToken, roles, chapters, refresh } = useTeamAccess();
  const { showToast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [enforce2fa, setEnforce2fa] = useState(true);
  const [rows, setRows] = useState<RoleScopeRow[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setName(""); setEmail(""); setPhone(""); setSendEmail(true); setEnforce2fa(true);
      setRows([makeRoleScopeRow(roles[0]?.id ?? "")]);
    }
  }, [open, roles]);

  async function submit() {
    if (!name.trim() || !email.trim()) {
      showToast("Please enter candidate full name and work email.");
      return;
    }
    if (!organizationId || !accessToken) return;
    setBusy(true);
    try {
      await inviteStaffMember({
        organizationId,
        fullName: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        roles: rowsToAssignmentPayload(rows),
        sendActivationEmail: sendEmail,
        enforce2fa,
      }, accessToken);
      await refresh();
      showToast(`Invitation sent to ${name.trim()} with ${rows.length} role assignment(s).`);
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to send invitation.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className={`drawer-backdrop ${open ? "open" : ""}`} onClick={onClose} />
      <div className={`drawer ${open ? "open" : ""}`} style={{ maxWidth: 580 }}>
        <div className="drawer-header">
          <div>
            <h2 className="drawer-title">Invite New Team Member</h2>
            <div style={{ fontSize: "var(--text-sm)", color: "var(--ink-2)" }}>
              Grant administrative access and assign multi-role chapter scopes
            </div>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="drawer-body">
          <div className="form-group">
            <label className="form-label" htmlFor="invite-name">Full Name *</label>
            <input id="invite-name" className="form-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Tariq Mehmood" />
          </div>
          <div className="grid-2col">
            <div className="form-group">
              <label className="form-label" htmlFor="invite-email">Work Email *</label>
              <input id="invite-email" type="email" className="form-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e.g. tariq.m@youthrepublic.org" />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="invite-phone">Phone Number</label>
              <input id="invite-phone" className="form-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 0300-1234567" />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Assigned Roles &amp; Chapter Scopes *</label>
            <RoleScopeRepeater
              rows={rows}
              roles={roles.map((r) => ({ id: r.id, name: r.name, isSystem: r.isSystem }))}
              chapters={chapters.map((c) => ({ id: c.id, name: c.name }))}
              onChange={setRows}
              addLabel="+ Add Another Role"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Security &amp; Invitation Settings</label>
            <div style={{ display: "flex", flexDirection: "column", gap: ".45rem", fontSize: "var(--text-sm)" }}>
              <label style={{ display: "flex", alignItems: "center", gap: ".5rem" }}>
                <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} />
                <span>Send secure onboarding activation link via email</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: ".5rem" }}>
                <input type="checkbox" checked={enforce2fa} onChange={(e) => setEnforce2fa(e.target.checked)} />
                <span>Enforce Two-Factor Authentication (2FA) on first login</span>
              </label>
            </div>
          </div>
        </div>

        <div className="drawer-footer">
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={submit}>
            Send Official Invitation →
          </button>
        </div>
      </div>
    </>
  );
}
```

Run: `npm test -- components/team/InviteMemberDrawer.test.tsx` → PASS (2).

- [ ] **Step 3: Write the `EditMemberDrawer` failing test**

Create `components/team/EditMemberDrawer.test.tsx`. Mock the same modules; `useTeamAccess` also returns `members` including one member `m1` with two assignments; mock `updateStaffAccess` + `removeStaffMember`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

const updateAccess = vi.fn().mockResolvedValue({ staffId: "m1" });
const removeMember = vi.fn().mockResolvedValue({ staffId: "m1" });
const refresh = vi.fn();
const showToast = vi.fn();
vi.mock("@/lib/platformFunctions", () => ({
  updateStaffAccess: (...a: unknown[]) => updateAccess(...a),
  removeStaffMember: (...a: unknown[]) => removeMember(...a),
}));
vi.mock("@/components/shell/ToastContext", () => ({ useToast: () => ({ showToast }) }));
vi.mock("@/components/team/TeamAccessProvider", () => ({
  useTeamAccess: () => ({
    organizationId: "org-1", accessToken: "access-token",
    roles: [
      { id: "r1", name: "Operations Lead", isSystem: true, description: "", permissionKeys: ["opportunities:write"] },
      { id: "r2", name: "Auditor", isSystem: true, description: "", permissionKeys: ["applications:read", "hours:read"] },
    ],
    chapters: [{ id: "c1", name: "Lahore Chapter", city: "Lahore", status: "active" }],
    members: [{
      id: "m1", fullName: "Amina Malik", email: "amina@x.org", status: "active", lastActiveLabel: "—", enforce2fa: true,
      assignments: [{ id: "a1", roleId: "r1", roleName: "Operations Lead", scopeKind: "org_wide", chapterId: null, scopeLabel: "National / All Chapters" }],
    }],
    refresh,
  }),
}));

import { EditMemberDrawer } from "./EditMemberDrawer";

describe("EditMemberDrawer", () => {
  beforeEach(() => vi.clearAllMocks());

  it("preloads the member's assignments and saves changes", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<EditMemberDrawer memberId="m1" onClose={onClose} />);
    expect(screen.getByText("Amina Malik")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Account Access Status"), "invited");
    await user.click(screen.getByRole("button", { name: /Save Changes/i }));

    await waitFor(() => expect(updateAccess).toHaveBeenCalledTimes(1));
    const [payload] = updateAccess.mock.calls[0];
    expect(payload).toMatchObject({ staffId: "m1", organizationId: "org-1", status: "invited" });
    expect(payload.roles[0]).toMatchObject({ roleId: "r1", scopeKind: "org_wide" });
    expect(refresh).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("removes the member after confirm", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<EditMemberDrawer memberId="m1" onClose={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /Remove from Team/i }));
    await waitFor(() => expect(removeMember).toHaveBeenCalledWith({ staffId: "m1", organizationId: "org-1" }, "access-token"));
  });
});
```

- [ ] **Step 4: Run it — expect fail; then implement `EditMemberDrawer.tsx`**

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useTeamAccess } from "./TeamAccessProvider";
import { useToast } from "@/components/shell/ToastContext";
import { removeStaffMember, updateStaffAccess } from "@/lib/platformFunctions";
import { effectivePermissionTags } from "@/lib/capabilityMap";
import { RoleScopeRepeater, rowsToAssignmentPayload, type RoleScopeRow } from "./RoleScopeRepeater";

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

export function EditMemberDrawer({ memberId, onClose }: { memberId: string | null; onClose: () => void }) {
  const { organizationId, accessToken, roles, chapters, members, refresh } = useTeamAccess();
  const { showToast } = useToast();
  const member = members.find((m) => m.id === memberId) ?? null;
  const [rows, setRows] = useState<RoleScopeRow[]>([]);
  const [status, setStatus] = useState<"active" | "invited" | "deactivated">("active");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (member) {
      setRows(member.assignments.map((a) => ({
        key: a.id,
        roleId: a.roleId,
        scopeKind: a.scopeKind,
        chapterId: a.chapterId,
        scopeLabel: a.scopeLabel,
      })));
      setStatus(member.status);
    }
  }, [member]);

  const permKeysByRoleId = useMemo(() => new Map(roles.map((r) => [r.id, r.permissionKeys])), [roles]);
  const tags = effectivePermissionTags(rows.map((r) => permKeysByRoleId.get(r.roleId) ?? []));

  async function save() {
    if (!member || !organizationId || !accessToken) return;
    setBusy(true);
    try {
      await updateStaffAccess({
        staffId: member.id,
        organizationId,
        roles: rowsToAssignmentPayload(rows),
        status,
      }, accessToken);
      await refresh();
      showToast(`Saved access changes for ${member.fullName}.`);
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to save changes.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!member || !organizationId || !accessToken) return;
    if (!window.confirm(`Remove ${member.fullName} from the team?`)) return;
    setBusy(true);
    try {
      await removeStaffMember({ staffId: member.id, organizationId }, accessToken);
      await refresh();
      showToast(`Removed ${member.fullName} from the team.`);
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to remove member.");
    } finally {
      setBusy(false);
    }
  }

  const open = member !== null;
  return (
    <>
      <div className={`drawer-backdrop ${open ? "open" : ""}`} onClick={onClose} />
      <div className={`drawer ${open ? "open" : ""}`} style={{ maxWidth: 580 }}>
        {member && (
          <>
            <div className="drawer-header">
              <div>
                <h2 className="drawer-title">Edit Team Member Access</h2>
                <div style={{ fontSize: "var(--text-sm)", color: "var(--ink-2)" }}>
                  Configure multi-roles, chapter scopes, and account status
                </div>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} aria-label="Close">✕</button>
            </div>

            <div className="drawer-body">
              <div style={{ background: "var(--bg-page)", border: "1px solid var(--line)", borderRadius: 8, padding: ".85rem", display: "flex", alignItems: "center", gap: ".75rem" }}>
                <div className="avatar" style={{ width: 36, height: 36, fontSize: "var(--text-base)" }}>{initials(member.fullName)}</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: "var(--text-base)" }}>{member.fullName}</div>
                  <div style={{ fontSize: "var(--text-sm)", color: "var(--ink-2)" }}>{member.email}</div>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Assigned Roles &amp; Operational Scopes</label>
                <RoleScopeRepeater
                  rows={rows}
                  roles={roles.map((r) => ({ id: r.id, name: r.name, isSystem: r.isSystem }))}
                  chapters={chapters.map((c) => ({ id: c.id, name: c.name }))}
                  onChange={setRows}
                  addLabel="+ Add Role"
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="edit-mem-status">Account Access Status</label>
                <select
                  id="edit-mem-status"
                  aria-label="Account Access Status"
                  className="form-select"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as "active" | "invited" | "deactivated")}
                >
                  <option value="active">Active &amp; Verified</option>
                  <option value="invited">Pending Invitation</option>
                  <option value="deactivated">Suspended / Deactivated</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Effective Permission Privileges</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: ".35rem" }}>
                  {tags.map((t) => <span className="perm-tag" key={t}>{t}</span>)}
                </div>
              </div>
            </div>

            <div className="drawer-footer">
              <button type="button" className="btn btn-danger btn-xs" disabled={busy} onClick={remove}>Remove from Team</button>
              <div style={{ display: "flex", gap: ".45rem" }}>
                <button type="button" className="btn btn-secondary btn-xs" onClick={onClose}>Cancel</button>
                <button type="button" className="btn btn-primary btn-xs" disabled={busy} onClick={save}>Save Changes</button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
```

Run: `npm test -- components/team/EditMemberDrawer.test.tsx` → PASS (2).

- [ ] **Step 5: Commit**

```bash
git add components/team/InviteMemberDrawer.tsx components/team/InviteMemberDrawer.test.tsx components/team/EditMemberDrawer.tsx components/team/EditMemberDrawer.test.tsx
git commit -m "feat(team): invite + edit-access drawers wired to edge functions"
```

---

## Task 8: `/team/roles` page + `RolesTable`

**Files:**
- Create: `components/team/RolesTable.tsx`, `components/team/RolesTable.test.tsx`
- Create: `app/team/roles/page.tsx`

**Interfaces:**
- Consumes: `useTeamAccess`, `useTeamHeader`, `useTeamDrawers`, `permissionKeysToGrid` + `CAPABILITY_KEYS` + `CAPABILITY_META` (Task 2), `StatCard`, `ChaptersPanel` (Task 10 — stub first).
- Produces (`RolesTable.tsx`): `function RolesTable(props: { roles: TeamRole[]; assignmentCountByRoleId: Map<string, number>; onView: (roleId: string) => void; onEdit: (roleId: string) => void; onClone: (roleId: string) => void; onDelete: (roleId: string) => void }): JSX.Element`

- [ ] **Step 1: Write the failing `RolesTable` test**

Create `components/team/RolesTable.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { RolesTable } from "./RolesTable";
import type { TeamRole } from "./TeamAccessProvider";

const roles: TeamRole[] = [
  { id: "r1", name: "Super Admin", description: "Full control", isSystem: true,
    permissionKeys: ["opportunities:write", "noticeboard:write", "applications:update", "applications:read", "hours:update", "hours:read", "team:write"] },
  { id: "r2", name: "Regional Logistics Lead", description: "Logistics", isSystem: false,
    permissionKeys: ["opportunities:write", "hours:update", "hours:read"] },
];
const counts = new Map([["r1", 1], ["r2", 0]]);

describe("RolesTable", () => {
  it("shows SYSTEM/CUSTOM badges and per-capability Granted/Restricted cells", () => {
    render(<RolesTable roles={roles} assignmentCountByRoleId={counts} onView={vi.fn()} onEdit={vi.fn()} onClone={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText("SYSTEM")).toBeInTheDocument();
    expect(screen.getByText("CUSTOM")).toBeInTheDocument();
    // Super Admin row: Team Management = Granted
    const superRow = screen.getByText("Super Admin").closest("tr")!;
    expect(superRow).toHaveTextContent("Granted");
    // Regional Logistics Lead row: Publish Noticeboard = Restricted
    const logisticsRow = screen.getByText("Regional Logistics Lead").closest("tr")!;
    expect(logisticsRow).toHaveTextContent("Restricted");
  });

  it("system rows expose View + Clone; custom rows expose Edit + Clone + Delete", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(<RolesTable roles={roles} assignmentCountByRoleId={counts} onView={vi.fn()} onEdit={onEdit} onClone={vi.fn()} onDelete={onDelete} />);
    const logisticsRow = screen.getByText("Regional Logistics Lead").closest("tr")!;
    await user.click(within(logisticsRow).getByRole("button", { name: "Edit" }));
    expect(onEdit).toHaveBeenCalledWith("r2");
  });
});
import { within } from "@testing-library/react";
```

- [ ] **Step 2: Run it — expect fail; then implement `RolesTable.tsx`**

```tsx
"use client";

import { useState } from "react";
import { CAPABILITY_KEYS, CAPABILITY_META, permissionKeysToGrid, type CapabilityLevel } from "@/lib/capabilityMap";
import type { TeamRole } from "./TeamAccessProvider";

function levelBadge(level: CapabilityLevel) {
  if (level === "granted") return <span className="badge badge-pos">Granted</span>;
  if (level === "read_only") return <span className="badge badge-neu">Read Only</span>;
  return <span className="badge badge-neg">Restricted</span>;
}

export function RolesTable({
  roles, assignmentCountByRoleId, onView, onEdit, onClone, onDelete,
}: {
  roles: TeamRole[];
  assignmentCountByRoleId: Map<string, number>;
  onView: (roleId: string) => void;
  onEdit: (roleId: string) => void;
  onClone: (roleId: string) => void;
  onDelete: (roleId: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const filtered = roles.filter((r) => {
    const q = search.toLowerCase().trim();
    const matchSearch = !q || r.name.toLowerCase().includes(q) || (r.description ?? "").toLowerCase().includes(q);
    const matchType = typeFilter === "all"
      || (typeFilter === "system" && r.isSystem)
      || (typeFilter === "custom" && !r.isSystem);
    return matchSearch && matchType;
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <input className="search-input" placeholder="Search role title or description..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <select aria-label="Role type filter" className="filter-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="all">All Role Types</option>
          <option value="system">System Default (Protected)</option>
          <option value="custom">Custom Organization Roles</option>
        </select>
      </div>

      <div className="table-card">
        <div className="table-responsive-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Role Title &amp; Type</th>
                <th>Description</th>
                <th>Active Staff</th>
                {CAPABILITY_KEYS.map((k) => <th key={k}>{CAPABILITY_META[k].column}</th>)}
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={4 + CAPABILITY_KEYS.length} style={{ textAlign: "center", padding: "2.5rem", color: "var(--ink-3)" }}>
                  No roles found matching your search criteria.
                </td></tr>
              ) : filtered.map((r) => {
                const grid = permissionKeysToGrid(r.permissionKeys);
                const count = assignmentCountByRoleId.get(r.id) ?? 0;
                return (
                  <tr key={r.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: ".5rem" }}>
                        <b style={{ fontSize: "var(--text-base)" }}>{r.name}</b>
                        <span className={r.isSystem ? "badge-system" : "badge-custom"}>{r.isSystem ? "SYSTEM" : "CUSTOM"}</span>
                      </div>
                    </td>
                    <td style={{ color: "var(--ink-2)", fontSize: "var(--text-sm)", maxWidth: 240, lineHeight: 1.3 }}>{r.description}</td>
                    <td><span style={{ fontWeight: 600 }}>{count} Staff</span></td>
                    {CAPABILITY_KEYS.map((k) => <td key={k}>{levelBadge(grid[k])}</td>)}
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: ".35rem", justifyContent: "flex-end" }}>
                        {r.isSystem ? (
                          <>
                            <button type="button" className="btn btn-secondary btn-xs" onClick={() => onView(r.id)}>View</button>
                            <button type="button" className="btn btn-secondary btn-xs" onClick={() => onClone(r.id)}>Clone</button>
                          </>
                        ) : (
                          <>
                            <button type="button" className="btn btn-secondary btn-xs" onClick={() => onEdit(r.id)}>Edit</button>
                            <button type="button" className="btn btn-secondary btn-xs" onClick={() => onClone(r.id)}>Clone</button>
                            <button
                              type="button"
                              className="btn btn-danger btn-xs"
                              disabled={count > 0}
                              title={count > 0 ? "Reassign staff before deleting this role" : undefined}
                              onClick={() => onDelete(r.id)}
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
```

Run: `npm test -- components/team/RolesTable.test.tsx` → PASS (2).

- [ ] **Step 3: Stub `ChaptersPanel` then implement `app/team/roles/page.tsx`**

Create stub `components/team/ChaptersPanel.tsx`: `export function ChaptersPanel() { return null; }` (real body in Task 10).

```tsx
"use client";

import { useEffect, useMemo } from "react";
import { useTeamAccess } from "@/components/team/TeamAccessProvider";
import { useTeamHeader } from "@/components/team/teamHeader";
import { useTeamDrawers } from "@/components/team/TeamDrawers";
import { RolesTable } from "@/components/team/RolesTable";
import { ChaptersPanel } from "@/components/team/ChaptersPanel";
import { StatCard } from "@/components/team/StatCard";
import { useToast } from "@/components/shell/ToastContext";
import { deleteCustomRole } from "@/lib/platformFunctions";

export default function TeamRolesPage() {
  const { roles, members, accessToken, loading, refresh } = useTeamAccess();
  const { setAction } = useTeamHeader();
  const { openCreateRole, openEditRole, openCloneRole } = useTeamDrawers();
  const { showToast } = useToast();

  useEffect(() => {
    setAction({ label: "Create Custom Role", onClick: openCreateRole, variant: "primary" });
    return () => setAction(null);
  }, [setAction, openCreateRole]);

  const assignmentCountByRoleId = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of members) for (const a of m.assignments) counts.set(a.roleId, (counts.get(a.roleId) ?? 0) + 1);
    return counts;
  }, [members]);

  const systemCount = roles.filter((r) => r.isSystem).length;
  const customCount = roles.length - systemCount;
  const totalAssignments = members.reduce((n, m) => n + m.assignments.length, 0);

  async function onDelete(roleId: string) {
    if (!accessToken) return;
    const role = roles.find((r) => r.id === roleId);
    if (!role || !window.confirm(`Permanently delete custom role "${role.name}"?`)) return;
    try {
      await deleteCustomRole({ roleId }, accessToken);
      await refresh();
      showToast(`Deleted custom role "${role.name}".`);
    } catch (err) {
      showToast(err instanceof Error && err.message === "role_in_use"
        ? `Cannot delete "${role.name}" — it is still assigned. Reassign those members first.`
        : "Failed to delete role.");
    }
  }

  if (loading) return <p className="p-8 text-center text-[var(--ink-3)]">Loading roles…</p>;

  return (
    <div className="flex flex-col gap-6">
      <div className="stat-grid">
        <StatCard accent="gold" label="Total Configured Roles" value={`${roles.length} Roles`} sub={`${systemCount} System Default · ${customCount} Custom Organization`} />
        <StatCard accent="green" label="Active Role Assignments" value={`${totalAssignments} Active`} sub={`Assigned across ${members.length} staff members`} />
        <StatCard accent="dark" label="Custom Roles" value={`${customCount} Roles`} sub="Fully editable and customizable" />
        <StatCard accent="red" label="Governed Modules" value="1 Module" sub="Youth Republic" />
      </div>

      <RolesTable
        roles={roles}
        assignmentCountByRoleId={assignmentCountByRoleId}
        onView={(id) => openEditRole(id, true)}
        onEdit={(id) => openEditRole(id, false)}
        onClone={openCloneRole}
        onDelete={onDelete}
      />

      <ChaptersPanel />
    </div>
  );
}
```

- [ ] **Step 4: Build check**

Run: `npm run build` → succeeds.

- [ ] **Step 5: Commit**

```bash
git add components/team/RolesTable.tsx components/team/RolesTable.test.tsx components/team/ChaptersPanel.tsx app/team/roles/page.tsx
git commit -m "feat(team): roles & permissions matrix page + capability-grid table"
```

---

## Task 9: `RoleDrawer` (create / edit / view / clone)

**Files:**
- Rewrite: `components/team/RoleDrawer.tsx` (+ new `.test.tsx`)

**Interfaces:**
- Consumes: `useTeamAccess`, `CAPABILITY_KEYS`/`CAPABILITY_META`/`RESTRICTED_GRID`/`permissionKeysToGrid` (Task 2), `createCustomRole`/`updateCustomRole` from `@/lib/platformFunctions`, `useToast`.
- Produces: `RoleDrawer({ request, onClose })` where `request: { mode: "create" | "edit" | "view" | "clone"; roleId: string | null } | null` (from Task 5).

- [ ] **Step 1: Write the failing test**

Create `components/team/RoleDrawer.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

const createRole = vi.fn().mockResolvedValue({ roleId: "new" });
const updateRole = vi.fn().mockResolvedValue({ roleId: "r2" });
const refresh = vi.fn();
const showToast = vi.fn();
vi.mock("@/lib/platformFunctions", () => ({
  createCustomRole: (...a: unknown[]) => createRole(...a),
  updateCustomRole: (...a: unknown[]) => updateRole(...a),
}));
vi.mock("@/components/shell/ToastContext", () => ({ useToast: () => ({ showToast }) }));
vi.mock("@/components/team/TeamAccessProvider", () => ({
  useTeamAccess: () => ({
    organizationId: "org-1", accessToken: "access-token", moduleId: "mod-1", refresh,
    roles: [
      { id: "r1", name: "Operations Lead", isSystem: true, description: "sys",
        permissionKeys: ["opportunities:write", "noticeboard:write", "applications:update", "applications:read", "hours:update", "hours:read"] },
      { id: "r2", name: "Regional Logistics Lead", isSystem: false, description: "cust",
        permissionKeys: ["opportunities:write", "hours:update", "hours:read"] },
    ],
  }),
}));

import { RoleDrawer } from "./RoleDrawer";

describe("RoleDrawer", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a custom role from the capability selects", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<RoleDrawer request={{ mode: "create", roleId: null }} onClose={onClose} />);
    await user.type(screen.getByLabelText(/Role Title/i), "Warehouse Lead");
    await user.selectOptions(screen.getByLabelText("Drive Creation"), "granted");
    await user.selectOptions(screen.getByLabelText("Approve Hours"), "read_only");
    await user.click(screen.getByRole("button", { name: /Save Role/i }));

    await waitFor(() => expect(createRole).toHaveBeenCalledTimes(1));
    const [payload] = createRole.mock.calls[0];
    expect(payload).toMatchObject({ organizationId: "org-1", moduleId: "mod-1", name: "Warehouse Lead" });
    expect(payload.capabilities).toMatchObject({ drive: "granted", hours: "read_only" });
    expect(onClose).toHaveBeenCalled();
  });

  it("opens a system role read-only with no save", () => {
    render(<RoleDrawer request={{ mode: "view", roleId: "r1" }} onClose={vi.fn()} />);
    expect(screen.getByLabelText("Drive Creation")).toBeDisabled();
    expect(screen.queryByRole("button", { name: /Save Role/i })).not.toBeInTheDocument();
  });

  it("prefills a clone from the source role with an editable name", () => {
    render(<RoleDrawer request={{ mode: "clone", roleId: "r2" }} onClose={vi.fn()} />);
    expect((screen.getByLabelText(/Role Title/i) as HTMLInputElement).value).toBe("Regional Logistics Lead (Copy)");
    expect((screen.getByLabelText("Drive Creation") as HTMLSelectElement).value).toBe("granted");
  });

  it("edits a custom role", async () => {
    const user = userEvent.setup();
    render(<RoleDrawer request={{ mode: "edit", roleId: "r2" }} onClose={vi.fn()} />);
    await user.selectOptions(screen.getByLabelText("Publish Noticeboard"), "granted");
    await user.click(screen.getByRole("button", { name: /Save Role/i }));
    await waitFor(() => expect(updateRole).toHaveBeenCalledTimes(1));
    expect(updateRole.mock.calls[0][0]).toMatchObject({ roleId: "r2" });
    expect(updateRole.mock.calls[0][0].capabilities.publish).toBe("granted");
  });
});
```

- [ ] **Step 2: Run it — expect fail; then implement `RoleDrawer.tsx`**

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useTeamAccess } from "./TeamAccessProvider";
import { useToast } from "@/components/shell/ToastContext";
import { createCustomRole, updateCustomRole } from "@/lib/platformFunctions";
import {
  CAPABILITY_KEYS, CAPABILITY_META, RESTRICTED_GRID, permissionKeysToGrid,
  type CapabilityGrid, type CapabilityKey, type CapabilityLevel,
} from "@/lib/capabilityMap";

const LEVEL_LABEL: Record<CapabilityLevel, string> = {
  granted: "Granted", read_only: "Read Only", restricted: "Restricted",
};

export function RoleDrawer({
  request, onClose,
}: {
  request: { mode: "create" | "edit" | "view" | "clone"; roleId: string | null } | null;
  onClose: () => void;
}) {
  const { organizationId, accessToken, moduleId, roles, refresh } = useTeamAccess();
  const { showToast } = useToast();
  const source = request?.roleId ? roles.find((r) => r.id === request.roleId) ?? null : null;
  const readOnly = request?.mode === "view";

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [grid, setGrid] = useState<CapabilityGrid>(RESTRICTED_GRID);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!request) return;
    if (request.mode === "create") {
      setName(""); setDescription("");
      setGrid({ drive: "granted", publish: "restricted", triage: "granted", hours: "restricted", team: "restricted" });
    } else if (source) {
      const g = permissionKeysToGrid(source.permissionKeys);
      setGrid(g);
      setDescription(source.description ?? "");
      setName(request.mode === "clone" ? `${source.name} (Copy)` : source.name);
    }
  }, [request, source]);

  const templateOptions = useMemo(() => roles.filter((r) => r.isSystem), [roles]);

  function applyTemplate(roleId: string) {
    const t = roles.find((r) => r.id === roleId);
    if (t) {
      setGrid(permissionKeysToGrid(t.permissionKeys));
      if (!description) setDescription(t.description ?? "");
    }
  }

  async function save() {
    if (!name.trim()) { showToast("Please specify a role title."); return; }
    if (!accessToken) return;
    setBusy(true);
    try {
      if (request?.mode === "edit" && source) {
        await updateCustomRole({ roleId: source.id, name: name.trim(), description, capabilities: grid }, accessToken);
        showToast(`Role "${name.trim()}" updated successfully.`);
      } else {
        if (!organizationId || !moduleId) return;
        await createCustomRole({ organizationId, moduleId, name: name.trim(), description, capabilities: grid }, accessToken);
        showToast(`Created new custom role "${name.trim()}".`);
      }
      await refresh();
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to save role.");
    } finally {
      setBusy(false);
    }
  }

  const open = request !== null;
  const title = request?.mode === "view" ? "System Role Specification"
    : request?.mode === "edit" ? "Edit Custom Role"
    : "Create Custom Role";

  return (
    <>
      <div className={`drawer-backdrop ${open ? "open" : ""}`} onClick={onClose} />
      <div className={`drawer ${open ? "open" : ""}`} style={{ maxWidth: 620 }}>
        {request && (
          <>
            <div className="drawer-header">
              <div>
                <h2 className="drawer-title">{title}</h2>
                <div style={{ fontSize: "var(--text-sm)", color: "var(--ink-2)" }}>
                  {readOnly
                    ? "Protected default system role permissions (read-only baseline)"
                    : "Define role boundaries and configure granular module permissions"}
                </div>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} aria-label="Close">✕</button>
            </div>

            <div className="drawer-body">
              <div className="form-group">
                <label className="form-label" htmlFor="role-name">Role Title *</label>
                <input id="role-name" className="form-input" value={name} disabled={readOnly}
                  onChange={(e) => setName(e.target.value)} placeholder="e.g. Regional Logistics Lead" />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="role-desc">Role Description</label>
                <textarea id="role-desc" className="form-textarea" rows={2} value={description} disabled={readOnly}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Explain the operational responsibilities and authority of this role..." />
              </div>

              {!readOnly && request.mode !== "edit" && (
                <div className="form-group">
                  <label className="form-label" htmlFor="role-template">Base Permission Template</label>
                  <select id="role-template" className="form-select" defaultValue="" onChange={(e) => e.target.value && applyTemplate(e.target.value)}>
                    <option value="">Start from Blank / Custom</option>
                    {templateOptions.map((r) => <option key={r.id} value={r.id}>Clone from {r.name}</option>)}
                  </select>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Granular Module Permissions</label>
                <div style={{ display: "flex", flexDirection: "column", gap: ".75rem" }}>
                  {CAPABILITY_KEYS.map((cap: CapabilityKey) => (
                    <div className="perm-matrix-group" key={cap}>
                      <div className="perm-checkbox-row">
                        <span>{CAPABILITY_META[cap].column}</span>
                        <select
                          aria-label={CAPABILITY_META[cap].column}
                          className="filter-select"
                          style={{ padding: ".2rem .4rem", fontSize: "var(--text-sm)" }}
                          value={grid[cap]}
                          disabled={readOnly}
                          onChange={(e) => setGrid({ ...grid, [cap]: e.target.value as CapabilityLevel })}
                        >
                          {CAPABILITY_META[cap].levels.map((lvl) => (
                            <option key={lvl} value={lvl}>{LEVEL_LABEL[lvl]}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="drawer-footer">
              <div style={{ marginLeft: "auto", display: "flex", gap: ".45rem" }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
                {!readOnly && (
                  <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={save}>
                    Save Role &amp; Permissions
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
```

Run: `npm test -- components/team/RoleDrawer.test.tsx` → PASS (4).

- [ ] **Step 3: Commit**

```bash
git add components/team/RoleDrawer.tsx components/team/RoleDrawer.test.tsx
git commit -m "feat(team): role create/edit/view/clone drawer with capability selects"
```

---

## Task 10: `ChaptersPanel` (managed inside the Roles tab)

**Files:**
- Rewrite: `components/team/ChaptersPanel.tsx` (+ new `.test.tsx`)

**Interfaces:**
- Consumes: `useTeamAccess` (`chapters`, `staffToken`, `organizationId`, `refresh`), `createChapter` / `updateChapter` from `@/lib/youthRepublicFunctions`, `useToast`.
- Produces: `function ChaptersPanel(): JSX.Element` — a section under the roles table: list of chapters (name · city · status) + inline "Add Chapter" form + per-row deactivate/reactivate.

- [ ] **Step 1: Write the failing test**

Create `components/team/ChaptersPanel.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

const createCh = vi.fn().mockResolvedValue({ chapterId: "c9" });
const updateCh = vi.fn().mockResolvedValue({ chapterId: "c1" });
const refresh = vi.fn();
const showToast = vi.fn();
vi.mock("@/lib/youthRepublicFunctions", () => ({
  createChapter: (...a: unknown[]) => createCh(...a),
  updateChapter: (...a: unknown[]) => updateCh(...a),
}));
vi.mock("@/components/shell/ToastContext", () => ({ useToast: () => ({ showToast }) }));
vi.mock("@/components/team/TeamAccessProvider", () => ({
  useTeamAccess: () => ({
    organizationId: "org-1", staffToken: "staff-token", refresh,
    chapters: [{ id: "c1", name: "Lahore Chapter", city: "Lahore", status: "active" }],
  }),
}));

import { ChaptersPanel } from "./ChaptersPanel";

describe("ChaptersPanel", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists chapters and creates a new one", async () => {
    const user = userEvent.setup();
    render(<ChaptersPanel />);
    expect(screen.getByText("Lahore Chapter")).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Chapter name/i), "Multan Chapter");
    await user.type(screen.getByLabelText(/City/i), "Multan");
    await user.click(screen.getByRole("button", { name: /Add Chapter/i }));
    await waitFor(() => expect(createCh).toHaveBeenCalledWith(
      { organizationId: "org-1", name: "Multan Chapter", city: "Multan" }, "staff-token",
    ));
    expect(refresh).toHaveBeenCalled();
  });

  it("deactivates an active chapter", async () => {
    const user = userEvent.setup();
    render(<ChaptersPanel />);
    await user.click(screen.getByRole("button", { name: /Deactivate/i }));
    await waitFor(() => expect(updateCh).toHaveBeenCalledWith(
      { chapterId: "c1", organizationId: "org-1", status: "inactive" }, "staff-token",
    ));
  });
});
```

- [ ] **Step 2: Run it — expect fail; then implement `ChaptersPanel.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useTeamAccess } from "./TeamAccessProvider";
import { useToast } from "@/components/shell/ToastContext";
import { createChapter, updateChapter } from "@/lib/youthRepublicFunctions";

export function ChaptersPanel() {
  const { organizationId, staffToken, chapters, refresh } = useTeamAccess();
  const { showToast } = useToast();
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!organizationId || !staffToken || !name.trim()) return;
    setBusy(true);
    try {
      await createChapter(
        { organizationId, name: name.trim(), ...(city.trim() ? { city: city.trim() } : {}) },
        staffToken,
      );
      setName(""); setCity("");
      await refresh();
      showToast(`Added chapter "${name.trim()}".`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to add chapter.");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(chapterId: string, current: string) {
    if (!organizationId || !staffToken) return;
    const next = current === "active" ? "inactive" : "active";
    try {
      await updateChapter({ chapterId, organizationId, status: next }, staffToken);
      await refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to update chapter.");
    }
  }

  return (
    <div className="table-card" style={{ padding: "1rem 1.25rem" }}>
      <h2 className="panel-title" style={{ marginBottom: ".75rem" }}>Operational Chapters</h2>
      <p style={{ fontSize: "var(--text-xs)", color: "var(--ink-2)", marginBottom: ".75rem" }}>
        City teams that scope a staff member&apos;s access to their chapter&apos;s data. Used by every role scope dropdown.
      </p>

      <div className="table-responsive-wrapper">
        <table className="data-table">
          <thead>
            <tr><th>Chapter</th><th>City</th><th>Status</th><th style={{ textAlign: "right" }}>Actions</th></tr>
          </thead>
          <tbody>
            {chapters.length === 0 ? (
              <tr><td colSpan={4} style={{ textAlign: "center", padding: "1.5rem", color: "var(--ink-3)" }}>No chapters yet.</td></tr>
            ) : chapters.map((c) => (
              <tr key={c.id}>
                <td style={{ fontWeight: 600 }}>{c.name}</td>
                <td>{c.city ?? "—"}</td>
                <td>
                  <span className={`badge ${c.status === "active" ? "badge-pos" : "badge-neg"}`}>
                    {c.status === "active" ? "Active" : "Inactive"}
                  </span>
                </td>
                <td style={{ textAlign: "right" }}>
                  <button type="button" className="btn btn-secondary btn-xs" onClick={() => toggle(c.id, c.status)}>
                    {c.status === "active" ? "Deactivate" : "Reactivate"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="role-repeater-row" style={{ marginTop: ".85rem" }}>
        <input aria-label="Chapter name" className="form-input" placeholder="Chapter name" value={name} onChange={(e) => setName(e.target.value)} />
        <input aria-label="City" className="form-input" placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} />
        <button type="button" className="btn btn-primary btn-xs" disabled={busy} onClick={add}>Add Chapter</button>
      </div>
    </div>
  );
}
```

Run: `npm test -- components/team/ChaptersPanel.test.tsx` → PASS (2). If `panel-title` is not in `globals.css`, replace with an inline `<h2 style={{ fontWeight: 600, fontSize: "var(--text-base)" }}>` — grep first: `grep -n "panel-title" app/globals.css`.

- [ ] **Step 3: Commit**

```bash
git add components/team/ChaptersPanel.tsx components/team/ChaptersPanel.test.tsx
git commit -m "feat(team): operational chapters panel inside the roles tab"
```

---

## Task 11: `/team/audit` page + `AuditTable`

**Files:**
- Create: `components/team/AuditTable.tsx`, `components/team/AuditTable.test.tsx`
- Create: `app/team/audit/page.tsx`

**Interfaces:**
- Consumes: `useSelectedOrg` (shell), `getBrowserSupabaseClient`, `useTeamHeader`, `StatCard`.
- Produces (`AuditTable.tsx`):
  - `interface AuditRow { id: string; createdAt: string; actorName: string; action: string; summary: string; ip: string | null; scopeLabel: string | null }`
  - `function AuditTable(props: { rows: AuditRow[] }): JSX.Element` — search + action-type filter + table; also exports `function auditRowsToCsv(rows: AuditRow[]): string`.

- [ ] **Step 1: Write the failing test**

Create `components/team/AuditTable.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { AuditTable, auditRowsToCsv, type AuditRow } from "./AuditTable";

const rows: AuditRow[] = [
  { id: "1", createdAt: "2026-02-28T17:42:00Z", actorName: "Sohaib Mohsin", action: "Role Created", summary: "Created new custom role 'Youth Ambassador Manager'", ip: "110.37.21.9", scopeLabel: "National" },
  { id: "2", createdAt: "2026-02-28T16:15:00Z", actorName: "Amina Malik", action: "Access Changed", summary: "Updated access for Fatima Noor", ip: "39.40.18.22", scopeLabel: "Lahore" },
];

describe("AuditTable", () => {
  it("renders rows and filters by action type", async () => {
    const user = userEvent.setup();
    render(<AuditTable rows={rows} />);
    expect(screen.getByText(/Youth Ambassador Manager/)).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Action type filter"), "Access Changed");
    expect(screen.queryByText(/Youth Ambassador Manager/)).not.toBeInTheDocument();
    expect(screen.getByText(/Updated access for Fatima Noor/)).toBeInTheDocument();
  });

  it("serializes rows to CSV with a header line", () => {
    const csv = auditRowsToCsv(rows);
    expect(csv.split("\n")[0]).toBe("Timestamp,User,Action,Details,IP,Scope");
    expect(csv).toContain("Sohaib Mohsin");
  });
});
```

- [ ] **Step 2: Run it — expect fail; then implement `AuditTable.tsx`**

```tsx
"use client";

import { useMemo, useState } from "react";

export interface AuditRow {
  id: string;
  createdAt: string;
  actorName: string;
  action: string;
  summary: string;
  ip: string | null;
  scopeLabel: string | null;
}

const ACTION_TYPES = ["Member Invited", "Access Changed", "Member Removed", "Role Created", "Role Modified"];

function badgeClass(action: string) {
  if (action === "Member Removed") return "badge-neg";
  if (action === "Role Created" || action === "Role Modified") return "badge-custom";
  if (action === "Member Invited") return "badge-pend";
  return "badge-pos";
}

function csvCell(v: string) {
  return `"${v.replace(/"/g, '""')}"`;
}

export function auditRowsToCsv(rows: AuditRow[]): string {
  const header = "Timestamp,User,Action,Details,IP,Scope";
  const lines = rows.map((r) =>
    [r.createdAt, r.actorName, r.action, r.summary, r.ip ?? "", r.scopeLabel ?? ""].map(csvCell).join(","),
  );
  return [header, ...lines].join("\n");
}

export function AuditTable({ rows }: { rows: AuditRow[] }) {
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");

  const filtered = useMemo(() => rows.filter((r) => {
    const q = search.toLowerCase().trim();
    const matchSearch = !q
      || r.actorName.toLowerCase().includes(q)
      || r.action.toLowerCase().includes(q)
      || r.summary.toLowerCase().includes(q)
      || (r.scopeLabel ?? "").toLowerCase().includes(q);
    const matchAction = actionFilter === "all" || r.action === actionFilter;
    return matchSearch && matchAction;
  }), [rows, search, actionFilter]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <input className="search-input" placeholder="Search audit log actor, entity, action..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <select aria-label="Action type filter" className="filter-select" value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
          <option value="all">All Action Types</option>
          {ACTION_TYPES.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      <div className="table-card">
        <div className="table-responsive-wrapper">
          <table className="data-table">
            <thead>
              <tr><th>Timestamp</th><th>User</th><th>Action</th><th>Entity &amp; Details</th><th>IP / Chapter</th></tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: "center", padding: "2.5rem", color: "var(--ink-3)" }}>
                  No audit records found matching search filters.
                </td></tr>
              ) : filtered.map((r) => (
                <tr key={r.id}>
                  <td className="mono" style={{ fontSize: "var(--text-xs)" }}>
                    {new Date(r.createdAt).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td><b>{r.actorName}</b></td>
                  <td><span className={`badge ${badgeClass(r.action)}`}>{r.action}</span></td>
                  <td style={{ fontSize: "var(--text-sm)", color: "var(--ink)" }}>{r.summary}</td>
                  <td className="mono" style={{ fontSize: "var(--text-xs)", color: "var(--ink-2)" }}>
                    {r.ip ?? "—"}{r.scopeLabel ? ` · ${r.scopeLabel}` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
```

Run: `npm test -- components/team/AuditTable.test.tsx` → PASS (2).

- [ ] **Step 3: Implement `app/team/audit/page.tsx`**

```tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { useSelectedOrg } from "@/components/shell/AppShell";
import { useTeamHeader } from "@/components/team/teamHeader";
import { useToast } from "@/components/shell/ToastContext";
import { AuditTable, auditRowsToCsv, type AuditRow } from "@/components/team/AuditTable";
import { StatCard } from "@/components/team/StatCard";

export default function TeamAuditPage() {
  const organizationId = useSelectedOrg();
  const { setAction } = useTeamHeader();
  const { showToast } = useToast();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    const supabase = getBrowserSupabaseClient();
    const { data } = await supabase
      .from("admin_audit_log")
      .select("id, created_at, actor_name, action, summary, ip, scope_label")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(500);
    setRows((data ?? []).map((r) => ({
      id: r.id as string,
      createdAt: r.created_at as string,
      actorName: r.actor_name as string,
      action: r.action as string,
      summary: r.summary as string,
      ip: (r.ip as string) ?? null,
      scopeLabel: (r.scope_label as string) ?? null,
    })));
    setLoading(false);
  }, [organizationId]);

  useEffect(() => { load(); }, [load]);

  const exportCsv = useCallback(() => {
    const blob = new Blob([auditRowsToCsv(rows)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `team-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Exported the audit trail (CSV).");
  }, [rows, showToast]);

  useEffect(() => {
    setAction({ label: "Export Audit CSV", onClick: exportCsv, variant: "secondary" });
    return () => setAction(null);
  }, [setAction, exportCsv]);

  const stats = useMemo(() => {
    const today = new Date().toDateString();
    return {
      total: rows.length,
      todayCount: rows.filter((r) => new Date(r.createdAt).toDateString() === today).length,
      actors: new Set(rows.map((r) => r.actorName)).size,
      roleAndAccess: rows.filter((r) => ["Role Created", "Role Modified", "Access Changed"].includes(r.action)).length,
    };
  }, [rows]);

  if (loading) return <p className="p-8 text-center text-[var(--ink-3)]">Loading audit log…</p>;

  return (
    <div className="flex flex-col gap-6">
      <div className="stat-grid">
        <StatCard accent="gold" label="Total Logged Events" value={`${stats.total} Events`} sub="Team & Access administrative record" />
        <StatCard accent="green" label="Actions Today" value={`${stats.todayCount} Actions`} sub="Invites, role changes, access edits" />
        <StatCard accent="dark" label="Authorized Actors" value={`${stats.actors} Admins`} sub="Distinct staff performing changes" />
        <StatCard accent="red" label="Security & Role Updates" value={`${stats.roleAndAccess} Events`} sub="Role and access modifications" />
      </div>
      <AuditTable rows={rows} />
    </div>
  );
}
```

- [ ] **Step 4: Build check + commit**

```bash
npm run build
git add components/team/AuditTable.tsx components/team/AuditTable.test.tsx app/team/audit/page.tsx
git commit -m "feat(team): audit log page + table + CSV export"
```

---

## Task 12: Delete superseded routes/components + full verification

**Files:**
- Delete: `app/staff/`, `app/roles/`, `app/modules/youth-republic/audit/`
- Delete: `components/StaffList.tsx(+.test.tsx)`, `components/CreateStaffForm.tsx(+.test.tsx)`, `components/AssignStaffOrgRoleForm.tsx(+.test.tsx)`, `components/RolesList.tsx(+.test.tsx)`, `components/AssignStaffModuleRoleForm.tsx(+.test.tsx)`, `components/CreateCustomRoleForm.tsx(+.test.tsx)`
- Modify: `app/modules/youth-republic/layout.tsx` if it links to the deleted audit route (it does not currently — verify).

- [ ] **Step 1: Remove the old pages**

```bash
git rm -r app/staff app/roles app/modules/youth-republic/audit
```

- [ ] **Step 2: Remove orphaned components**

```bash
git rm components/StaffList.tsx components/StaffList.test.tsx \
       components/CreateStaffForm.tsx components/CreateStaffForm.test.tsx \
       components/AssignStaffOrgRoleForm.tsx components/AssignStaffOrgRoleForm.test.tsx \
       components/RolesList.tsx components/RolesList.test.tsx \
       components/AssignStaffModuleRoleForm.tsx components/AssignStaffModuleRoleForm.test.tsx \
       components/CreateCustomRoleForm.tsx components/CreateCustomRoleForm.test.tsx
```

- [ ] **Step 3: Find and fix dangling imports**

```bash
grep -rn "StaffList\|CreateStaffForm\|AssignStaffOrgRoleForm\|RolesList\|AssignStaffModuleRoleForm\|CreateCustomRoleForm\|/app/staff\|\"@/lib/platformFunctions\".*createStaff\|assignStaffModuleRole\|modules/youth-republic/audit" app components lib
```
Expected: no matches. Fix any that appear (they should only be in the files just deleted).

- [ ] **Step 4: Typecheck + full test suite + build**

```bash
npx tsc --noEmit
npm test
npm run build
```
Expected: `tsc` clean; all Vitest suites pass; build succeeds.

- [ ] **Step 5: Browser-pane verification**

Start the dev server and drive it (see the harness `preview_start` workflow):
1. `preview_start` `{ name: "<dev server from .claude/launch.json, or add one running `npm run dev` on its port> }`.
2. Sign in as an org admin (a `staff_org_roles` row with `org_tier='admin'` or `super_admin` for the selected org, YR module enabled).
3. `/team/members`: `read_page` — assert the 4 stat cards, the 4 filters, and member rows with `.role-chip`/`.scope-pill`/`.perm-tag`. Click **Invite Team Member**, fill the form, add a second role row with a chapter scope, submit; `read_console_messages` for errors; `read_page` to confirm the new pending row.
4. `/team/roles`: assert the capability-grid table, open **Create Custom Role**, set the five selects, save; confirm the new CUSTOM row. Open a system role via **View** — selects disabled, no Save. In the **Operational Chapters** panel, add a chapter; confirm it appears and shows up in the invite drawer's scope dropdown.
5. `/team/audit`: assert rows exist for the invite/role/chapter actions just performed; click **Export Audit CSV** and confirm `read_console_messages` shows no error (the download is triggered client-side).
6. `computer` screenshot of each of the three tabs for the completion report.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore(team): remove superseded /staff, /roles, and hardcoded audit page"
```

---

## Self-Review

**Spec coverage:**

- §4.2 `staffToken.ts` `chapters` claim → Task 2 Step 5. §4.3 effective-permissions algorithm → Task 2 (`effectivePermissionTags`), rendered in Task 6 (MembersTable) + Task 7 (EditMemberDrawer).
- §5.1 client bridge: the spec's `lib/vmsFunctions.ts` already exists as `lib/youthRepublicFunctions.ts` (same staff-JWT + `NEXT_PUBLIC_YOUTH_REPUBLIC_FUNCTIONS_URL` pattern) — Task 2 Step 7 extends it. `platformFunctions.ts` wrappers → Task 2 Step 6.
- §6.1 sidebar → Task 3. §6.2 layout + contextual header + sub-nav + `TeamAccessProvider` → Task 4; drawers owned by the layout → Task 5 (`TeamDrawersProvider`). §6.3 three pages → Tasks 6/8/11; deletions → Task 12. §6.4 `globals.css` additions → Task 1.
- §7.1 members screen (4 stat cards, 4 filters, table columns, Invite + Edit drawers) → Tasks 6 + 7. The "3 Admins · 3 Leads · 2 Reviewers" bucketing → Task 6 Step 3 (`LEAD_ROLES`/`REVIEWER_ROLES`/`ADMIN_ROLES`). 2FA % → Task 6 from `member.enforce2fa`.
- §7.2 roles screen (4 stat cards, type filter, capability-grid table, Create/Edit/Clone/View drawer, Operational Chapters panel) → Tasks 8 + 9 + 10.
- §7.3 audit screen (4 stat cards, action filter, table, CSV) → Task 11. Phase-1 scope (platform events only) matches — the page reads only `admin_audit_log`.
- §Global "stale `scope_label` after rename" → handled in MembersTable (Task 6, `chapterNameById` lookup with fallback) and the repeater re-derives label on scope change (Task 5).
- §9 limitation "activation email is a stub" → the invite drawer still sends `sendActivationEmail`; the backend logs the link. No accept-flow UI in this plan (out of scope, matches the prototype which has none).

**Placeholder scan:** every step has real code. The `ChaptersPanel` `panel-title` fallback and the `AppShell` `side-badge` number are explicit conditional instructions with a grep to decide, not placeholders. Task 5 uses named temporary stub files that are explicitly rewritten in Tasks 7/9/10.

**Type consistency:** `TeamMember` / `TeamRole` / `Chapter` / `MemberAssignment` defined in Task 4 (`TeamAccessProvider.tsx`), imported by Tasks 6–11. `RoleScopeRow` / `makeRoleScopeRow` / `rowsToAssignmentPayload` defined Task 5, used Task 7. `CapabilityGrid` / `CapabilityKey` / `CapabilityLevel` / `CAPABILITY_KEYS` / `CAPABILITY_META` / `RESTRICTED_GRID` / `gridToPermissionKeys` / `permissionKeysToGrid` / `effectivePermissionTags` defined Task 2, used Tasks 6/8/9. `useTeamDrawers` shape (`openInvite`/`openEditMember`/`openCreateRole`/`openEditRole`/`openCloneRole`) defined Task 5, consumed Tasks 6/8. `TeamHeaderAction` (`label`/`onClick`/`variant`) defined Task 4, set by Tasks 6/8/11, rendered by Task 4 layout. `inviteStaffMember`/`updateStaffAccess`/`removeStaffMember`/`createCustomRole`/`updateCustomRole`/`deleteCustomRole` payload shapes in Task 2 match the backend plan's handler input types. `AuditRow` field names match the `admin_audit_log` columns selected in Task 11.

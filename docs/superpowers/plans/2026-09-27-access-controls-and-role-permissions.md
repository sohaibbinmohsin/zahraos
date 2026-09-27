# Access Controls, Role Permissions, Chapter Scopes, and UI Matching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce strict alignment between backend staff claims/permissions and frontend UI elements across ZahraOS, eliminating orphaned sidebar elements, unhandled 403 API errors, and unauthorized mutation actions, while supporting chapter-isolated operational views and standardizing custom dropdowns.

**Architecture:** A centralized `useStaffPermissions` hook derives capability flags and chapter scopes from JWT claims and org tier. Navigation items (sidebar and top layout tabs), action buttons (create, publish, decide, approve), and dashboard widgets conditionally render based on these capabilities. An `<AccessDeniedGate />` protects direct URL navigation, and custom `@/components/ui/Select` popovers replace all native `<select>` tags in team drawers. Live browser testing and automated unit test matrices verify all 6 standard roles and chapter-scoped assignments.

**Tech Stack:** Next.js 15, React 19, TypeScript, Vitest, Testing Library, Supabase Auth/PostgREST.

**Spec:** `docs/superpowers/specs/2026-09-27-access-controls-and-role-permissions-design.md`

## Global Constraints

- **Custom Select Dropdowns**: Always use the custom `Select` component (`@/components/ui/Select`) instead of native HTML `<select>` tags across all forms, filters, tables, and modal dialogs.
- **Fail-Safe Data Fetching**: Any queries for conditional resources (like badges or dashboard KPIs) must verify user capability first and be wrapped in `Promise.allSettled` to prevent network/permission errors from unmounting or crashing the shell.
- **Strict Scope Boundaries**: Chapter-scoped users (`scopeKind: "chapter"`) must only be permitted to view, create, and triage data associated with their assigned chapter ID.
- **Zero Orphaned Headers**: Sidebar group headers (such as `"Team & Governance"`) and separators must only render if at least one sub-item is authorized for display.

---

### Task 1: Create Centralized `useStaffPermissions` Hook

**Files:**
- Create: `components/shell/useStaffPermissions.ts`
- Create: `components/shell/useStaffPermissions.test.ts`

**Interfaces:**
- Consumes: `useStaffClaims`, `useSelectedOrg`, `useOrgTier`, `useIsOrgAdminOrAbove` from `@/components/shell/AppShell`.
- Produces: `useStaffPermissions(): StaffPermissions` with boolean flags:
  `canViewDrives`, `canCreateDrives`, `canPublishDrives`, `canViewApplications`, `canTriageApplications`, `canViewHours`, `canApproveHours`, `canViewVolunteers`, `canAccessDashboard`, `canManageTeam`, `isChapterScoped`, `scopedChapterIds`, and `hasChapterPermission(permissionKey, targetChapterId)`.

- [ ] **Step 1: Write unit tests for `useStaffPermissions`**
  Cover:
  - Super Admin / Platform Owner (all capabilities true, chapter scope null)
  - Operations Lead (drives, publish, applications, triage, hours, approve, dashboard = true; team, volunteers = false)
  - Drive Coordinator (drives, applications, triage, hours, approve, dashboard = true; publish, team, volunteers = false)
  - Application Reviewer (applications, triage = true; dashboard, drives, hours, volunteers, team = false)
  - Auditor (applications, hours = true; triage, approve, drives, dashboard, team = false)
  - Chapter-scoped user (e.g. `opportunities:write` restricted to `["lhr"]`)

- [ ] **Step 2: Run test to confirm it fails**
  Run: `npm test components/shell/useStaffPermissions.test.ts` (expect module not found).

- [ ] **Step 3: Implement `useStaffPermissions.ts`**
  Extract claims for active org, evaluate permissions array, check `chapterScopes` mapping, and compute all capability booleans.

- [ ] **Step 4: Verify test passes**
  Run: `npm test components/shell/useStaffPermissions.test.ts`.

- [ ] **Step 5: Commit**
  `git add components/shell/useStaffPermissions* && git commit -m "feat(auth): implement useStaffPermissions hook and tests"`

---

### Task 2: Navigation & Shell Cleanup

**Files:**
- Modify: `components/shell/AppShell.tsx`
- Modify: `app/youth-republic/layout.tsx`
- Modify: `components/shell/AppShell.test.tsx`

**Interfaces:**
- Consumes: `useStaffPermissions` from `components/shell/useStaffPermissions.ts`.
- Produces: Gated sidebar links, safe badge counting with `Promise.allSettled`, and conditionally rendered top tabs.

- [ ] **Step 1: Update `AppShell.tsx`**
  - Move `<div className="sidebar-module-divider" />` and `<div className="nav-group-label">Team & Governance</div>` inside `{perms.canManageTeam && (...)}`.
  - Conditionally render Youth Republic nav items:
    - Dashboard: `{perms.canAccessDashboard && (...)}`
    - Drives: `{perms.canViewDrives && (...)}`
    - Applications: `{perms.canViewApplications && (...)}`
    - Hours Verification: `{perms.canViewHours && (...)}`
    - Volunteers: `{perms.canViewVolunteers && (...)}`
  - Guard badge loading: only call `listApplications` if `perms.canViewApplications`, only call `listActivityHours` if `perms.canViewHours`. Use `Promise.allSettled`.

- [ ] **Step 2: Update `app/youth-republic/layout.tsx`**
  - Filter `TAB_META` based on `perms.canAccessDashboard`, `perms.canViewDrives`, `perms.canViewApplications`, `perms.canViewHours`, `perms.canViewVolunteers`.
  - Guard badge count requests and use `Promise.allSettled`.

- [ ] **Step 3: Update `AppShell.test.tsx`**
  - Assert that non-admin staff do not see `"Team & Governance"` label or divider.
  - Assert that users without hours permissions do not see `"Hours Verification"`.

- [ ] **Step 4: Run tests to verify**
  Run: `npm test components/shell/AppShell.test.tsx app/youth-republic/layout.test.tsx`.

- [ ] **Step 5: Commit**
  `git add components/shell/AppShell.tsx components/shell/AppShell.test.tsx app/youth-republic/layout.tsx && git commit -m "fix(shell): gate navigation links, tabs, and badge fetches by permissions"`

---

### Task 3: Access Denied Route Gate & Direct Navigation Protection

**Files:**
- Create: `components/shell/AccessDeniedGate.tsx`
- Create: `components/shell/AccessDeniedGate.test.tsx`
- Modify: `app/youth-republic/drives/page.tsx`
- Modify: `app/youth-republic/applications/page.tsx`
- Modify: `app/youth-republic/hours/page.tsx`
- Modify: `app/youth-republic/volunteers/page.tsx`
- Modify: `app/youth-republic/dashboard/page.tsx`

**Interfaces:**
- Consumes: `useStaffPermissions`.
- Produces: `<AccessDeniedGate allowed={boolean} sectionName={string} fallbackRoute={string} fallbackLabel={string}>`

- [ ] **Step 1: Write tests for `AccessDeniedGate`**
  Verify it renders children when `allowed === true`, and renders an accessible "Access Denied" message with return link when `allowed === false`.

- [ ] **Step 2: Implement `AccessDeniedGate.tsx`**
  Clean card-styled panel matching ZahraOS typography and design tokens.

- [ ] **Step 3: Wrap protected pages with `AccessDeniedGate`**
  - Drives: `allowed={perms.canViewDrives}`
  - Applications: `allowed={perms.canViewApplications}`
  - Hours: `allowed={perms.canViewHours}`
  - Volunteers: `allowed={perms.canViewVolunteers}`
  - Dashboard: `allowed={perms.canAccessDashboard}`

- [ ] **Step 4: Run tests**
  Run: `npm test components/shell/AccessDeniedGate.test.tsx`.

- [ ] **Step 5: Commit**
  `git add components/shell/AccessDeniedGate* app/youth-republic/ && git commit -m "feat(security): add AccessDeniedGate and wrap operational routes"`

---

### Task 4: Action Button Permissions & Read-Only Modes

**Files:**
- Modify: `app/youth-republic/drives/page.tsx`
- Modify: `app/youth-republic/applications/page.tsx`
- Modify: `components/youth-republic/ApplicationReviewDrawer.tsx`
- Modify: `app/youth-republic/hours/page.tsx`
- Modify: `components/youth-republic/AdjustHoursDrawer.tsx`
- Modify: `app/youth-republic/dashboard/page.tsx`

**Interfaces:**
- Consumes: `perms.canCreateDrives`, `perms.canPublishDrives`, `perms.canTriageApplications`, `perms.canApproveHours`, `perms.hasChapterPermission`.

- [ ] **Step 1: Gating in Drives Page**
  - Hide `Create Drive` if `!perms.canCreateDrives`.
  - Hide `Publish drive` if `!perms.canPublishDrives`.
  - Hide `Edit`, `Archive`, `Delete`, `Restore` if `!perms.hasChapterPermission("opportunities:write", opp.chapterId)`.
  - Hide `Impact & Stats` if `!perms.canCreateDrives && !perms.canManageTeam`.
  - Hide `View Applicants` if `!perms.canViewApplications`.

- [ ] **Step 2: Gating in Applications Page & Review Drawer**
  - Hide decision buttons (`Select`, `Waitlist`, `Reject`, `Reconsider`) if `!perms.canTriageApplications`.
  - In `ApplicationReviewDrawer.tsx`, hide decision buttons when `!perms.canTriageApplications`.

- [ ] **Step 3: Gating in Hours Page & Adjust Drawer**
  - Hide `Bulk Assign Hours` button if `!perms.canApproveHours`.
  - Hide row actions (`Accredit`, `Reject`, `Adjust`) if `!perms.canApproveHours`.
  - In `AdjustHoursDrawer.tsx`, disable / hide save when `!perms.canApproveHours`.

- [ ] **Step 4: Resilient Dashboard Loading**
  - In `app/youth-republic/dashboard/page.tsx`, execute data requests via `Promise.allSettled`.
  - Render widgets for whichever resources succeed without failing the entire page.

- [ ] **Step 5: Run existing test suites**
  Run: `npm test app/youth-republic/drives/page.test.tsx app/youth-republic/applications/page.test.tsx app/youth-republic/hours/page.test.tsx app/youth-republic/dashboard/page.test.tsx`.

- [ ] **Step 6: Commit**
  `git commit -am "fix(perms): gate action buttons and enable read-only view modes"`

---

### Task 5: Standardize Select Dropdowns in Team Drawers

**Files:**
- Modify: `components/team/RoleScopeRepeater.tsx`
- Modify: `components/team/RoleDrawer.tsx`
- Modify: `components/team/EditMemberDrawer.tsx`
- Modify: `components/team/RoleScopeRepeater.test.tsx`
- Modify: `components/team/RoleDrawer.test.tsx`
- Modify: `components/team/EditMemberDrawer.test.tsx`

**Interfaces:**
- Consumes: `@/components/ui/Select` with `{ value, label }` options.
- Replaces: Native HTML `<select className="form-select">` elements.

- [ ] **Step 1: Replace native `<select>` in `RoleScopeRepeater.tsx`**
  Use `Select` for role selector and chapter scope selector.
- [ ] **Step 2: Replace native `<select>` in `RoleDrawer.tsx` & `EditMemberDrawer.tsx`**
  Use `Select` for role template selection, capability levels, and status dropdowns.
- [ ] **Step 3: Update and run drawer tests**
  Run: `npm test components/team/RoleScopeRepeater.test.tsx components/team/RoleDrawer.test.tsx components/team/EditMemberDrawer.test.tsx`.
- [ ] **Step 4: Commit**
  `git commit -am "refactor(ui): replace native select with custom Select in team drawers"`

---

### Task 6: Add Org Admin System Role & Chapter Assignment Support

**Files:**
- Modify: `components/team/TeamAccessProvider.tsx`
- Modify: `components/team/RoleDrawer.tsx`
- Modify: `lib/platformFunctions.ts`

**Interfaces:**
- Registers: `Org Admin` role in system roles alongside `Super Admin`.

- [ ] **Step 1: Ensure `Org Admin` role definition exists**
  Include `Org Admin` in role template lists and system role options with full operational permissions and `team:write`.
- [ ] **Step 2: Verify `TeamAccessProvider` and `RoleDrawer` handling**
  Ensure role rank and tags properly display `Org Admin`.
- [ ] **Step 3: Run team tests**
  Run: `npm test components/team/`.
- [ ] **Step 4: Commit**
  `git commit -am "feat(team): register Org Admin system role and verify chapter assignment support"`

---

### Task 7: Comprehensive Roles & Permissions Automated Test Matrix

**Files:**
- Create: `tests/permissions/rolesMatrix.test.tsx`

**Interfaces:**
- Exercises:
  1. `Super Admin` / `Org Admin`
  2. `Operations Lead`
  3. `Drive Coordinator`
  4. `Application Reviewer`
  5. `Auditor`
  6. `Chapter Coordinator (Lahore)`

- [ ] **Step 1: Write the matrix test suite**
  Simulate claims for each role and verify:
  - Sidebar links and top tabs visibility.
  - Action button visibility (Create Drive, Publish, Triage, Bulk Assign).
  - Chapter scope restriction on Create Opportunity chapter options.
  - AccessDeniedGate triggering when navigating to disallowed routes.
- [ ] **Step 2: Run the matrix test**
  Run: `npm test tests/permissions/rolesMatrix.test.tsx`.
- [ ] **Step 3: Commit**
  `git add tests/permissions/rolesMatrix.test.tsx && git commit -m "test(perms): add comprehensive roles and permissions test matrix"`

---

### Task 8: Live Browser Subagent Verification (`/browser`)

**Files:**
- Interactive verification via `invoke_subagent` (browser subagent) on `http://localhost:3000`.

- [ ] **Step 1: Verify Dev Server is running**
  Ensure dev server is healthy on port 3000.
- [ ] **Step 2: Run Browser Verification Workflow**
  - Navigate to `/youth-republic/dashboard`, `/youth-republic/drives`, `/youth-republic/applications`, `/youth-republic/hours`, `/team/members`.
  - Test UI rendering, navigation links, and absence of orphaned labels.
  - Open Team Member Invite drawer and inspect custom `<Select>` dropdowns.
  - Verify chapter scope selection and validation.
- [ ] **Step 3: Record findings and confirm clean operation**

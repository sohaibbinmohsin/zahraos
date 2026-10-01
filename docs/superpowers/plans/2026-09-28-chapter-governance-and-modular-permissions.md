# Chapter Governance, Roster Management & Modular Permissions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement dynamic role synchronization/demotions, unconstrained Super Admin, chapter-scoped Org Admin (Chapter Admin), chapter profile & leadership roster with YR ID verification, intra-org read-only visibility, modular permissions matrix, and capability-driven dashboard.

**Architecture:** Synchronize `staff_org_roles` with `staff_role_assignments` during assignment/demotion. Extend `chapters` with logo and about, and create `chapter_team_members` for verified Youth Republic volunteer rosters. Restructure capabilities in `lib/capabilityMap.ts` into Youth Republic and Team & Governance modules. Use pure capability primitives (`hasChapterPermission`, `canViewInquiries`) to eliminate forced rules across drawers, tables, and the dashboard.

**Tech Stack:** Next.js 16 (Turbopack, App Router), TypeScript, Tailwind CSS, Supabase (PostgreSQL RLS, Edge Functions, Storage), Vitest, React Testing Library.

**Spec:** [`docs/superpowers/specs/2026-09-28-chapter-governance-and-modular-permissions-design.md`](file:///home/ubuntu/development/zahraos/docs/superpowers/specs/2026-09-28-chapter-governance-and-modular-permissions-design.md)

## Global Constraints

- **Custom Select Dropdowns:** Always use the custom `Select` component (`@/components/ui/Select`) instead of native HTML `<select>` tags across all forms, filters, tables, and modal dialogs.
- **Fail-Safe Data Fetching:** Any queries for conditional resources must verify capability first and use `Promise.allSettled`.
- **Strict Scope Boundaries:** Chapter-scoped users must only be permitted to mutate data associated with their assigned chapter ID.
- **Zero Forced Rules:** Use fine-grained capability checks (`canViewDrives`, `canViewApplications`, `hasChapterPermission`) rather than arbitrary thresholds (`grantedCount >= 3`) or hardcoded role string matching.
- **Intra-Org Visibility:** Chapter Admins can view the organization profile and other chapters in read-only mode, but can only edit their assigned chapter.
- **Protected Branches:** Never push directly to `main` or merge PRs into `main`. Work on `feat/access-controls-and-role-permissions`.

---

### Task 1: Database Migrations, Demotion Lifecycle & Staff Token Minting Sync

**Files:**
- Create: `supabase/migrations/0017_chapter_profiles_and_roster.sql`
- Modify: `supabase/functions/update-staff-access/handler.ts`
- Modify: `supabase/functions/invite-staff-member/handler.ts`
- Modify: `supabase/functions/mint-staff-token/handler.ts`
- Test: `tests/permissions/task1_demotion_sync.test.ts` (or Deno tests)

**Interfaces:**
- Consumes: `staff_role_assignments`, `staff_org_roles`, `chapters`
- Produces: Synced `staff_org_roles` upon promotion/demotion; extended `chapters` (`logo_url`, `about`) and `chapter_team_members` table; token claims with accurate chapter scopes.

- [ ] **Step 1: Write database migration `0017_chapter_profiles_and_roster.sql`**
  Add `logo_url` and `about` to `chapters`. Create `chapter_team_members` with `(id, chapter_id, volunteer_code, full_name, email, avatar_url, designation, term, status, created_at, created_by)` and unique index `(chapter_id, volunteer_code, term)`. Add RLS policy for intra-org staff read access.
- [ ] **Step 2: Update `update-staff-access/handler.ts` and `invite-staff-member/handler.ts`**
  - If assigned `Super Admin` (org-wide): upsert `staff_org_roles` with `org_tier = 'super_admin'`. Reject if `scopeKind === 'chapter'`.
  - If assigned `Org Admin` (org-wide): upsert `staff_org_roles` with `org_tier = 'admin'`.
  - If assigned `Org Admin` (chapter-scoped) or lower role: delete from `staff_org_roles` where `staff_id = targetId and organization_id = orgId`.
- [ ] **Step 3: Update `mint-staff-token/handler.ts`**
  Construct `moduleAccess` permissions and `chapter_scopes` strictly from `staff_role_assignments`. If user holds Super Admin or National Org Admin, grant full permissions without chapter scoping (`anyOrgWide: true`).
- [ ] **Step 4: Execute migration in Supabase database and verify**
  Run DDL via Supabase client / sql execution.
- [ ] **Step 5: Run tests and commit**
  Verify handler tests pass. Commit with message: `feat(db): add chapter profiles, roster schema, and dynamic demotion synchronization`.

---

### Task 2: Youth Republic ID Lookup & Chapter Team Roster Backend Functions

**Files:**
- Create: `supabase/functions/lookup-youth-republic-member/handler.ts` & `index.ts`
- Modify: `supabase/functions/update-chapter/handler.ts`
- Modify: `lib/platformFunctions.ts`
- Test: `lib/platformFunctions.test.ts`

**Interfaces:**
- Consumes: Youth Republic `volunteers` table (`volunteer_code`)
- Produces: `lookupYouthRepublicMember({ organizationId, youthRepublicId }, staffToken)` and updated `updateChapter({ chapterId, name, city, logoUrl, about, teamMembers }, accessToken)`.

- [ ] **Step 1: Create `lookup-youth-republic-member` Edge Function**
  Takes `organizationId` and `youthRepublicId`. Queries Youth Republic `volunteers` by `volunteer_code` (case-insensitive). Returns `{ volunteerCode, fullName, email, avatarUrl }` or throws 404 `volunteer_not_found`.
- [ ] **Step 2: Update `update-chapter/handler.ts`**
  Accept `logoUrl`, `about`, and `teamMembers`. Check caller permissions: allow if org-wide admin, or if chapter-scoped admin matching `chapterId`. Upsert/sync `chapter_team_members` atomically.
- [ ] **Step 3: Update `lib/platformFunctions.ts`**
  Add `lookupYouthRepublicMember` and extend `UpdateChapterInput` with `logoUrl`, `about`, and `teamMembers`. Add `listChapterTeamMembers`.
- [ ] **Step 4: Write unit tests in `lib/platformFunctions.test.ts`**
  Assert `lookupYouthRepublicMember` calls endpoint, handles volunteer not found, and `updateChapter` passes payload.
- [ ] **Step 5: Run tests and commit**
  Run `npx vitest run lib/platformFunctions.test.ts`. Commit: `feat(backend): add YR volunteer lookup and chapter roster management functions`.

---

### Task 3: Modular Capability Map & Permission Hooks

**Files:**
- Modify: `lib/capabilityMap.ts`
- Modify: `components/shell/useStaffPermissions.ts`
- Test: `lib/capabilityMap.test.ts`
- Test: `components/shell/useStaffPermissions.test.ts`

**Interfaces:**
- Consumes: JWT permission keys and chapter scopes.
- Produces: Modular `CapabilityGrid` (Youth Republic + Team & Governance), `deriveRoleTitleFromPermissions` supporting "Chapter Admin", and unforced `useStaffPermissions` hooks.

- [ ] **Step 1: Write failing tests in `lib/capabilityMap.test.ts` and `components/shell/useStaffPermissions.test.ts`**
  Test conversion of modular permissions (including `inquiries:read/write`), role title resolution ("Chapter Admin" for chapter-scoped Org Admin, "Super Admin" for super admin), and unforced dashboard access.
- [ ] **Step 2: Restructure `lib/capabilityMap.ts`**
  Organize capabilities by module:
  - Youth Republic: `drive`, `publish`, `triage`, `hours`, `volunteers`.
  - Team & Governance: `org_governance`, `members`, `roles`, `audit`, `inquiries`.
  Update `deriveRoleTitleFromPermissions` to return `"Super Admin"`, `"Org Admin"`, and `"Chapter Admin"`.
- [ ] **Step 3: Update `components/shell/useStaffPermissions.ts`**
  - Implement `canAccessDashboard = canViewDrives || canViewApplications || canViewHours || canViewVolunteers`.
  - Implement `canManageOrgProfile = !isChapterScoped && canManageTeam`.
  - Implement `canCreateChapters = !isChapterScoped && canManageTeam`.
  - Implement `canEditChapter = (chapterId: string) => hasChapterPermission("chapters:write", chapterId)`.
  - Implement `canViewInquiries = !isChapterScoped && (isAdmin || hasPerm("inquiries:read"))`.
- [ ] **Step 4: Run tests and verify**
  Run `npx vitest run lib/capabilityMap.test.ts components/shell/useStaffPermissions.test.ts`.
- [ ] **Step 5: Commit changes**
  Commit: `feat(perms): modularize capability grid and implement clean permission rules`.

---

### Task 4: Super Admin Scope Lock & Modular Roles Matrix UI

**Files:**
- Modify: `components/team/RoleScopeRepeater.tsx`
- Modify: `components/team/RoleDrawer.tsx`
- Modify: `components/team/RolesTable.tsx`
- Test: `components/team/RoleScopeRepeater.test.tsx`
- Test: `components/team/RoleDrawer.test.tsx`
- Test: `components/team/RolesTable.test.tsx`

**Interfaces:**
- Consumes: Modular capabilities from `lib/capabilityMap.ts`
- Produces: Locked scope for Super Admin, chapter selection for Org Admin, sectioned role drawer and table.

- [ ] **Step 1: Update `RoleScopeRepeater.tsx` and test**
  When `Super Admin` is selected: hide the chapter dropdown and render a locked badge: `National / All Chapters (Full Platform Access)`.
  When `Org Admin` is selected: render `National / All Chapters` or chapter options.
- [ ] **Step 2: Update `RoleDrawer.tsx`**
  Split capabilities into two visual sections: `Youth Republic Operations` and `Team & Governance`. Use custom `@/components/ui/Select` for each capability. Restrict Partner Inquiries to Super Admin and National Org Admin templates.
- [ ] **Step 3: Update `RolesTable.tsx`**
  Render grouped multi-level column headers: Role Info | Youth Republic | Team & Governance | Actions.
- [ ] **Step 4: Run test suites**
  Run `npx vitest run components/team/RoleScopeRepeater.test.tsx components/team/RoleDrawer.test.tsx components/team/RolesTable.test.tsx`.
- [ ] **Step 5: Commit changes**
  Commit: `feat(team): enforce Super Admin scope lock and render modular roles matrix`.

---

### Task 5: EditChapterDrawer with Logo Upload, YR ID Verification & Active/Alumni Roster

**Files:**
- Create: `components/team/EditChapterDrawer.tsx`
- Test: `components/team/EditChapterDrawer.test.tsx`

**Interfaces:**
- Consumes: `lookupYouthRepublicMember`, `updateChapter`, Supabase storage `org-logos`.
- Produces: Interactive drawer for chapter profile editing, logo upload, YR ID account verification, custom designation input, and active/alumni roster management.

- [ ] **Step 1: Write unit tests in `components/team/EditChapterDrawer.test.tsx`**
  Test rendering chapter details, searching valid YR ID showing volunteer preview card, adding member with custom designation, transitioning member to alumni, and read-only mode.
- [ ] **Step 2: Implement `EditChapterDrawer.tsx`**
  - Chapter Name & City inputs.
  - Chapter Logo uploader with preview (upload to `org-logos` bucket `${orgId}/chapters/${chapterId}/logo-${timestamp}.png`).
  - Chapter Description / About textarea.
  - Roster section with `Active Leadership` and `Alumni Roster` tabs.
  - "Add Team Member" form: YR ID input with "Verify ID" button, volunteer confirmation card, free-text Designation input, Term input, "Add to Chapter Roster" button.
  - Read-only mode for view-only users.
- [ ] **Step 3: Run tests and verify**
  Run `npx vitest run components/team/EditChapterDrawer.test.tsx`.
- [ ] **Step 4: Commit changes**
  Commit: `feat(team): implement EditChapterDrawer with YR ID verification and roster lifecycle`.

---

### Task 6: Intra-Org Visibility on ChaptersPanel & Organization Page

**Files:**
- Modify: `components/team/ChaptersPanel.tsx`
- Modify: `app/organization/page.tsx`
- Modify: `components/shell/AppShell.tsx`
- Test: `components/team/ChaptersPanel.test.tsx`
- Test: `app/organization/page.test.tsx`

**Interfaces:**
- Consumes: `useStaffPermissions` (`canManageOrgProfile`, `canCreateChapters`, `canEditChapter`, `canViewInquiries`), `EditChapterDrawer`.
- Produces: Intra-org chapter visibility with edit own / view details other chapters; read-only org profile; Partner Inquiries gating.

- [ ] **Step 1: Update `ChaptersPanel.tsx`**
  - Render all active chapters in the table for intra-org visibility.
  - For each row: if `canEditChapter(c.id)` render "Edit" (opens `EditChapterDrawer`) and "Deactivate"; if not, render "View Details" (opens read-only `EditChapterDrawer`).
  - Render "Add Chapter" button only if `canCreateChapters`.
- [ ] **Step 2: Update `app/organization/page.tsx`**
  - Allow Chapter Admins to access page.
  - If `!canManageOrgProfile`: disable Organization Name, Brand Color, About textarea, and Logo upload; hide "Save Profile" button.
- [ ] **Step 3: Update `components/shell/AppShell.tsx`**
  - Gate "Partner Inquiries" sidebar item and header on `perms.canViewInquiries` (visible only to Super Admin and National Org Admin).
- [ ] **Step 4: Run tests and verify**
  Run `npx vitest run components/team/ChaptersPanel.test.tsx app/organization/page.test.tsx components/shell/AppShell.test.tsx`.
- [ ] **Step 5: Commit changes**
  Commit: `feat(organization): implement intra-org visibility and scoped chapter editing`.

---

### Task 7: Capability-Driven Operations Dashboard Gating

**Files:**
- Modify: `app/youth-republic/dashboard/page.tsx`
- Test: `app/youth-republic/dashboard/page.test.tsx`

**Interfaces:**
- Consumes: `useStaffPermissions` (`canViewDrives`, `canViewApplications`, `canViewHours`, `canViewVolunteers`, `isChapterScoped`, `scopedChapterIds`).
- Produces: Pure capability-gated dashboard with zero forced rules and contextual chapter telemetry subtitle.

- [ ] **Step 1: Update `app/youth-republic/dashboard/page.tsx`**
  - Remove all forced rules and arbitrary counts.
  - Gate queries in `Promise.allSettled`: only fetch `getKpiSummary` if `canViewVolunteers`, only fetch drives if `canViewDrives`, only fetch applications if `canViewApplications`, only fetch hours if `canViewHours`.
  - Gate Stat Cards: render only permitted cards.
  - Gate Widgets: render Volunteer Capacity widget only if `canViewDrives`; render Recent Applications only if `canViewApplications`.
  - Header telemetry: show *"Live operations & shift telemetry for [Chapter Name]"* when chapter-scoped, otherwise *"Organization-wide operations & telemetry across all chapters."*
- [ ] **Step 2: Update unit tests in `app/youth-republic/dashboard/page.test.tsx`**
  Test single-capability staff (e.g. applications-only reviewer) sees only applications card without 403 on KPIs; test chapter-scoped subtitle rendering.
- [ ] **Step 3: Run tests and verify**
  Run `npx vitest run app/youth-republic/dashboard/page.test.tsx`.
- [ ] **Step 4: Commit changes**
  Commit: `feat(dashboard): implement unforced capability-gated widgets and chapter telemetry`.

---

### Task 8: Comprehensive Automated Roles & Governance Test Matrix

**Files:**
- Modify: `tests/permissions/rolesMatrix.test.tsx`

**Interfaces:**
- Consumes: All updated components, drawers, hooks, and role profiles.
- Produces: 100% verified test matrix across Super Admin, National Org Admin, Chapter Admin, Operations Lead, Drive Coordinator, Application Reviewer, and Auditor.

- [ ] **Step 1: Update `tests/permissions/rolesMatrix.test.tsx`**
  Add assertions for:
  - Super Admin: unconstrained scope, full access across all modules, Partner Inquiries visible, profile badge "Super Admin".
  - National Org Admin: full access across all modules, Partner Inquiries visible, profile badge "Org Admin".
  - Chapter Admin: profile badge "Chapter Admin", can edit assigned chapter, view-only other chapters, read-only org profile, no chapter creation, Partner Inquiries hidden.
  - Demotion test: assigning Chapter Admin removes org-tier bypass.
- [ ] **Step 2: Run full test suite**
  Execute `npx vitest run` and confirm all test files pass.
- [ ] **Step 3: Run build verification**
  Execute `npm run build` and confirm 100% clean compilation.
- [ ] **Step 4: Commit changes**
  Commit: `test(perms): add comprehensive roles matrix for chapter governance and modular permissions`.

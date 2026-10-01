# Design Specification: Chapter Governance, Roster Management & Modular Permissions Architecture

**Date:** 2026-09-28  
**Author:** Google DeepMind Pair Programming Assistant & ZahraOS Engineering  
**Status:** Approved & Ready for Implementation  
**Target Branches:** `feat/access-controls-and-role-permissions` (ZahraOS) & `main` (Youth Republic)

---

## 1. Overview & Objectives

This specification defines the complete architecture for administrative access control, chapter leadership governance, and granular permission management across ZahraOS and Youth Republic:
1. **Dynamic Permission Synchronization & Demotion Lifecycle:**
   - Eliminate synchronization drift between `staff_role_assignments` and `staff_org_roles`.
   - When a staff member is promoted to **Super Admin** or **Org Admin (National)**, `staff_org_roles` is automatically synchronized with `org_tier = 'super_admin'` or `'admin'`, granting immediate Postgres RLS and backend Edge Function recognition.
   - When a staff member is demoted to **Chapter Admin** or a lower role, any org-wide admin tier in `staff_org_roles` is immediately revoked, constraining their authority strictly to their assigned chapter.
2. **Super Admin vs. Org Admin Scope Boundaries:**
   - **Super Admin:** Locked to unconstrained, organization-wide access. No chapter dropdown or scope selection is presented in the UI or accepted by backend Edge Functions. Profile badge displays **"Super Admin"**.
   - **Org Admin:** Configurable as either **National / All Chapters** (profile badge **"Org Admin"**) or scoped to a specific chapter (profile badge **"Chapter Admin"**).
3. **Chapter Profile & Leadership Roster Management:**
   - Extend `chapters` with custom emblems/logos and rich description/about text.
   - Introduce `chapter_team_members` with tenure/term (e.g. *"2025–2026"*), active vs. alumni status, custom designations (e.g. *"President"*, *"Head of Outreach"*), and verified Youth Republic IDs (`volunteer_code`).
   - Dedicated Youth Republic ID verification endpoint ensuring only registered Youth Republic accounts can be added to chapter rosters.
4. **Intra-Organizational Visibility via Rules:**
   - Chapter Admins can view the organization profile (read-only) and view all chapters in the organization (read-only) for cross-chapter awareness, but can only edit their own chapter. Chapter creation remains restricted to national leadership.
5. **Modular Roles & Permissions Architecture:**
   - Cleanly partition permissions across two distinct modules in the UI and backend:
     - **Youth Republic (Volunteer Operations):** Drive Management (Write/Read), Noticeboard (Write/Read), Application Triage (Update/Read), Hours Verification (Update/Read), Volunteer Directory (Read).
     - **Team & Governance:** Organization & Chapters, Team Members & Access, Custom Roles & Matrix, Audit Log Inspection, and **Partner Inquiries** (strictly reserved for Super Admin and National Org Admin).
6. **Capability-Driven Operations Dashboard (Zero Forced Rules):**
   - Eliminate arbitrary thresholds (e.g. legacy `grantedCount >= 3`).
   - Access to the dashboard is granted if the user can view any operational domain (`canViewDrives || canViewApplications || canViewHours || canViewVolunteers`).
   - Every dashboard card and widget is independently capability-gated.
   - Chapter-scoped users automatically receive chapter-filtered telemetry and header context.

---

## 2. Dynamic Authorization Lifecycle & Demotion Model

### 2.1 The Two-Table Synchronization Architecture
ZahraOS utilizes two tables for access control:
- `staff_role_assignments`: Stores specific role references and operational scopes (`org_wide` vs `chapter`).
- `staff_org_roles`: Used by Postgres Row Level Security (`is_org_admin_or_above`) and platform backend checks.

#### Lifecycle Rules:
1. **Assigning Super Admin:**
   - Enforce `scope_kind = 'org_wide'` and `chapter_id = null`.
   - Upsert `staff_org_roles` with `org_tier = 'super_admin'`.
2. **Assigning Org Admin (National / All Chapters):**
   - Enforce `scope_kind = 'org_wide'` and `chapter_id = null`.
   - Upsert `staff_org_roles` with `org_tier = 'admin'`.
3. **Demoting from National Admin to Chapter Admin or Lower Role:**
   - If a user previously had `staff_org_roles` and is reassigned to a chapter-scoped role or lower role without national admin authority:
     - Delete their row in `staff_org_roles` for that organization.
     - This immediately revokes org-wide Postgres RLS bypass and forces all backend queries to respect chapter-scoped RLS and Edge Function chapter authorization.
4. **Deactivating or Removing Member:**
   - Deleting assignments or deactivating a member deletes their `staff_org_roles` row and revokes all module grants.

### 2.2 Token Minting (`mint-staff-token`)
- Inspect `staff_role_assignments`:
  - If user holds `Super Admin`, mint token with full unconstrained permissions across all modules (`anyOrgWide: true`).
  - If user holds `Org Admin (National)`, mint token with full unconstrained permissions across all modules (`anyOrgWide: true`).
  - If user holds `Org Admin (Chapter: X)`, mint token with full permissions for Youth Republic and Chapter Governance, but with `chapter_scopes` strictly pinned to chapter `X`.
  - If demoted, newly minted tokens immediately reflect the restricted chapter scope.

### 2.3 User Display Role Resolution
In `deriveRoleTitleFromPermissions(permissions, isChapterScoped)`:
- Super Admin -> **"Super Admin"**
- Org Admin (Org-wide) -> **"Org Admin"**
- Org Admin (Chapter-scoped) -> **"Chapter Admin"**
- Operations Lead -> **"Operations Lead"** (or **"Chapter Operations Lead"**)
- Drive Coordinator -> **"Drive Coordinator"** (or **"Chapter Coordinator"**)
- Application Reviewer -> **"Application Reviewer"**
- Auditor -> **"Auditor"**

---

## 3. Database Schema Migrations

### 3.1 Migration: `0017_chapter_profiles_and_roster.sql`
```sql
-- 1. Extend chapters with logo and about
alter table chapters add column if not exists logo_url text;
alter table chapters add column if not exists about text;

-- 2. Chapter Team Members Roster table
create table if not exists chapter_team_members (
  id             uuid primary key default gen_random_uuid(),
  chapter_id     uuid not null references chapters(id) on delete cascade,
  volunteer_code text not null, -- Indexed Youth Republic ID (e.g. YR-2026-000123)
  full_name      text not null,
  email          text,
  avatar_url     text,
  designation    text not null, -- Custom title: "President", "Media Lead", etc.
  term           text,          -- Tenure/session: e.g. "2025–2026"
  status         text not null default 'active' check (status in ('active', 'alumni')),
  created_at     timestamptz not null default now(),
  created_by     uuid references staff(id),
  unique (chapter_id, volunteer_code, term)
);

create index if not exists chapter_team_members_chapter_idx on chapter_team_members (chapter_id);
create index if not exists chapter_team_members_code_idx on chapter_team_members (volunteer_code);
create index if not exists chapter_team_members_status_idx on chapter_team_members (status);

-- 3. RLS for chapter_team_members
alter table chapter_team_members enable row level security;

create policy chapter_team_members_select on chapter_team_members
  for select using (
    exists (
      select 1 from chapters c
      where c.id = chapter_team_members.chapter_id
        and (is_platform_owner() or is_org_admin_or_above(c.organization_id)
             or exists (
               select 1 from staff_role_assignments sra
               where sra.staff_id = current_staff_id()
                 and sra.organization_id = c.organization_id
             ))
    )
  );

-- 4. Partner Inquiries permission
insert into permissions (module_id, resource, action)
select m.id, r.resource, r.action
from modules m
cross join (values ('inquiries', 'read'), ('inquiries', 'write')) as r(resource, action)
where m.key = 'youth-republic'
on conflict (module_id, resource, action) do nothing;
```

---

## 4. Backend Edge Functions & Verification

### 4.1 Youth Republic ID Lookup (`lookup-youth-republic-member`)
- **Endpoint:** `POST /functions/v1/lookup-youth-republic-member`
- **Auth:** Requires valid authenticated ZahraOS staff token.
- **Input:** `{ organizationId: string, youthRepublicId: string }`
- **Logic:**
  1. Normalize input ID: `code = youthRepublicId.trim().toUpperCase()`.
  2. Query Youth Republic `volunteers` table:
     `select id, volunteer_code, full_name, email, profile_picture_url, status from volunteers where upper(volunteer_code) = code`
  3. If not found or status != 'active':
     Return HTTP 404 with `{ error: "volunteer_not_found", message: "No active Youth Republic account found with ID " + code }`.
  4. Return `{ volunteerCode: v.volunteer_code, fullName: v.full_name, email: v.email, avatarUrl: v.profile_picture_url }`.

### 4.2 Updating Chapter Details & Team Roster (`update-chapter`)
- **Input:**
  ```ts
  interface UpdateChapterInput {
    chapterId: string;
    name?: string;
    city?: string | null;
    status?: "active" | "inactive";
    logoUrl?: string | null;
    about?: string | null;
    teamMembers?: Array<{
      id?: string;
      volunteerCode: string;
      fullName: string;
      email?: string | null;
      avatarUrl?: string | null;
      designation: string;
      term?: string | null;
      status: "active" | "alumni";
    }>;
  }
  ```
- **Authorization:**
  - If caller is platform owner, Super Admin, or National Org Admin: allowed for any chapter.
  - If caller is Chapter Admin: verify `callerStaffAssignments.some(a => a.chapter_id === input.chapterId && a.roleName === 'Org Admin')`. If not matching chapter, return 403 `forbidden`.
- **Operations:**
  - Updates `chapters` row (`name`, `city`, `status`, `logo_url`, `about`).
  - If `teamMembers` provided:
    - Synchronizes `chapter_team_members` for `chapter_id`.
  - Writes audit log event (`action: "Chapter Updated"`).

### 4.3 Updating Staff Access (`update-staff-access` & `invite-staff-member`)
- **Super Admin Rule:** If role is `Super Admin`, reject any request where `scopeKind === 'chapter'` or `chapterId != null`.
- **Org Tier Sync:**
  - If target user has an org-wide role with `team:write` and full capabilities (`Super Admin` -> `super_admin`, `Org Admin` org-wide -> `admin`):
    - Upsert `staff_org_roles`.
  - Else (user is Chapter Admin, or any lower role):
    - Delete from `staff_org_roles` where `staff_id = targetId and organization_id = orgId`.

---

## 5. Frontend & UI Specifications

### 5.1 Role Scope Repeater (`components/team/RoleScopeRepeater.tsx`)
- When **Super Admin** is selected in the role dropdown:
  - Do NOT render a chapter selection dropdown.
  - Render a locked pill badge: **`National / All Chapters (Full Platform Access)`**.
- When **Org Admin** is selected:
  - Scope dropdown renders:
    - `National / All Chapters`
    - Or specific chapters from `chapters` list.
- When any chapter is selected, label automatically reflects the chosen chapter name.

### 5.2 Chapter Management & Drawer (`components/team/ChaptersPanel.tsx` & `EditChapterDrawer.tsx`)
- In `ChaptersPanel.tsx`:
  - Show all active chapters in the organization table.
  - Action buttons per row:
    - If `canEditChapter(c.id)`:
      - **"Edit"** button (opens `EditChapterDrawer`).
      - **"Deactivate"** / **"Reactivate"** button.
    - If `!canEditChapter(c.id)`:
      - **"View Details"** button (opens read-only preview of the chapter).
  - "Add Chapter" button is only visible if `canCreateChapters` (`!isChapterScoped && canManageTeam`).
- In `EditChapterDrawer.tsx`:
  - **Chapter Profile Section:**
    - Chapter Name (input)
    - City (input)
    - Chapter Logo (upload to Supabase storage bucket `org-logos` + preview)
    - Chapter Description / About (textarea)
  - **Leadership & Team Roster Section:**
    - Sub-tabs: **Active Leadership** & **Alumni Roster**
    - Active Leadership table: Avatar, Name, Youth Republic ID (`volunteer_code`), Designation, Term, and Actions (Edit Designation, Move to Alumni, Remove).
    - **"Add Team Member" Card:**
      - Input: `Youth Republic ID` (e.g. `YR-2026-000001`) + "Verify ID" button.
      - Upon verification: renders volunteer identity card (avatar, verified badge, name, email).
      - Input: `Designation` (text: e.g. "President", "Vice President", "Media Lead").
      - Input: `Tenure / Term` (text: default to "2025–2026").
      - Button: "Add to Chapter Roster".
  - Read-Only Mode: If opened via "View Details", all form inputs, uploads, and roster mutation buttons are disabled/hidden.

### 5.3 Modular Roles & Permissions Matrix (`/team/roles` & `RoleDrawer.tsx`)
- **Capability Map Restructuring (`lib/capabilityMap.ts`):**
  - Group capabilities by module:
    - `MODULE_CAPABILITIES`:
      - **Youth Republic:**
        - `drive`: Drive Management (`granted` [write+read], `read_only` [read], `restricted`)
        - `publish`: Publish Noticeboard (`granted` [write], `read_only` [read], `restricted`)
        - `triage`: Application Triage (`granted` [update+read], `read_only` [read], `restricted`)
        - `hours`: Hours Verification (`granted` [update+read], `read_only` [read], `restricted`)
        - `volunteers`: Volunteer Directory (`read_only` [read], `restricted`)
      - **Team & Governance:**
        - `org_governance`: Organization & Chapters (`granted` [write+read], `read_only` [read], `restricted`)
        - `members`: Team Members & Access (`granted` [write+read], `read_only` [read], `restricted`)
        - `roles`: Custom Roles & Matrix (`granted` [write+read], `read_only` [read], `restricted`)
        - `audit`: Audit Log Inspection (`read_only` [read], `restricted`)
        - `inquiries`: Partner Inquiries (`granted` [write+read], `read_only` [read], `restricted`)
- **Roles Table (`components/team/RolesTable.tsx`):**
  - Sectioned table columns with visual dividers for **Youth Republic** and **Team & Governance**.
- **Role Drawer (`components/team/RoleDrawer.tsx`):**
  - Two distinct fieldset sections:
    - **Youth Republic Operations**
    - **Team & Governance**
  - Super Admin and National Org Admin templates prefill all capabilities as Granted.
  - Chapter Admin template prefills Youth Republic capabilities as Granted, Organization & Chapters as Granted (scoped), Team Members as Granted (scoped), Partner Inquiries as Restricted, Roles as Restricted.
  - Partner Inquiries capability is restricted to Super Admin and National Org Admin.

### 5.4 Capability-Driven Dashboard (`app/youth-republic/dashboard/page.tsx`)
- **Unforced Access Rule:**
  ```ts
  canAccessDashboard = canViewDrives || canViewApplications || canViewHours || canViewVolunteers;
  ```
- **Fine-Grained Widget Gating:**
  - `canViewDrives`: Renders Active Drives Stat Card & Volunteer Capacity Widget.
  - `canViewApplications`: Renders Applications to Review Stat Card & Recent Applications Widget.
  - `canViewHours`: Renders Hours to Verify Stat Card.
  - `canViewVolunteers`: Renders Active Volunteers Stat Card & fetches `getKpiSummary`.
- **Chapter Scoping:**
  - Edge Functions automatically scope query results to user's chapter token claims.
  - Subtitle dynamically shows chapter context:
    - Org-wide: *"Organization-wide operations & telemetry across all chapters."*
    - Chapter-scoped: *"Live operations & shift telemetry for [Chapter Name]."*

---

## 6. Testing & Quality Assurance Plan

1. **Unit & Integration Tests:**
   - `lib/capabilityMap.test.ts`: Test modular capability grid conversion, round-tripping, and permission key expansion.
   - `components/team/RoleScopeRepeater.test.tsx`: Test that Super Admin disables/hides chapter selection and Org Admin permits both National and Chapter selection.
   - `components/team/RoleDrawer.test.tsx`: Test modular sectioned rendering, capability level selections, and role cloning.
   - `components/team/ChaptersPanel.test.tsx`: Test chapter edit button vs view details button for chapter-scoped users vs national admins.
   - `components/team/EditChapterDrawer.test.tsx`: Test chapter profile editing, logo upload trigger, YR ID verification, custom designation input, and roster state changes (active to alumni).
   - `app/youth-republic/dashboard/page.test.tsx`: Test capability-gated widget rendering (e.g. applications-only reviewer sees only applications card without 403 on KPIs).
   - `tests/permissions/rolesMatrix.test.tsx`: Verify all roles across the expanded modular matrix, confirming Partner Inquiries is accessible only to Super Admin and National Org Admin, and Chapter Admin has strictly chapter-scoped mutation rights.
2. **End-to-End Build & Type Verification:**
   - Execute `npm test` verifying all suites pass.
   - Execute `npm run build` verifying Turbopack and TypeScript compile cleanly with zero errors.

---

## 7. Delivery Plan

Following user approval of this specification, implementation will proceed via `subagent-driven-development` across structured tasks:
- **Task 1:** Database migrations (`0017_chapter_profiles_and_roster.sql`), Edge Functions (`lookup-youth-republic-member`, updated `update-chapter`), and backend RLS/demotion sync in `update-staff-access`.
- **Task 2:** Update `lib/capabilityMap.ts` and `useStaffPermissions.ts` for modular capabilities (Youth Republic + Team & Governance, Partner Inquiries gating, chapter scoping rules, and unforced dashboard gating).
- **Task 3:** Update `RoleScopeRepeater`, `RoleDrawer`, and `RolesTable` with modular module sections and Super Admin unconstrained scope enforcement.
- **Task 4:** Implement `EditChapterDrawer` with Chapter Profile, Logo Upload, YR ID Account Verification, custom Designations, and Active/Alumni Roster.
- **Task 5:** Wire `ChaptersPanel` and `/organization` with intra-org visibility rules (edit own chapter, view other chapters, read-only org profile for Chapter Admin).
- **Task 6:** Update `app/youth-republic/dashboard/page.tsx` for natural capability-driven widget gating and chapter subtitle telemetry.
- **Task 7:** Comprehensive automated test matrix and regression verification across all role profiles.

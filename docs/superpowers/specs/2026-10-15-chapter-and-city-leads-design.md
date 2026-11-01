# Chapter Lead & City Lead Roles, AWS-Inspired IAM Architecture & Verification Spec

## Overview
This specification details the transition from the legacy `Operations Lead` system role to `Chapter Lead` and `City Lead`, introduces an AWS IAM-inspired UX and functional architecture for role building and member resource scoping, unlocks chapter details and roster governance for chapter/city leads, provides dedicated seed accounts with known test credentials, and establishes an exhaustive role-by-role task verification matrix.

---

## 1. System Roles & Data Model Evolution

### 1.1 Role Definitions
1. **`Chapter Lead`** (replaces legacy `Operations Lead`):
   * **Scope**: Chapter-scoped (single chapter).
   * **Description**: *"Oversees local chapter operations, drive execution, applicant selection, hours verification, and chapter roster governance."*
   * **Capabilities & Permissions**:
     * Operational: `opportunities:write`, `opportunities:read`, `noticeboard:write`, `noticeboard:read`, `applications:update`, `applications:read`, `hours:update`, `hours:read`.
     * Chapter Governance: `chapters:write`, `chapters:read`.
     * Restricted: `members`, `roles`, `audit`, `inquiries`, `team`, `volunteers`.
2. **`City Lead`**:
   * **Scope**: Multi-chapter scoped (two or more chapters).
   * **Description**: *"Oversees multi-chapter regional operations, drive execution, applicant selection, hours verification, and chapter roster governance."*
   * **Capabilities & Permissions**:
     * Identical permission keys to Chapter Lead (`opportunities:write/read`, `noticeboard:write/read`, `applications:update/read`, `hours:update/read`, `chapters:write/read`).

### 1.2 Migration `0018_chapter_and_city_leads.sql`
* **Role Function Update**:
  * Update `seed_youth_republic_system_roles(p_org_id uuid, p_module_id uuid)` to seed `Chapter Lead` and `City Lead` with the specified permission sets.
* **Data Migration**:
  * For existing organizations:
    * Rename existing `roles` rows where `name = 'Operations Lead'` to `'Chapter Lead'`.
    * Update description and ensure `chapters:write` and `chapters:read` are linked in `role_permissions`.
    * Seed the new `City Lead` role for each org where `youth-republic` module is active.
    * Existing `staff_role_assignments` linked to the old role remain valid and now point to `Chapter Lead`.

---

## 2. AWS IAM-Inspired UI & Assignment Architecture

### 2.1 Role Builder (`RoleDrawer.tsx`)
* **Service / Module Accordion Grouping**:
  * Replaces flat list of capabilities with an AWS IAM policy editor model grouped by service/module:
    * **Youth Republic**: Drives (`opportunities`), Notices (`noticeboard`), Applications (`applications`), Hours (`hours`), Volunteers (`volunteers`).
    * **Team & Governance**: Chapter Governance (`chapters`), Team Members (`members`), Roles & Permissions (`roles`), Audit Logs (`admin_action_log`), Partner Inquiries (`inquiries`).
    * Extensible architecture: Future modules (**Behen Bazar**, **Maseeha**) register their own service accordion blocks.
* **Service-Level Quick Actions (AWS Style)**:
  * Each service card header provides quick level presets:
    * **Full Access**: All write/update actions granted for that service.
    * **Read Only**: Read actions granted, write restricted.
    * **Restricted**: All actions restricted.
    * **Custom**: Automatically displayed when fine-grained actions have custom combinations.
* **Role Templates**:
  * Updated with `Chapter Lead` and `City Lead` templates alongside `Super Admin`, `Org Admin`, and `Drive Coordinator`.

### 2.2 Member Resource Scoping (`RoleScopeRepeater.tsx`)
* **Attached Role Card**:
  * Each role assigned to a staff member has:
    1. Role Selector.
    2. Scope Radio / Toggle:
       * `○ All Chapters (National / Org-wide)` — default for Super Admin / Org Admin.
       * `◉ Specific Chapters` — for chapter-scoped roles (Chapter Lead, City Lead, Drive Coordinator).
* **Multi-Chapter Chip/Tag Picker**:
  * When `Specific Chapters` is selected:
    * A searchable chapter dropdown lets the admin select chapters.
    * Selected chapters render as removable tags: e.g. `[ Lahore Central ✕ ] [ Lahore North ✕ ]`.
    * For `Chapter Lead`: User selects 1 chapter chip.
    * For `City Lead`: User selects 2 or more chapter chips.
* **Data Flattening**:
  * When saved, the frontend flattens the multi-chapter selection into one `staff_role_assignments` row per chapter:
    * `{ roleId: cityLeadId, scopeKind: "chapter", chapterId: "lahore-central", scopeLabel: "Lahore Central" }`
    * `{ roleId: cityLeadId, scopeKind: "chapter", chapterId: "lahore-north", scopeLabel: "Lahore North" }`
  * No breaking changes to `staff_role_assignments` database schema because `unique(staff_id, organization_id, module_id, role_id, coalesce(chapter_id, ...))` allows multiple chapters per role!
  * `mint-staff-token` automatically aggregates assignments into `chapter_scopes[permKey] = [chapterId1, chapterId2]`.

---

## 3. Chapter Details & Roster Governance Authorization

### 3.1 Backend Edge Function (`update-chapter/handler.ts`)
* Expand chapter update authorization:
  * In addition to Super Admin, Org Admin, and Chapter Admin:
  * Allow caller if they hold `Chapter Lead` or `City Lead` AND have an active assignment where `scope_kind = 'chapter'` and `chapter_id = input.chapterId`.
* **Permitted Chapter Updates for Leads**:
  * Name, city, about text, logo URL.
  * Team members (`chapter_team_members` roster table: create, update, delete members).
* **Restricted for Leads (Forbidden)**:
  * Chapter creation (`createChapter`).
  * Chapter status deactivation / reactivation (`status: "inactive" / "active"`).
  * Any update targeting a chapter ID not present in their assigned scopes.

### 3.2 Frontend `/organization` Page Experience
* **Access Gating**:
  * Update gating so Chapter Leads and City Leads can access `/organization` (via `perms.canEditAnyChapter` or `hasChapterPermission("chapters:write")`).
* **Adaptive Organization View**:
  * **Org Profile** (Name, About, Brand Color, Logo): Rendered read-only / disabled if `!perms.canManageOrgProfile`.
  * **Chapters Panel**:
    * Chapter/City Leads see their assigned chapters with an active **"Edit"** button opening `EditChapterDrawer` in full editing mode.
    * Non-assigned chapters (if visible) show read-only **"View Details"**.
    * "Add Chapter" button is hidden.
    * Deactivate / Reactivate buttons are disabled/hidden for chapter-scoped leads.

---

## 4. Test Credentials & Seed Accounts

In `seed.ts` and test fixtures, configure dedicated test staff accounts:
1. **Chapter Lead**:
   * **Email**: `chapterlead@rizq.org`
   * **Password**: `TestPassword123!`
   * **Role**: `Chapter Lead`
   * **Scope**: Single chapter (`Lahore Central`)
2. **City Lead**:
   * **Email**: `citylead@rizq.org`
   * **Password**: `TestPassword123!`
   * **Role**: `City Lead`
   * **Scope**: Multi-chapter (`Lahore Central` and `Lahore North`)

---

## 5. Exhaustive Role-by-Role Task Verification Matrix

Each task below must be executed and verified with positive and negative assertions using the new credentials:

### 5.1 Chapter Lead (`chapterlead@rizq.org` -> Lahore Central)
1. **Authentication & Token Claims**:
   * Sign in with `chapterlead@rizq.org`.
   * Assert `roleName` resolves to `Chapter Lead`.
   * Assert `chapter_scopes` contains `Lahore Central` for `opportunities:write`, `noticeboard:write`, `applications:update`, `hours:update`, `chapters:write`.
2. **Chapter Details & Branding**:
   * Update `Lahore Central` details (about, logo, name) -> Success (200 OK).
   * Attempt update on `Karachi Central` (unassigned) -> Forbidden (403).
   * Attempt chapter deactivation -> Forbidden (403).
3. **Chapter Roster Governance**:
   * Add volunteer to `Lahore Central` roster -> Success (200 OK).
   * Update volunteer designation/term on `Lahore Central` roster -> Success (200 OK).
   * Remove volunteer from `Lahore Central` roster -> Success (200 OK).
   * Attempt roster edit on `Karachi Central` -> Forbidden (403).
4. **Drive / Opportunity Operations**:
   * Create new drive for `Lahore Central` -> Success (200 OK).
   * Publish drive to noticeboard for `Lahore Central` -> Success (200 OK).
   * Attempt creating drive for `Karachi Central` or org-wide -> Forbidden (403).
5. **Applicant Triage**:
   * Triage/shortlist applicant for `Lahore Central` drive -> Success (200 OK).
   * Attempt triage on `Karachi Central` drive applicant -> Forbidden (403).
6. **Hours Verification**:
   * Approve volunteer hours for `Lahore Central` drive -> Success (200 OK).
   * Attempt approving hours for `Karachi Central` drive -> Forbidden (403).
7. **Boundary Protection**:
   * Attempt modifying Organization profile -> Forbidden.
   * Attempt creating a new chapter -> Forbidden.
   * Attempt accessing Team / Role configuration -> Forbidden.

### 5.2 City Lead (`citylead@rizq.org` -> Lahore Central & Lahore North)
1. **Authentication & Token Claims**:
   * Sign in with `citylead@rizq.org`.
   * Assert `roleName` resolves to `City Lead`.
   * Assert `chapter_scopes` contains both `[Lahore Central, Lahore North]`.
2. **Multi-Chapter Details & Branding**:
   * Update details for Chapter 1 (`Lahore Central`) -> Success (200 OK).
   * Update details for Chapter 2 (`Lahore North`) -> Success (200 OK).
   * Attempt update on unassigned Chapter 3 (`Karachi Central`) -> Forbidden (403).
3. **Multi-Chapter Roster Governance**:
   * Manage roster on Chapter 1 (`Lahore Central`) -> Success (200 OK).
   * Manage roster on Chapter 2 (`Lahore North`) -> Success (200 OK).
   * Attempt roster edit on unassigned Chapter 3 -> Forbidden (403).
4. **Multi-Chapter Drive Operations**:
   * Create & publish drive in Chapter 1 -> Success (200 OK).
   * Create & publish drive in Chapter 2 -> Success (200 OK).
   * Attempt drive creation in Chapter 3 -> Forbidden (403).
5. **Multi-Chapter Applicant Triage**:
   * Triage applicants in Chapter 1 -> Success (200 OK).
   * Triage applicants in Chapter 2 -> Success (200 OK).
   * Attempt triage in Chapter 3 -> Forbidden (403).
6. **Multi-Chapter Hours Approval**:
   * Approve volunteer hours in Chapter 1 -> Success (200 OK).
   * Approve volunteer hours in Chapter 2 -> Success (200 OK).
   * Attempt approving hours in Chapter 3 -> Forbidden (403).
7. **Boundary Protection**:
   * Org profile modification, chapter creation, and team member management all Forbidden.

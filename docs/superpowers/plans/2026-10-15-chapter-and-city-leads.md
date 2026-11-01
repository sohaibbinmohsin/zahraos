# Chapter Lead & City Lead Roles, AWS IAM Architecture & Role Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace legacy `Operations Lead` with `Chapter Lead` and `City Lead`, implement AWS IAM-inspired role building and multi-chapter resource scoping, unlock chapter details and roster governance for chapter/city leads, configure seed test accounts, and thoroughly verify every capability task-by-task.

**Architecture:** A database migration updates system role definitions and migrates legacy roles. The frontend role drawer adopts an AWS IAM policy editor UX with service accordions, and the member assignment component implements multi-chapter tag selection serialized into normalized relational rows. Backend edge functions expand chapter and roster authorization to chapter/city leads for assigned chapters. An exhaustive test suite authenticates with new credentials and executes every operational and governance task one by one.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, Supabase Edge Functions (Deno), PostgreSQL, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-15-chapter-and-city-leads-design.md`

## Global Constraints
- Protected branches: Never push directly to `main`, `master`, or production branches.
- Build verification: `npm run build` MUST succeed with 0 errors before claiming completion.
- Backward compatibility: Existing `staff_role_assignments` and role permissions must seamlessly migrate without breaking other roles.
- Role boundary integrity: Chapter Leads and City Leads must NEVER be permitted to deactivate chapters, create new chapters, modify org-level profiles, or access team/roles administration.

---

### Task 1: Database Migration for Chapter Lead & City Lead System Roles

**Files:**
- Create: `supabase/migrations/0018_chapter_and_city_leads.sql`
- Modify: `supabase/functions/enable-module/handler.test.ts`
- Test: `tests/backend/roles_migration.test.ts`

**Interfaces:**
- Consumes: `seed_youth_republic_system_role(p_org_id, p_module_id, p_name, p_description, p_perm_keys)`
- Produces: System roles `Chapter Lead` and `City Lead` with permission set:
  `['opportunities:write','opportunities:read','noticeboard:write','noticeboard:read','applications:update','applications:read','hours:update','hours:read','chapters:write','chapters:read']`

- [ ] **Step 1: Write the failing migration test**
Create `tests/backend/roles_migration.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";

describe("0018 Chapter Lead and City Lead Migration", () => {
  it("defines Chapter Lead and City Lead system roles with chapters permissions", () => {
    // Assert migration file exists and contains role seeding
    const fs = require("fs");
    const migration = fs.readFileSync("supabase/migrations/0018_chapter_and_city_leads.sql", "utf8");
    expect(migration).toContain("Chapter Lead");
    expect(migration).toContain("City Lead");
    expect(migration).toContain("chapters:write");
    expect(migration).toContain("chapters:read");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run tests/backend/roles_migration.test.ts`
Expected: FAIL because `0018_chapter_and_city_leads.sql` does not exist yet.

- [ ] **Step 3: Implement migration `0018_chapter_and_city_leads.sql`**
Write `supabase/migrations/0018_chapter_and_city_leads.sql`:
```sql
-- Migration 0018: Replace Operations Lead with Chapter Lead and introduce City Lead

-- 1. Ensure chapters:read and chapters:write exist for youth-republic module
insert into permissions (module_id, resource, action)
select m.id, r.resource, r.action
from modules m
cross join (values ('chapters', 'read'), ('chapters', 'write')) as r(resource, action)
where m.key = 'youth-republic'
on conflict (module_id, resource, action) do nothing;

-- 2. Update seed_youth_republic_system_roles function
create or replace function seed_youth_republic_system_roles(p_org_id uuid, p_module_id uuid)
returns void as $$
begin
  perform seed_youth_republic_system_role(p_org_id, p_module_id, 'Super Admin',
    'Full platform control and unconstrained administrative privileges across all operational modules.',
    array['opportunities:write','noticeboard:write','applications:update','applications:read','hours:update','hours:read','team:write','inquiries:write','inquiries:read','chapters:write','chapters:read']);

  perform seed_youth_republic_system_role(p_org_id, p_module_id, 'Org Admin',
    'Full operational permissions and organization-wide team governance.',
    array['opportunities:write','noticeboard:write','applications:update','applications:read','hours:update','hours:read','team:write','inquiries:write','inquiries:read','chapters:write','chapters:read']);

  perform seed_youth_republic_system_role(p_org_id, p_module_id, 'Chapter Lead',
    'Oversees local chapter operations, drive execution, applicant selection, hours verification, and chapter roster governance.',
    array['opportunities:write','opportunities:read','noticeboard:write','noticeboard:read','applications:update','applications:read','hours:update','hours:read','chapters:write','chapters:read']);

  perform seed_youth_republic_system_role(p_org_id, p_module_id, 'City Lead',
    'Oversees multi-chapter regional operations, drive execution, applicant selection, hours verification, and chapter roster governance.',
    array['opportunities:write','opportunities:read','noticeboard:write','noticeboard:read','applications:update','applications:read','hours:update','hours:read','chapters:write','chapters:read']);

  perform seed_youth_republic_system_role(p_org_id, p_module_id, 'Drive Coordinator',
    'Manages on-ground drive shifts, volunteer gate attendance, and direct shift hours logging.',
    array['opportunities:write','opportunities:read','applications:update','applications:read','hours:update','hours:read']);

  perform seed_youth_republic_system_role(p_org_id, p_module_id, 'Application Reviewer',
    'Screens and shortlists volunteer applicants, assesses question responses, and assigns candidate statuses.',
    array['applications:update','applications:read']);

  perform seed_youth_republic_system_role(p_org_id, p_module_id, 'Auditor',
    'Read-only compliance officer auditing hours logs, certifications, and operational activity records.',
    array['applications:read','hours:read']);
end;
$$ language plpgsql;

-- 3. Migrate existing Operations Lead rows to Chapter Lead
do $$
declare
  v_module_id uuid;
  v_role record;
begin
  select id into v_module_id from modules where key = 'youth-republic';
  if v_module_id is not null then
    -- Rename Operations Lead -> Chapter Lead
    update roles
    set name = 'Chapter Lead',
        description = 'Oversees local chapter operations, drive execution, applicant selection, hours verification, and chapter roster governance.'
    where module_id = v_module_id and name = 'Operations Lead';

    -- Ensure Chapter Lead has chapters permissions attached
    for v_role in select id, organization_id from roles where module_id = v_module_id and name = 'Chapter Lead' loop
      insert into role_permissions (role_id, permission_id)
      select v_role.id, p.id
      from permissions p
      where p.module_id = v_module_id
        and (p.resource || ':' || p.action) in ('chapters:write', 'chapters:read')
      on conflict do nothing;
    end loop;

    -- Seed City Lead for every org with youth-republic module if not already present
    for v_role in select organization_id from org_modules where module_id = v_module_id loop
      if not exists (select 1 from roles where organization_id = v_role.organization_id and module_id = v_module_id and name = 'City Lead') then
        perform seed_youth_republic_system_role(v_role.organization_id, v_module_id, 'City Lead',
          'Oversees multi-chapter regional operations, drive execution, applicant selection, hours verification, and chapter roster governance.',
          array['opportunities:write','opportunities:read','noticeboard:write','noticeboard:read','applications:update','applications:read','hours:update','hours:read','chapters:write','chapters:read']);
      end if;
    end loop;
  end if;
end $$;
```

- [ ] **Step 4: Update `supabase/functions/enable-module/handler.test.ts`**
Update expected system role names set in `enable-module/handler.test.ts` from `Operations Lead` to `Chapter Lead` and `City Lead`.

- [ ] **Step 5: Run tests and commit**
Run: `npx vitest run tests/backend/roles_migration.test.ts`
Commit:
```bash
git add supabase/migrations/0018_chapter_and_city_leads.sql tests/backend/roles_migration.test.ts supabase/functions/enable-module/handler.test.ts
git commit -m "feat(roles): add 0018 migration replacing Operations Lead with Chapter Lead and City Lead"
```

---

### Task 2: Capability Mapping & Role Title Derivation

**Files:**
- Modify: `lib/capabilityMap.ts`
- Modify: `lib/capabilityMap.test.ts`

**Interfaces:**
- `deriveRoleTitleFromPermissions(permissions: string[], isChapterScoped?: boolean, chapterCount?: number): string | null`
- Produces: `"Chapter Lead"` when scoped to 1 chapter with full operational + chapter governance permissions; `"City Lead"` when scoped to $>1$ chapters.

- [ ] **Step 1: Write failing unit test in `lib/capabilityMap.test.ts`**
Add tests:
```ts
it("resolves Chapter Lead for single-chapter scope and City Lead for multi-chapter scope", () => {
  const leadPerms = [
    "opportunities:write", "opportunities:read",
    "noticeboard:write",
    "applications:update", "applications:read",
    "hours:update", "hours:read",
    "chapters:write", "chapters:read",
  ];
  expect(deriveRoleTitleFromPermissions(leadPerms, true, 1)).toBe("Chapter Lead");
  expect(deriveRoleTitleFromPermissions(leadPerms, true, 2)).toBe("City Lead");
  expect(deriveRoleTitleFromPermissions(leadPerms, false)).toBe("City Lead"); // unconstrained/org-wide
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run lib/capabilityMap.test.ts`
Expected: FAIL because `deriveRoleTitleFromPermissions` returns `"Chapter Operations Lead"` or `"Operations Lead"`.

- [ ] **Step 3: Update `lib/capabilityMap.ts`**
Update `deriveRoleTitleFromPermissions` signature and resolution:
```ts
export function deriveRoleTitleFromPermissions(
  permissions: string[],
  isChapterScoped = false,
  chapterCount = 1,
): string | null {
  const grid = permissionKeysToGrid(permissions);
  const hasFullOps =
    grid.drive === "granted" &&
    grid.publish === "granted" &&
    grid.triage === "granted" &&
    grid.hours === "granted";

  const hasChapterGovernance = grid.org_governance === "granted";
  const hasTeamManagement = grid.team === "granted" || grid.members === "granted";

  if (hasFullOps && hasTeamManagement) {
    if (isChapterScoped) return "Chapter Admin";
    if (
      permissions.includes("volunteers:read") ||
      permissions.includes("admin_action_log:read") ||
      permissions.includes("roles:write") ||
      permissions.includes("export:read")
    ) {
      return "Super Admin";
    }
    return "Org Admin";
  }

  if (hasFullOps && hasChapterGovernance) {
    if (isChapterScoped && chapterCount > 1) return "City Lead";
    if (isChapterScoped) return "Chapter Lead";
    return "City Lead";
  }

  if (hasFullOps) {
    return isChapterScoped ? "Chapter Lead" : "City Lead";
  }
  // coordinator and reviewer logic continues...
```

- [ ] **Step 4: Run test to verify it passes**
Run: `npx vitest run lib/capabilityMap.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add lib/capabilityMap.ts lib/capabilityMap.test.ts
git commit -m "feat(capability): update role derivation for Chapter Lead and City Lead"
```

---

### Task 3: Backend Authorization in `update-chapter` Edge Function

**Files:**
- Modify: `supabase/functions/update-chapter/handler.ts`
- Modify: `supabase/functions/update-chapter/handler.test.ts`

**Interfaces:**
- Consumes: `input: UpdateChapterInput` (`chapterId`, `name?`, `city?`, `status?`, `logoUrl?`, `about?`, `teamMembers?`)
- Produces: Authorization check allowing `Chapter Lead` and `City Lead` if `assignment.chapter_id === input.chapterId`; rejects `status` changes unless org-level admin.

- [ ] **Step 1: Write failing test in `supabase/functions/update-chapter/handler.test.ts`**
Add tests:
```ts
Deno.test("updateChapter: allows Chapter Lead to update details and roster of assigned chapter", async () => { ... });
Deno.test("updateChapter: allows City Lead to update any of their assigned chapters", async () => { ... });
Deno.test("updateChapter: forbids Chapter Lead/City Lead from updating an unassigned chapter", async () => { ... });
Deno.test("updateChapter: forbids Chapter Lead/City Lead from deactivating a chapter", async () => { ... });
```

- [ ] **Step 2: Update `supabase/functions/update-chapter/handler.ts`**
In `updateChapter`:
```ts
const authorizedRoleNames = ["Org Admin", "Chapter Admin", "Chapter Lead", "City Lead"];
let callerIsOrgAdminOrAbove = false;

if (orgRole && ["admin", "super_admin"].includes(orgRole.org_tier)) {
  isAuthorized = true;
  callerIsOrgAdminOrAbove = true;
}

// In assignments loop:
for (const a of assignments) {
  const roleName = roleMap.get(a.role_id);
  if (roleName === "Super Admin") {
    isAuthorized = true;
    callerIsOrgAdminOrAbove = true;
    break;
  }
  if (roleName === "Org Admin" && a.scope_kind === "org_wide") {
    isAuthorized = true;
    callerIsOrgAdminOrAbove = true;
    break;
  }
  if (
    authorizedRoleNames.includes(roleName || "") &&
    a.scope_kind === "chapter" &&
    a.chapter_id === input.chapterId
  ) {
    isAuthorized = true;
    break;
  }
}

if (!isAuthorized) throw new Error("forbidden");

// Reject status change (deactivation/reactivation) if caller is not org-level admin
if (input.status !== undefined && !callerIsOrgAdminOrAbove && !callerPlatformOwner) {
  throw new Error("forbidden_status_change");
}
```

- [ ] **Step 3: Run backend tests**
Run: `npm test` or deno test runner for update-chapter.

- [ ] **Step 4: Commit**
```bash
git add supabase/functions/update-chapter/handler.ts supabase/functions/update-chapter/handler.test.ts
git commit -m "feat(authz): authorize Chapter Lead and City Lead to update assigned chapter details and roster"
```

---

### Task 4: AWS IAM-Style Role Builder in `RoleDrawer.tsx`

**Files:**
- Modify: `components/team/RoleDrawer.tsx`
- Modify: `components/team/RoleDrawer.test.tsx`

**Interfaces:**
- Consumes: `ROLE_TEMPLATES`, `MODULE_CAPABILITIES`, `CAPABILITY_META`
- Produces: Service accordion component (`Youth Republic`, `Team & Governance`) with AWS IAM-style quick level presets (`Full Access`, `Read Only`, `Restricted`, `Custom`) and fine-grained capability selection.

- [ ] **Step 1: Write failing test in `components/team/RoleDrawer.test.tsx`**
Add tests asserting:
1. Role drawer renders service accordions ("Youth Republic", "Team & Governance").
2. Service-level presets ("Full Access", "Read Only", "Restricted") toggle all actions in that service simultaneously.
3. Templates list includes `Chapter Lead` and `City Lead`.

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run components/team/RoleDrawer.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement AWS IAM UI in `components/team/RoleDrawer.tsx`**
1. Add `Chapter Lead` and `City Lead` to `ROLE_TEMPLATES`:
```ts
{
  name: "Chapter Lead",
  description: "Oversees local chapter operations, drive execution, applicant selection, hours verification, and chapter roster governance.",
  capabilities: {
    ...RESTRICTED_GRID,
    drive: "granted",
    publish: "granted",
    triage: "granted",
    hours: "granted",
    org_governance: "granted",
  },
},
{
  name: "City Lead",
  description: "Oversees multi-chapter regional operations, drive execution, applicant selection, hours verification, and chapter roster governance.",
  capabilities: {
    ...RESTRICTED_GRID,
    drive: "granted",
    publish: "granted",
    triage: "granted",
    hours: "granted",
    org_governance: "granted",
  },
},
```
2. Group capabilities by service block:
```tsx
const SERVICES = [
  {
    key: "youth-republic",
    title: "Youth Republic",
    description: "Volunteer drives, public noticeboard, applicant screening, and shift hours logging.",
    capabilities: MODULE_CAPABILITIES["youth-republic"],
  },
  {
    key: "team-governance",
    title: "Team & Governance",
    description: "Chapter governance, team roster, roles configuration, partner inquiries, and audit logs.",
    capabilities: MODULE_CAPABILITIES["team-governance"],
  },
];
```
3. Implement service quick toggle (`Full Access`, `Read Only`, `Restricted`, `Custom` indicator) and collapsible action rows with clean Select/Pills.

- [ ] **Step 4: Run test to verify it passes**
Run: `npx vitest run components/team/RoleDrawer.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add components/team/RoleDrawer.tsx components/team/RoleDrawer.test.tsx
git commit -m "feat(ui): implement AWS IAM-style service accordions and Chapter/City Lead templates in RoleDrawer"
```

---

### Task 5: AWS-Style Multi-Chapter Resource Scoping & Role Repeater

**Files:**
- Modify: `components/team/RoleScopeRepeater.tsx`
- Modify: `components/team/InviteMemberDrawer.tsx`
- Modify: `components/team/EditMemberDrawer.tsx`
- Modify: `components/team/RoleScopeRepeater.test.tsx`

**Interfaces:**
- Consumes: `chapters: { id: string; name: string }[]`, `roles: { id: string; name: string }[]`
- Produces: `RoleScopeRow` supporting `chapterIds: string[]` representing multiple selected chapters, flattened by `rowsToAssignmentPayload` into individual `RoleAssignmentInput` items.

- [ ] **Step 1: Write failing test in `components/team/RoleScopeRepeater.test.tsx`**
```ts
it("allows selecting multiple chapters via tag chips for a single role", () => {
  // Test adding chapter 1 and chapter 2 to a City Lead role row
  // Test rowsToAssignmentPayload outputs two separate assignment objects with respective chapterIds
});
```

- [ ] **Step 2: Update `components/team/RoleScopeRepeater.tsx`**
1. Update `RoleScopeRow`:
```ts
export interface RoleScopeRow {
  key: string;
  roleId: string;
  scopeKind: "org_wide" | "chapter";
  chapterIds: string[]; // multi-chapter support
  scopeLabel: string;
}
```
2. In `rowsToAssignmentPayload`:
```ts
export function rowsToAssignmentPayload(rows: RoleScopeRow[]): RoleAssignmentInput[] {
  const payload: RoleAssignmentInput[] = [];
  for (const r of rows) {
    if (r.scopeKind === "org_wide") {
      payload.push({
        roleId: r.roleId,
        scopeKind: "org_wide",
        chapterId: null,
        scopeLabel: ORG_WIDE_LABEL,
      });
    } else {
      if (r.chapterIds.length === 0) {
        payload.push({
          roleId: r.roleId,
          scopeKind: "chapter",
          chapterId: null,
          scopeLabel: "Chapter",
        });
      } else {
        for (const chId of r.chapterIds) {
          payload.push({
            roleId: r.roleId,
            scopeKind: "chapter",
            chapterId: chId,
            scopeLabel: chaptersMap.get(chId) || "Chapter",
          });
        }
      }
    }
  }
  return payload;
}
```
3. Implement AWS-style Scope Card:
   - Scope radio: `All Chapters` vs `Specific Chapters`.
   - Chip tag container: renders selected chapters as `[ Name ✕ ]`.
   - Chapter selector: dropdown allowing selecting chapters to add to the tag list.
4. Update `InviteMemberDrawer.tsx` and `EditMemberDrawer.tsx` to group initial assignments by `roleId` into `chapterIds: [...]`.

- [ ] **Step 3: Run test to verify it passes**
Run: `npx vitest run components/team/RoleScopeRepeater.test.tsx`
Expected: PASS

- [ ] **Step 4: Commit**
```bash
git add components/team/RoleScopeRepeater.tsx components/team/InviteMemberDrawer.tsx components/team/EditMemberDrawer.tsx components/team/RoleScopeRepeater.test.tsx
git commit -m "feat(ui): implement multi-chapter tag resource scoping in RoleScopeRepeater"
```

---

### Task 6: Frontend Chapter & Roster Governance in `/organization`

**Files:**
- Modify: `components/shell/useStaffPermissions.ts`
- Modify: `app/organization/page.tsx`
- Modify: `components/team/ChaptersPanel.tsx`
- Modify: `app/organization/page.test.tsx`
- Modify: `components/shell/useStaffPermissions.test.ts`

**Interfaces:**
- Consumes: `claims.moduleAccess.chapterScopes`
- Produces: Access to `/organization` for Chapter/City Leads with editable assigned chapters & rosters, while keeping Org Profile read-only.

- [ ] **Step 1: Write failing test in `app/organization/page.test.tsx`**
Assert that a user with `Chapter Lead` claims:
1. Can load `/organization`.
2. Org Profile fields are disabled / read-only.
3. Assigned chapter has active "Edit" button.
4. "Add Chapter" button is not visible.

- [ ] **Step 2: Update `useStaffPermissions.ts` & `app/organization/page.tsx`**
1. In `useStaffPermissions.ts`:
   - Expose `canViewOrganization: isAdmin || canManageTeam || isChapterScoped` (or when user has `chapters:read`/`chapters:write`).
   - `canManageOrgProfile = !isChapterScoped && canManageTeam;` (remains false for chapter leads).
   - `canCreateChapters = !isChapterScoped && canManageTeam;` (remains false for chapter leads).
   - `canEditChapter = useCallback((chapterId: string) => hasChapterPermission("chapters:write", chapterId), [hasChapterPermission]);`
2. In `app/organization/page.tsx`:
   - Update `canAccess = Boolean(perms.canManageTeam || isOrgAdminOrAbove || perms.isChapterScoped);`
   - If `!perms.canManageOrgProfile`, render Org Profile inputs with `disabled` and hide logo upload button.
3. In `components/team/ChaptersPanel.tsx`:
   - Ensure `canEdit` disables/hides chapter deactivation for chapter-scoped leads.

- [ ] **Step 3: Run test to verify it passes**
Run: `npx vitest run app/organization/page.test.tsx components/shell/useStaffPermissions.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**
```bash
git add components/shell/useStaffPermissions.ts app/organization/page.tsx components/team/ChaptersPanel.tsx app/organization/page.test.tsx components/shell/useStaffPermissions.test.ts
git commit -m "feat(governance): allow Chapter and City Leads to edit assigned chapter details and rosters on organization page"
```

---

### Task 7: Test Credentials & Seed Accounts

**Files:**
- Modify: `supabase/seed/seed.ts` (or backend seed helper)
- Create: `tests/fixtures/test_leads_seed.ts`

**Interfaces:**
- Produces: Test credentials:
  - `chapterlead@rizq.org` / `TestPassword123!` (Chapter Lead, Lahore Central)
  - `citylead@rizq.org` / `TestPassword123!` (City Lead, Lahore Central & Lahore North)

- [ ] **Step 1: Write seed helper `tests/fixtures/test_leads_seed.ts`**
Provide a reproducible script that creates the test staff accounts, links their role assignments, and outputs sign-in verification info.

- [ ] **Step 2: Update backend `seed.ts`**
Ensure that whenever database seeding executes, `chapterlead@rizq.org` and `citylead@rizq.org` are seeded with known credentials and proper chapter scopes.

- [ ] **Step 3: Commit**
```bash
git add supabase/seed/seed.ts tests/fixtures/test_leads_seed.ts
git commit -m "feat(seed): add dedicated Chapter Lead and City Lead seed test accounts"
```

---

### Task 8: Exhaustive Role-by-Role Task Verification Suite & Production Build

**Files:**
- Create: `tests/permissions/chapter_and_city_lead_matrix.test.ts`
- Modify: `tests/permissions/rolesMatrix.test.tsx`

**Interfaces:**
- Consumes: Test credentials & token minting for Chapter Lead and City Lead
- Produces: 100% automated verification of all positive and negative capabilities across the matrix.

- [ ] **Step 1: Write `tests/permissions/chapter_and_city_lead_matrix.test.ts`**
Implement tests executing each task one by one:
1. **Authentication & Token Claims**:
   - `chapterlead@rizq.org` has role `Chapter Lead`, single chapter in `chapter_scopes`.
   - `citylead@rizq.org` has role `City Lead`, multiple chapters in `chapter_scopes`.
2. **Chapter Details & Branding**:
   - Chapter Lead can update Lahore Central details.
   - Chapter Lead gets 403 on Karachi Central.
   - City Lead can update Lahore Central and Lahore North details.
   - City Lead gets 403 on Karachi Central.
3. **Chapter Roster Governance**:
   - Chapter Lead can add, edit, and remove team members on Lahore Central roster.
   - City Lead can add, edit, and remove team members on both assigned chapters.
   - Both receive 403 when touching unassigned chapter rosters.
4. **Drive / Opportunity Operations**:
   - Chapter Lead can create and publish drives in Lahore Central; 403 in Karachi.
   - City Lead can create and publish drives in Lahore Central and Lahore North; 403 in Karachi.
5. **Applicant Triage**:
   - Chapter Lead and City Lead can triage applicants in their assigned chapter drives; 403 on unassigned.
6. **Volunteer Hours Verification**:
   - Chapter Lead and City Lead can verify hours in their assigned chapter drives; 403 on unassigned.
7. **Negative Boundaries**:
   - Both cannot edit Org Profile, cannot create chapters, cannot deactivate chapters, cannot manage team members.

- [ ] **Step 2: Run test matrix**
Run: `npx vitest run tests/permissions/chapter_and_city_lead_matrix.test.ts`
Expected: 100% PASS across all tasks.

- [ ] **Step 3: Run Full Production Build**
Run: `npm run build`
Verify output has 0 errors and all routes build cleanly.

- [ ] **Step 4: Commit**
```bash
git add tests/permissions/chapter_and_city_lead_matrix.test.ts tests/permissions/rolesMatrix.test.tsx
git commit -m "test: comprehensive task-by-task verification matrix for Chapter Lead and City Lead"
```

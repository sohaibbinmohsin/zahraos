# Team & Access Design Spec — `platform` (repo: `tmp-partner-admin`), with a coordinated `youth-republic/backend` follow-up

Status: approved for implementation planning
Date: 2026-09-04

## 1. Purpose & Scope

The deployed admin app's `/staff` and `/roles` pages are flat tables plus
raw forms. The reference prototype
(`demos/youth-republic/prototype.html`, `#screen-team`) specifies a single
**Team & Access** screen with three sub-tabs — **Members**, **Roles &
Permissions**, **Audit Log** — driven by a contextual sub-nav bar and a
heading/primary-action that swap per tab. This spec brings the deployed
app to that prototype: look **and** function, wired to real backend.

The prototype's "function" is entirely client-side mock. Matching it for
real requires new platform schema (multi-role assignments with chapter
scope, invitations, an audit-log table), JWT propagation of chapter
scope, new edge functions, and the shell/route rework.

### In scope (this effort)

- Platform migration `0013_team_access.sql`: `staff_role_assignments`
  (replaces `staff_module_roles`), `staff_invitations`,
  `admin_audit_log`, YR system-role seeding, capability permission rows.
- `mint-staff-token` emits per-`module_access` `chapters` array.
- New/changed platform edge functions (Section 5), each writing an
  `admin_audit_log` row.
- Chapter CRUD edge functions in `youth-republic/backend`, called from
  platform via a new `lib/vmsFunctions.ts` bridge.
- `app/team/` route group: `layout.tsx` (contextual chrome) + three
  pages; `AppShell.tsx` sidebar rework.
- All prototype screens and drawers: Members table + Invite drawer +
  Edit-Access drawer; Roles table + Create/Edit Role drawer + Operational
  Chapters panel; Audit table + CSV export.
- Delete `app/staff/`, `app/roles/`, and their orphaned components. No
  redirects, no backlinks — the app is pre-release with no users.

### Out of scope (coordinated `youth-republic/backend` follow-up, separate spec)

1. `chapter_id` on `opportunities` (and any other chapter-bound YR
   tables); Create Opportunity form field.
2. YR-side RLS on opportunities/applications/hours: when
   `module_access[].chapters` is non-empty, restrict rows to those
   chapter ids.
3. Audit sub-tab merging YR `admin_action_log` events (Published Drive,
   Hours Endorsed, Candidate Selected) via a new YR `list-admin-actions`
   function.
4. Refining per-role scope granularity if the union-at-token-level
   (Section 2) proves too coarse.

This split is deliberate: (2) rewrites the same YR RLS/query files a
concurrent effort is touching. This spec defines the propagation
contract; the follow-up consumes it.

## 2. Foundational Decisions

- **Approach A — map the prototype's fixed capability grid onto the
  existing flexible `permissions` schema.** The platform deliberately
  adopted a generic `permissions` / `roles` / `role_permissions` model
  (`2026-08-27-platform-design.md` §1) so a future health-org module can
  define its own capability set. This effort does not replace it. The
  five prototype capabilities become five fixed permission rows for the
  youth-republic module; the "Granted / Read Only / Restricted" tri-state
  is a documented convention over which rows a role holds. Rejected:
  a purpose-built `role_capabilities` level-enum table (discards the
  generic model, forces bigger rewrites) and a data-driven capability
  registry (YAGNI until module #2).
- **Chapters stay in the YR backend project.** `chapters` already exists
  there (`youth-republic/backend/.../0007_chapters.sql`), org-scoped.
  Platform and YR backend are separate Supabase projects with no
  cross-project FK. A platform role assignment stores a chapter **UUID +
  cached label**, no FK — the same pattern platform already uses for
  `organization_id`.
- **Invited people are real `staff` rows now.** The prototype shows
  pending members in the same table with their roles already visible. An
  invite creates `staff` (`status='invited'`) + `staff_role_assignments`
  immediately; acceptance flips status to `active`.
- **Every Team & Access mutation writes one `admin_audit_log` row**, from
  the edge function, service-role only.

## 3. Data Model — migration `0013_team_access.sql` (platform)

### 3.1 `staff_role_assignments` (replaces `staff_module_roles`)

```sql
create table staff_role_assignments (
  id               uuid primary key default gen_random_uuid(),
  staff_id         uuid not null references staff(id) on delete cascade,
  organization_id  uuid not null references organizations(id) on delete cascade,
  module_id        uuid not null references modules(id) on delete cascade,
  role_id          uuid not null references roles(id) on delete cascade,
  scope_kind       text not null default 'org_wide' check (scope_kind in ('org_wide','chapter')),
  chapter_id       uuid,                       -- YR-project chapter row; no FK
  scope_label      text not null,              -- 'National / All Chapters' | 'Lahore Chapter' | free text
  created_at       timestamptz not null default now(),
  created_by       uuid references staff(id)
);

create index staff_role_assignments_org_module_idx on staff_role_assignments (organization_id, module_id);
create index staff_role_assignments_staff_idx on staff_role_assignments (staff_id);
create unique index staff_role_assignments_unique
  on staff_role_assignments (staff_id, role_id, coalesce(chapter_id, '00000000-0000-0000-0000-000000000000'::uuid));
```

Constraint: `scope_kind = 'chapter'` ⇒ `chapter_id is not null`;
`scope_kind = 'org_wide'` ⇒ `chapter_id is null` (CHECK).

**Data migration**: insert one row per existing `staff_module_roles` row
with `scope_kind='org_wide'`, `chapter_id=null`,
`scope_label='National / All Chapters'`, `created_by=null`. Then
`drop table staff_module_roles`.

**RLS**: `select` using `staff_id = current_staff_id() or
is_org_admin_or_above(organization_id)`; writes service-role only.

### 3.2 `staff` status

`alter table staff drop constraint staff_status_check;`
`add constraint staff_status_check check (status in ('active','invited','deactivated'));`

Update the `staff_org_admin_select` policy (0009) and any helper that
referenced `staff_module_roles` to reference `staff_role_assignments`.

### 3.3 Capability permission rows (youth-republic module)

The grid's five capabilities map onto **existing** `permissions`
`(resource, action)` rows wherever YR RLS already checks one, so the
minted token's `permissions` genuinely gate YR writes in the follow-up:

| Grid column         | Granted → role holds                       | Read Only → role holds |
|---------------------|-------------------------------------------|------------------------|
| Drive Creation      | `opportunities:write`                      | —                      |
| Publish Noticeboard | `noticeboard:write` (new row)             | —                      |
| Triage Apps         | `applications:update` + `applications:read`| `applications:read`    |
| Approve Hours       | `hours:update` + `hours:read`              | `hours:read`           |
| Team Management     | `team:write` (new row)                    | —                      |

- `opportunities:{read,write,update,delete}`, `applications:{read,write,update}`,
  `hours:{read,write,update}` all already exist from `0005_permissions.sql`
  (keyed to the module now renamed `youth-republic` by `0011`). Keep every
  0005 row untouched — they still back YR RLS.
- **Add two rows**: `noticeboard:write` and `team:write` for the YR
  module. `noticeboard:write` gates publish/unpublish (a YR RLS check in
  the follow-up); `team:write` is platform/display-side (the `/team` nav
  stays org-tier-gated in phase 1 — see §9).
- **Restricted** → role holds none of that capability's rows.
- Convention is lossy on purpose: "create/edit/configure opportunities"
  and Drive Creation both collapse to `opportunities:write`; the
  `permissions.action` CHECK (`read|write|update|delete`) has no room for
  finer verbs.

### 3.4 System roles

Replace the generic Viewer/Editor seeding for the YR module with:

```sql
create or replace function seed_youth_republic_system_roles(p_org_id uuid, p_module_id uuid) returns void ...
```

Seeds five `roles` rows (`is_system=true`) with these capability grids
(from `ROLES[0..4]` in the prototype):

| Role                 | Drive | Publish | Triage      | Hours       | Team       |
|----------------------|-------|---------|-------------|-------------|------------|
| Super Admin          | G     | G       | G           | G           | G          |
| Operations Lead      | G     | G       | G           | G           | Restricted |
| Drive Coordinator    | G     | Rstr    | G           | G           | Restricted |
| Application Reviewer  | Rstr  | Rstr    | G           | Rstr        | Restricted |
| Auditor              | Rstr  | Rstr    | Read Only   | Read Only   | Restricted |

Descriptions: copy verbatim from the prototype `ROLES` array.

Wire this into whatever calls `seed_system_roles_for_module` today
(module-enable path). Existing orgs with the YR module enabled: a
one-time seeding statement in the migration for each such org.

### 3.5 `staff_invitations`

```sql
create table staff_invitations (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  staff_id         uuid not null references staff(id) on delete cascade,
  email            text not null,
  full_name        text not null,
  phone            text,
  status           text not null default 'pending' check (status in ('pending','accepted','revoked')),
  enforce_2fa      boolean not null default true,
  send_activation_email boolean not null default true,
  token_hash       text,
  invited_by       uuid references staff(id),
  invited_at       timestamptz not null default now(),
  accepted_at      timestamptz
);
create index staff_invitations_org_idx on staff_invitations (organization_id);
```

RLS: `select` for `is_org_admin_or_above(organization_id)`; writes
service-role only.

### 3.6 `admin_audit_log`

```sql
create table admin_audit_log (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  actor_staff_id   uuid references staff(id),
  actor_name       text not null,
  action           text not null,   -- 'Member Invited' | 'Access Changed' | 'Member Removed'
                                    -- | 'Role Created' | 'Role Modified' | 'Chapter Created' | 'Chapter Updated'
  entity_type      text not null,   -- 'staff' | 'role' | 'chapter'
  entity_id        text,
  summary          text not null,
  scope_label      text,
  ip               text,
  created_at       timestamptz not null default now()
);
create index admin_audit_log_org_created_idx on admin_audit_log (organization_id, created_at desc);
```

RLS: `select` for `is_org_admin_or_above(organization_id)`; `insert`
service-role only (no policy → blocked for anon/auth).

## 4. JWT Propagation & Effective Permissions

### 4.1 `mint-staff-token`

Reads `staff_role_assignments` (not `staff_module_roles`). Each
`module_access` entry gains `chapters`:

```jsonc
{
  "organization_id": "…",
  "module": "youth-republic",
  "permissions": ["drives:write", "applications:write", "applications:read", …],
  "chapters": ["<chapter-uuid>", …]   // present ⇒ restricted to these; absent/[] ⇒ org-wide
}
```

Rule: for each (org, module), if **any** assignment is
`scope_kind='org_wide'`, omit `chapters` (unrestricted). Otherwise
`chapters` = distinct union of `chapter_id` across that member's
chapter-scoped assignments for the (org, module). `permissions` union is
unchanged from today (per-scope permission granularity is **not**
represented in the token — documented phase-1 limitation).

Super-admin org path (all enabled modules, all permissions) always
omits `chapters`.

### 4.2 `lib/staffToken.ts`

`StaffTokenClaims.moduleAccess[]` gains `chapters?: string[]`.
`decodeStaffTokenClaims` maps it.

### 4.3 Effective permissions (UI display only)

Port `getEffectivePermissionsForMember` from the prototype. Input: a
member's assignments → their roles → capability rows. Output tag set,
union across roles:

- `opportunities:write` → **Create Drives**
- `noticeboard:write` → **Publish Noticeboard**
- `applications:update` → **Triage Apps**; else `applications:read` →
  **View Apps (Read Only)**
- `hours:update` → **Approve Hours**; else `hours:read` → **View Hours
  (Read Only)**
- `team:write` → **Manage Team**

Shown in the Members table "Effective Permissions" column and live in the
Edit-Access drawer.

## 5. Edge Functions

All new platform functions: `index.ts` + `handler.ts`, gated by
`verifyPlatformStaffSession` + org-admin-or-above (platform owner
bypasses), each writing one `admin_audit_log` row via service role.

| Function | Repo | Purpose | Audit action |
|---|---|---|---|
| `invite-staff-member` (new) | platform | Create `staff` (`status='invited'`) + auth user; insert `staff_invitations`; insert N `staff_role_assignments`; email activation link when `send_activation_email`; no temp-password return | `Member Invited` |
| `update-staff-access` (new) | platform | Replace a member's `staff_role_assignments` set (diff add/remove/rescope); update `staff.status` | `Access Changed` |
| `remove-staff-member` (new) | platform | Delete the member's assignments; set `staff.status='deactivated'` | `Member Removed` |
| `create-custom-role` (extend) | platform | Accept `{ name, description, capabilities: {drive,publish,triage,hours,team} }`; translate to `role_permissions` rows | `Role Created` |
| `update-custom-role` (new) | platform | Rename/redescribe + rewrite `role_permissions`; reject `is_system` | `Role Modified` |
| `delete-custom-role` (new) | platform | Delete when `is_system=false` and zero assignments; else `role_in_use` | `Role Modified` |
| `assign-staff-org-role` | platform | Unchanged (org tier is orthogonal to module roles) | — |
| `create-staff` | platform | Retired — folded into `invite-staff-member` | — |
| `assign-staff-module-role` | platform | Deleted — replaced by `update-staff-access` | — |
| `mint-staff-token` (change) | platform | Section 4.1 | — |
| `list-chapters` (new) | youth-republic/backend | Org-scoped chapter list; gated by `chapters:read` | — |
| `create-chapter` (new) | youth-republic/backend | Insert chapter; gated by `chapters:write`; writes YR `admin_action_log` | (YR log) |
| `update-chapter` (new) | youth-republic/backend | Update name/city/status; gated by `chapters:update`; writes YR `admin_action_log` | (YR log) |

**Capability ↔ `role_permissions` translation** (shared helper, both
directions, unit-tested):

```
G   drive   → opportunities:write
G   publish → noticeboard:write
G   triage  → applications:update + applications:read
RO  triage  → applications:read
G   hours   → hours:update + hours:read
RO  hours   → hours:read
G   team    → team:write
Restricted  → (no rows for that capability)
```

Reverse (rows → grid value) is the inverse; a role with an
`opportunities:read`-only row and nothing else reads as Drive Creation =
Restricted (read is implied for any admin viewing the screen).

### 5.1 Platform → YR bridge

`lib/vmsFunctions.ts` (new) mirrors `lib/platformFunctions.ts`'s
`callFunction()` but targets `NEXT_PUBLIC_VMS_FUNCTIONS_URL` and sends the
**staff JWT** (`fetchStaffToken()`), matching
`2026-08-30-vms-admin-portal-design.md` §2. Add
`NEXT_PUBLIC_VMS_FUNCTIONS_URL` to `.env.example`.

`lib/platformFunctions.ts` gains typed wrappers for the new platform
functions.

## 6. Routes & Shell

### 6.1 `AppShell.tsx` sidebar

Rename the `Governance & Access` group to **TEAM & ACCESS**. Replace the
two links with three, all gated on `isOrgAdminOrAbove`:

- `Team Members` → `/team/members` (badge = active member count)
- `Roles & Permissions` → `/team/roles`
- `Audit Log` → `/team/audit`

`Organizations` (platform-owner only) stays.

### 6.2 `app/team/layout.tsx` (new, client)

Renders:

- Page header: contextual heading + subtitle + primary-action button,
  keyed on `usePathname()`:

  | Path | Heading | Subtitle | Primary action |
  |---|---|---|---|
  | `/team/members` | Team Members Directory | Manage administrative team members, multi-role assignments, and chapter operational scopes. | **Invite Team Member** |
  | `/team/roles` | Roles & Permissions Matrix | Configure granular capability privileges and operational access boundaries for system and custom roles. | **Create Custom Role** |
  | `/team/audit` | Security & Operational Audit Log | Complete immutable chronological record of team administrative operations, role modifications, and security events. | **Export Audit CSV** |

- Contextual sub-nav bar reusing `.module-nav-bar` / `.module-tab` with
  the three tabs.
- A `TeamAccessProvider` context: loads and caches `roles`,
  `staff_role_assignments` + `staff` (member list), `chapters` (via
  `list-chapters`); exposes `refresh()`. Drawers on any tab read this
  cache and call `refresh()` after a mutation.
- Owns drawer open/close state so the layout's primary-action button can
  open the right drawer for the active tab.

### 6.3 Pages

- `app/team/members/page.tsx`, `app/team/roles/page.tsx`,
  `app/team/audit/page.tsx` — content only; chrome is the layout.
- Delete `app/staff/`, `app/roles/`,
  `app/modules/youth-republic/audit/` (the hardcoded ledger page).
- Delete orphaned components: `StaffList`, `CreateStaffForm`,
  `AssignStaffOrgRoleForm` (keep if still used elsewhere — grep first),
  `RolesList`, `AssignStaffModuleRoleForm`. `CreateCustomRoleForm` is
  superseded by the new Role drawer.

### 6.4 `globals.css` additions

Port from the prototype: `.scope-pill`, `.perm-tag`, `.badge-system`,
`.badge-custom`, `.role-repeater-box`, `.role-repeater-row`,
`.stat-card.accent-gold` / `.accent-green` / `.accent-dark` /
`.accent-red`, and any `.role-chip` / `.perm-checkbox-row` refinements
not already present. `.stat-grid`, `.table-card`, `.data-table`,
`.drawer*`, `.page-header`, `.badge-pos/neg/pend/neu` already exist.

## 7. Screens

### 7.1 `/team/members`

- **Stat cards** (4): Active Team (`N Members`, sub `X Admins · Y Leads ·
  Z Reviewers` — bucket role names: *Admin/Super Admin → Admin*, *…Lead
  / Coordinator → Lead*, *Reviewer/Auditor → Reviewer*); Pending
  Invitations (`status='invited'` count); Multi-Role Staff (members with
  ≥2 assignments); 2FA Compliance (% of active members whose invitation
  `enforce_2fa` — display 100% when all).
- **Filters**: search (name/email/role/scope), Role (from `roles`),
  Scope/Chapter (`All` + `National / All Chapters` + each chapter),
  Status (active / invited).
- **Table**: Member Name & Email · Assigned Roles & Scopes
  (`.role-chip` + `.scope-pill` per assignment) · Effective Permissions
  (`.perm-tag` list, §4.3) · Last Active · Status badge · **Edit Access**.
- **Invite drawer**: Full Name, Work Email, Phone; repeatable **role +
  chapter-scope** rows (`+ Add Another Role` / remove, min 1); checkboxes
  "Send secure onboarding activation link" + "Enforce 2FA on first
  login" → `invite-staff-member`.
- **Edit-Access drawer**: member header; repeatable role+scope rows
  preloaded from assignments; Account Access Status select (active /
  invited / suspended→`deactivated`); live effective-permissions list;
  **Remove from Team** (danger) → `remove-staff-member`; Save →
  `update-staff-access`.

### 7.2 `/team/roles`

- **Stat cards** (4): Total Configured Roles (`system + custom`
  breakdown in sub), Active Role Assignments (count of
  `staff_role_assignments`), Custom Roles, Governed Modules (count of
  enabled modules — sub lists them).
- **Filter**: search + type (system / custom).
- **Table**: Role Title & Type (`.badge-system` / `.badge-custom`) ·
  Description · Active Staff (assignment count) · Drive Creation ·
  Publish Noticeboard · Triage Apps · Approve Hours · Team Management
  (each a Granted / Read Only / Restricted badge) · Actions — system:
  **View** + **Clone**; custom: **Edit** + **Clone** + **Delete**
  (disabled with tooltip when assignments > 0).
- **Create/Edit Role drawer**: Role Title, Description, Base Permission
  Template (clone from a system role — populates the five selects),
  then five capability selects (Drive Creation, Publish Noticeboard:
  Granted/Restricted; Triage Apps, Approve Hours:
  Granted/Read Only/Restricted; Team Management: Granted/Restricted).
  System roles open read-only (no Save). Save →
  `create-custom-role` / `update-custom-role`; Clone → open create
  prefilled.
- **Operational Chapters panel** (below the roles table — per the
  decision to keep chapter management inside the Roles section, not a new
  nav heading): "Operational Chapters" — list (Name · City · Status) with
  inline **Add Chapter** and per-row edit/deactivate, via `list-chapters`
  / `create-chapter` / `update-chapter`. Chapter rows populate every
  scope dropdown in the Invite and Edit-Access drawers.

### 7.3 `/team/audit`

- **Stat cards** (4): Total Logged Events (`admin_audit_log` count for
  the org), Actions Today, Authorized Actors (distinct `actor_staff_id`),
  Security & Role Updates (actions in {Role Created, Role Modified,
  Access Changed}).
- **Filter**: search (actor / action / summary / scope) + action-type.
- **Table**: Timestamp · User (`actor_name`) · Action (badge, color by
  type) · Entity & Details (`summary`) · IP / Chapter (`ip` · +
  `scope_label`). Newest first.
- **Export CSV**: client-side from loaded rows.
- Phase 1 = platform Team & Access events only. YR operational events
  merged in the follow-up.

## 8. Testing

Match existing conventions: pgTAP (`supabase/tests/database/`), Deno
handler tests, Vitest component tests.

- **pgTAP**: `staff_role_assignments` constraints (scope_kind/chapter_id
  CHECK, unique index) + the `staff_module_roles` → `staff_role_assignments`
  data migration; `staff` status constraint now allows `invited`;
  `staff_invitations` + `admin_audit_log` RLS (admin select yes,
  auth/anon insert no); `seed_youth_republic_system_roles` yields 5 roles
  with the grids of §3.4.
- **Handler tests**: each new/changed edge function — happy path,
  `forbidden` for non-admin, capability-map ↔ `role_permissions`
  translation both directions, `delete-custom-role` `role_in_use`,
  `mint-staff-token` `chapters` union (org-wide assignment ⇒ `chapters`
  omitted; all-chapter-scoped ⇒ distinct union).
- **Component/Vitest**: `TeamMembersTable` (chips, effective-perm tags,
  three filters), Invite drawer (repeatable rows, min-1, validation),
  Edit-Access drawer (preload, status change, remove), Roles table
  (capability badges, system vs custom actions), Role drawer (template
  clone, read-only system, tri-state selects), Operational Chapters panel
  (add/edit), Audit table (filter + CSV), `app/team/layout` contextual
  heading/subtitle/action per pathname.

## 9. Known Limitations (phase 1)

- Token carries a **union** of chapter ids per (org, module), not
  per-role scope. A member who is Operations Lead → Lahore and
  Application Reviewer → National reads as unrestricted (org-wide wins).
  Acceptable until the follow-up decides finer enforcement is needed.
- Chapter scope is **not enforced** on YR data yet (follow-up item 2).
  The Members UI will show scopes and the token will carry them, but YR
  RLS ignores `chapters` until the follow-up lands.
- `admin_audit_log` is platform-only; YR operational events appear after
  follow-up item 3.
- The **"Super Admin" system role** is only a capability preset. Actual
  org-governance access (the `/team` nav, all-module token grants) still
  comes from `staff_org_roles.org_tier` and is set via
  `assign-staff-org-role`, a separate action. Phase 1 does not auto-link
  the two; an org admin assigns tier and role independently. Revisit if
  this two-step proves confusing.
- `scope_label` is cached at assignment time; renaming a chapter in the
  Operational Chapters panel updates future assignments only unless
  `update-chapter` also rewrites `staff_role_assignments.scope_label` for
  that `chapter_id` (include this rewrite in `update-chapter`).

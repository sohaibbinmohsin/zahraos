# Chapter-Scoped Access Design Spec

Status: approved for implementation planning
Date: 2026-09-06

Repos: `tmp-partner-admin` (platform — identity, roles, admin UI) and
`youth-republic/backend` (YR module — volunteer/opportunity/application/hours data).
Builds on `2026-09-04-team-and-access-design.md` (already implemented on branch
`feat/team-and-access`, commits `9dc0ec1..78f50a0`).

## 1. Purpose

A chapter is a sub-division of an organization (a university society such as
"Rizq LUMS", a city team, etc.). Chapters exist for one reason: to scope a
staff member's admin access so they only see and act on **their chapter's**
opportunities and the applications/hours flowing into them.

The scoping is **role-driven**, not a blunt switch. Through the existing role
system an admin can express, for example:

- a role that can only work with the holder's chapter's opportunities;
- a role that can *view* every chapter's opportunities read-only but only
  *edit/triage* the holder's own;
- a pure read-only auditor across everything.

The "view all, edit mine" shape is achieved by **composing assignments** — a
broad read-only role at org-wide scope plus a narrow write role at one chapter —
not by a new per-role setting. The role creator builds clean single-purpose
roles; whoever assigns access composes them. This works only if the staff token
carries chapter scope **per capability key** rather than as a flat union
(§3), which is the core change here.

This spec also adds two adjacent pieces the same admin surface needs:

- **Staff access expiry** — a nullable `expires_at` on a staff account so
  time-boxed roles (a society lead who graduates) lapse without a manual
  deactivation.
- An **Organization page** in the admin UI — org-admin-facing, one page — where
  an org edits its own profile (name, logo, description, brand) and manages its
  chapters. There is no such surface today.

## 2. Data model

### 2.1 Platform — new migration `0014_chapters.sql`

```sql
create table chapters (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  name             text not null,
  city             text,
  status           text not null default 'active' check (status in ('active', 'inactive')),
  created_at       timestamptz not null default now(),
  created_by       uuid references staff(id),
  unique (organization_id, name)
);
create index chapters_org_idx on chapters (organization_id);

alter table chapters enable row level security;
create policy chapters_select on chapters
  for select using (is_platform_owner() or is_org_admin_or_above(organization_id));
-- writes via service-role Edge Functions only (no insert/update policy)
```

`staff_role_assignments.chapter_id` — `0013` created it as a bare `uuid`. Add
the real FK now that the table exists:

```sql
alter table staff_role_assignments
  add constraint staff_role_assignments_chapter_fk
  foreign key (chapter_id) references chapters(id) on delete restrict;
```

Every live `staff_role_assignments` row has `chapter_id = null` (nothing has
been chapter-scoped yet on the deployed project), so the constraint applies
cleanly. `scope_label` stays as a display cache; `update-chapter` rewrites it
for the affected assignments on a chapter rename (§6.1) — both tables are in
one project now, so the cross-project staleness noted in the prior spec is gone.

`staff.expires_at`:

```sql
alter table staff add column expires_at timestamptz;
```

`null` = permanent (ends only on manual deactivate). A timestamp = access ends
then. **Per account, not per assignment** — a graduating lead loses all access
at once, which matches the use case. Per-assignment expiry is a possible later
refinement, explicitly out of scope now.

### 2.2 YR — new migration

```sql
alter table opportunities add column chapter_id uuid;  -- nullable, no FK
```

A **platform chapter UUID**, the same pattern `organizations.id` already uses
across the project boundary — no FK, no YR `chapters` table. `null` = the org's
own drive, not a sub-chapter's. No column is added to `applications` or
`activity_hours`; their chapter is derived through `opportunity_id` (§4.2).

## 3. Token & permission-check model

### 3.1 `mint-staff-token` (platform) — per-key chapter scope

Today each `module_access` entry carries a flat `permissions: string[]` and a
naive `chapters` union (present only when the member has no org-wide assignment
for that org+module). Replace the `chapters` field with a **per-key scope map**:

```jsonc
module_access: [{
  organization_id: "...",
  module: "youth-republic",
  permissions: ["opportunities:read", "opportunities:write", "applications:read", "applications:update", ...],
  chapter_scopes: {
    "opportunities:write":  ["<lums-uuid>"],
    "opportunities:update": ["<lums-uuid>"],
    "applications:update":  ["<lums-uuid>"],
    "hours:update":         ["<lums-uuid>"],
    "noticeboard:write":    ["<lums-uuid>"]
  }
}]
```

Build rule, per `(org, module)`, for every permission key any of the member's
assignments grant:

- if **any** assignment granting that key is `scope_kind = 'org_wide'` → the key
  is **unrestricted** → omit it from `chapter_scopes`;
- else → `chapter_scopes[key]` = the distinct union of `chapter_id` across the
  `scope_kind = 'chapter'` assignments that grant it.

`permissions` stays exactly as today — the flat "holds this key in *some*
scope" list. The `super_admin`-org path and `platform_owner` emit **no**
`chapter_scopes` (unrestricted everywhere). The old flat `chapters` field is
removed.

Worked example — `Auditor [org-wide]` + `Operations Lead [Rizq LUMS]`:

| key | granted by | result |
|---|---|---|
| `opportunities:read`, `applications:read`, `hours:read` | Auditor (org-wide) | unrestricted |
| `opportunities:write`, `opportunities:update`, `applications:update`, `hours:update`, `noticeboard:write` | Operations Lead [LUMS] only | `["lums"]` |

Read anywhere, write only LUMS — exactly "view all, edit mine."

### 3.2 `lib/staffToken.ts` (frontend) + `verifyStaffToken.ts` (YR)

`StaffTokenClaims.moduleAccess[]`: drop `chapters?: string[]`, add
`chapterScopes?: Record<string, string[]>`. `decodeStaffTokenClaims` maps it.
YR's `verifyStaffToken.ts` `ModuleAccessEntry` / `StaffClaims` gain the same
field.

### 3.3 YR `staff_has_permission` — 4-arg form

Add a 4-arg SQL function alongside the existing 3-arg one:

```sql
create or replace function staff_has_permission(
  p_org_id uuid, p_module text, p_permission text, p_target_chapter_id uuid
) returns boolean as $$
  select is_platform_owner() or exists (
    select 1
    from jsonb_array_elements(coalesce(auth.jwt() -> 'module_access', '[]'::jsonb)) m
    where (m ->> 'organization_id')::uuid = p_org_id
      and (m ->> 'module') = p_module
      and (m -> 'permissions') ? p_permission
      and (
        -- unrestricted for this key
        not (m -> 'chapter_scopes' ? p_permission)
        -- or the target row's chapter is in this key's allowed list
        or (p_target_chapter_id is not null
            and (m -> 'chapter_scopes' -> p_permission) ? p_target_chapter_id::text)
      )
  );
$$ language sql stable;
```

Truth table:

| holds key? | key in `chapter_scopes`? | target `chapter_id` | result |
|---|---|---|---|
| no | — | — | **false** |
| yes | no (unrestricted) | anything (incl. `null`) | **true** |
| yes | yes → `["lums"]` | `lums` | **true** |
| yes | yes → `["lums"]` | `nust` | **false** |
| yes | yes → `["lums"]` | `null` (org-wide drive) | **false** |
| platform owner | — | — | **true** |

A chapter-restricted key never matches a `null`-chapter row: seeing the org's
own drives requires an unrestricted grant (an org-wide assignment).

The existing 3-arg `staff_has_permission(org, module, perm)` is unchanged and
still used by RLS on tables that are **not** chapter-partitioned (volunteers,
`admin_action_log`, exports, etc.). The TS helper `staffHasPermission` in
`verifyStaffToken.ts` gets a matching 4-arg overload for the list/query Edge
Functions.

## 4. YR-side enforcement

### 4.1 Opportunity chapter tag

`opportunities.chapter_id` is set **at creation and is not editable
afterward** — `update-opportunity` neither exposes nor accepts a chapter
change. Re-homing a drive between chapters is rare enough to be a
delete-and-recreate; this keeps §4.2 to a single check per action and avoids
a dual old/new authorization. (Relaxable later if product needs in-place
reassignment.)

**Create Opportunity form** (`components/youth-republic/CreateOpportunityForm.tsx`,
which runs in the admin/platform app) gains a chapter picker fed from the
platform `listChapters()` for the selected org:

- Caller whose `opportunities:write` **is** in `chapter_scopes` → the picker is
  **required**, options limited to their write-scoped `chapter_id`s.
- Caller with an unrestricted `opportunities:write` → picker optional: any of
  the org's chapters, or "Org-wide (no chapter)".

`create-opportunity` handler validates the chosen `chapter_id` against the
caller's `opportunities:write` scope (4-arg `staffHasPermission`) and rejects
`forbidden` on a mismatch.

### 4.2 RLS

On `opportunities`, `applications`, `activity_hours`, each **staff** policy
branch swaps its 3-arg `staff_has_permission(org, module, perm)` for the 4-arg
form. The **public / volunteer** branches of those policies are untouched — an
opportunity stays publicly visible regardless of chapter; chapter scope is
staff-only.

- `opportunities` — the target chapter is `opportunities.chapter_id` directly.
  select → `opportunities:read`; insert → `opportunities:write`; update →
  `opportunities:update`.
- `applications` / `activity_hours` — no own `chapter_id` column; the policy
  reads it through the link:
  `staff_has_permission(org, 'youth-republic', '<key>',
    (select chapter_id from opportunities o where o.id = <table>.opportunity_id))`.
  One indexed single-hop lookup per row check (`opportunity_id` is already
  indexed). select → `applications:read` / `hours:read`; update/triage →
  `applications:update` / `hours:update`.

`update-opportunity`: the target chapter is the row's existing
`opportunities.chapter_id` (never changed — §4.1). The handler 4-arg-checks
that single value against the caller's `opportunities:update` scope. Child
rows derive live through the link and never need a rewrite.

### 4.3 List / write Edge Functions

- `list-opportunities`, `list-applications`, `list-activity-hours` — after the
  existing permission check, if the caller's token has a `chapter_scopes` entry
  for the relevant `:read` key, add `chapter_id in (<list>)` to the query
  (for `list-applications`/`list-activity-hours`, `opportunity_id in (select id
  from opportunities where chapter_id in (<list>))`). No entry → return all.
- `decide-application`, `verify-hours`, `update-opportunity`,
  `update-participation-status` — 4-arg-check the target row's derived
  `chapter_id` against the appropriate `:update` key before mutating.

## 5. Staff access expiry

### 5.1 Enforcement — hard gate

`verifyPlatformStaffSession` (platform `_shared`) already rejects
`status !== 'active'`. Add:

```ts
if (staff.status !== "active"
    || (staff.expires_at && new Date(staff.expires_at).getTime() < Date.now())) {
  throw new Error("unauthorized");
}
```

An expired staff member then cannot call any platform Edge Function and cannot
mint a staff token, so YR access also lapses — within ~1 h, as their last
1-hour staff token expires and cannot be renewed. `mint-staff-token` adds the
same `expires_at` check and refuses to mint for an expired account. No
scheduled job is required for correctness.

### 5.2 Display

`staff.status` is not flipped on expiry (no `pg_cron` in scope). Instead the
UI derives it:

- Members table and Edit-Access drawer show an **Expired** badge (red) when
  `expires_at < now()`, regardless of stored `status`.
- The "Active Team" stat and the `Active` filter exclude expired members.

(Optional later: a nightly `pg_cron` that sets `status = 'deactivated'` where
`expires_at < now()`, so the DB matches the UI. Not needed for the gate.)

### 5.3 UI + payloads

- Invite drawer and Edit-Access drawer gain an optional **"Access expires"**
  date field, helper text "Leave blank for permanent access."
- `InviteStaffMemberPayload` and `UpdateStaffAccessPayload` gain
  `expiresAt: string | null`. `invite-staff-member` and `update-staff-access`
  handlers persist it to `staff.expires_at`.

## 6. Organization page & chapter management

### 6.1 Platform chapter Edge Functions — new

`tmp-partner-admin/supabase/functions/`, standard pattern
(`corsPreflightResponse` → `getAdminClient` → `verifyPlatformStaffSession` →
handler; errors `unauthorized→401`, `forbidden→403`, else `400`; auth =
`callerPlatformOwner` bypass else `staff_org_roles.org_tier in
('admin','super_admin')` for the org):

| Function | Input | Behaviour | Audit |
|---|---|---|---|
| `list-chapters` | `{ organizationId }` | chapters for the org, `order by name` | — |
| `create-chapter` | `{ organizationId, name, city? }` | insert; `unique(organization_id, name)` → `chapter_name_taken` | `admin_audit_log` `action: "Chapter Created"` |
| `update-chapter` | `{ chapterId, name?, city?, status? }` | fetch the row's `organization_id` and authorize against **that**; update; on a `name` change also `update staff_role_assignments set scope_label = <new name> where chapter_id = <id>` | `action: "Chapter Updated"` |

`admin_audit_log.action` vocabulary gains `Chapter Created` / `Chapter Updated`;
the Audit page's action-type filter gains those two options.

### 6.2 `update-organization` — extended for branding

Current input is `{ organizationId, name }`. Widen to
`{ organizationId, name, brandColor?, logoUrl?, faviconUrl?, about? }`; update
those columns on `organizations`; include them in the `pushOrganizationSync`
call. `_shared/moduleBackends.ts` `pushOrganizationSync` and YR
`sync-organization` **already accept and coalesce-merge** these fields — only
the platform side needs to start sending them. No new sync infrastructure.

Keep the caller check as-is for now (`callerPlatformOwner`) **plus** allow
`is_org_admin_or_above(organizationId)` so an org admin can edit their own
org's profile — this is the whole point of the page. (Name/slug changes remain
sensitive; `slug` is not editable from this page.)

### 6.3 `org_branding` view fix (YR)

`org_branding` is a plain view and bypasses the base table's RLS, which
Supabase flags as unrestricted. The exposure (org name/slug/branding for active
orgs) is intentional and matches YR's `organizations_public_select` policy
(`deactivated_at is null`). One-line YR migration:

```sql
alter view org_branding set (security_invoker = on);
```

Behaviour is unchanged (the base policy is already public-for-active); the flag
clears. Also confirm YR `organizations` has only the public select policy and
no client-facing write policy (it is a replica written solely by
`sync-organization`).

### 6.4 The Organization page (frontend)

One sidebar item **"Organization"**, one route `/organization`, gated on
`isOrgAdminOrAbove`. A single page, two sections stacked:

- **Org profile** — inputs for name, description (`about`), logo URL, favicon
  URL, brand color. Save → extended `update-organization` (§6.2).
- **Chapters** — the chapter list (name · city · status) as a read view, an
  inline **Add Chapter** form, and per-row edit / activate-deactivate. Calls the
  §6.1 platform functions.

This section **is** the existing `ChaptersPanel` component (built for the
Team & Access work as a panel inside the Roles & Permissions tab), relocated
here. **Remove the "Operational Chapters" panel from the Roles & Permissions
tab.** The Invite / Edit-Access drawers' scope dropdowns keep getting the
chapter list from `TeamAccessProvider`.

## 7. Frontend repoint (summary of client changes)

- `lib/platformFunctions.ts` — add `listChapters` / `createChapter` /
  `updateChapter` (platform session `accessToken`); add
  `updateOrganization` branding fields; add `expiresAt` to
  `InviteStaffMemberPayload` / `UpdateStaffAccessPayload`.
- `lib/youthRepublicFunctions.ts` — remove `interface Chapter`, `listChapters`,
  `createChapter`, `updateChapter` (the bridge).
- `lib/staffToken.ts` — `chapters?` → `chapterScopes?: Record<string, string[]>`.
- `components/team/TeamAccessProvider.tsx` — call the platform `listChapters`
  with `accessToken` instead of the staff-token'd YR one.
- `components/team/ChaptersPanel.tsx` — call platform `createChapter` /
  `updateChapter`; surface `chapter_name_taken`.
- `components/team/AuditTable.tsx` — filter options gain `Chapter Created` /
  `Chapter Updated`.
- `components/team/MembersTable.tsx` + `EditMemberDrawer.tsx` — Expired badge;
  Active stat/filter exclude expired.
- `components/team/InviteMemberDrawer.tsx` + `EditMemberDrawer.tsx` — "Access
  expires" date field.
- `components/team/RolesTable`/page — drop the `<ChaptersPanel/>` render.
- `components/youth-republic/CreateOpportunityForm.tsx` — chapter picker
  (§4.1). `lib/youthRepublicFunctions.ts` `create-opportunity` /
  `update-opportunity` payloads gain `chapterId`.
- New `app/organization/page.tsx` + sidebar item in `AppShell.tsx`.

## 8. YR chapter plumbing

### In scope

Delete the three YR chapter Edge Functions — `create-chapter`, `list-chapters`,
`update-chapter` — from the repo and the linked YR project. The repointed
admin UI was their only caller.

### Deferred (coordinate with concurrent YR work)

Dropping the YR `chapters` table, `volunteer_chapter_link`, their RLS in
`0010_rls_org_scoped.sql`, and the volunteer-portfolio chapter display
(`get-volunteer-portfolio` handler + `youth-republic/frontend/app/portfolio`).
This is orphaned volunteer-membership plumbing, not governance; removing it now
edits files the concurrent YR effort owns. The spec records it; nothing here
depends on it.

## 9. Testing

**pgTAP (platform):** `chapters` table/constraints/unique/RLS;
`staff_role_assignments_chapter_fk`; `staff.expires_at` column; `admin_audit_log`
rows for the two chapter actions.

**pgTAP (YR):** `opportunities.chapter_id` nullable; the 4-arg
`staff_has_permission` truth table (§3.3), driven by `set_config` JWT claims
fixtures — unrestricted key, scoped key hit/miss, `null` target vs scoped key,
platform-owner bypass; opportunities / applications / activity_hours RLS with a
scoped token vs an org-wide token vs a public/volunteer session.

**Deno handler tests:**
- platform `list-chapters` / `create-chapter` / `update-chapter` — happy path,
  non-admin `forbidden`, `chapter_name_taken`, `update-chapter` rewrites
  `staff_role_assignments.scope_label` on rename.
- `mint-staff-token` — `chapter_scopes` build: per-key union; an org-wide grant
  unrestricts that key; `super_admin` emits none.
- `verifyPlatformStaffSession` / `mint-staff-token` — reject an account past
  `expires_at`; allow `expires_at = null`; allow a future `expires_at`.
- `create-opportunity` — rejects an out-of-scope `chapter_id`; a chapter-scoped
  caller must supply one; an org-wide caller may omit it.
- `list-opportunities` / `list-applications` — a scoped token only returns rows
  in its `chapter_scopes` list; an org-wide token returns all.
- `invite-staff-member` / `update-staff-access` — persist `expires_at`.
- `update-organization` — persists branding and includes it in the sync payload.

**Vitest:** repointed `ChaptersPanel` (platform wrappers, `accessToken`);
`AuditTable` new filter options; drawer "Access expires" field →
payload; `MembersTable` Expired badge + stat exclusion; new
`app/organization/page.tsx` (profile save, chapter add); `CreateOpportunityForm`
chapter picker (options limited for a scoped caller, required vs optional).

## 10. Deploy

- Apply `0014_chapters.sql` (platform) and the YR migration
  (`opportunities.chapter_id`, 4-arg `staff_has_permission`, RLS swaps,
  `org_branding` `security_invoker`).
- Deploy platform functions: `list-chapters`, `create-chapter`, `update-chapter`
  (new), `mint-staff-token`, `verifyPlatformStaffSession` consumers
  (`invite-staff-member`, `update-staff-access`, everything using the shared
  gate — redeploy all that changed), `update-organization`.
- Deploy YR functions: `create-opportunity`, `update-opportunity`,
  `list-opportunities`, `list-applications`, `list-activity-hours`,
  `decide-application`, `verify-hours`, `update-participation-status` (RLS
  helper + handler changes).
- Delete the three YR chapter functions from the linked YR project.

## 11. Known limitations / out of scope

- **Per-account expiry only.** A person cannot have one non-expiring org-wide
  role and one expiring chapter role on the same account; the account expires
  as a whole. Per-assignment expiry is a future refinement.
- **No `pg_cron` status flip on expiry.** The Expired state is a UI derivation;
  the DB `status` stays `active` until a manual deactivation. Acceptable — the
  auth gate is the column check.
- **YR `chapters` table / `volunteer_chapter_link` / volunteer-portfolio
  chapter display** stay in place, dormant, until the coordinated cleanup (§8).
- **Volunteer "society membership"** (a volunteer shown as part of a chapter)
  is not built. If wanted later it is managed from the platform/admin side, its
  own effort.
- **In-place chapter reassignment** of an existing opportunity is not
  supported — chapter is fixed at creation (§4.1). Re-home via
  delete-and-recreate. Relaxable later.
- **Decomposition:** this spec is one design but wants **two implementation
  plans** — (1) platform-side: `chapters` table + Edge Functions + the
  Organization page + `update-organization` branding + `org_branding` fix +
  staff expiry (no YR changes, lower risk, ships chapter *management* and
  expiry standalone); (2) enforcement: the §3 per-key token model + §4 YR RLS
  and handler changes + the Create Opportunity picker (cross-project,
  coordinate with concurrent YR work). Plan 2 depends on Plan 1's `chapters`
  table and on §3 being deployed together.

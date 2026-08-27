# Platform Design Spec — `platform` (repo: `tmp-partner-admin`)

Status: approved for implementation planning
Date: 2026-08-27

## 1. Purpose & Scope

`platform` is the shared control plane for the whole multi-tenant system.
It owns three things: staff identity/auth, the organization + module
registry (including fine-grained role/permission management), and the
admin hub shell — including the VMS-admin UI section. This spec covers
all three as one deployable unit (one Supabase project + one Next.js
app), the same pattern already used by the `vms` repo.

`platform` does not own or store any module's domain data. `vms/backend`
(and any future module backend) remains independently deployable and
independently testable, with no dependency on `platform` at request time
(see §7).

**A note on scope vs. the original vms requirements doc**: that
document's Phase 1 scope table explicitly defers "granular permission
matrix" and "Full RBAC" past Phase 1, in favor of a lightweight
Super Admin/Admin distinction. That document was written before the
multi-org, multi-module `platform` direction existed — it assumed one
organization (Youth Republic) would ever use this system. Since
`platform` is now known to span multiple organizations and modules
(a second module is realistically coming), a real permission system is
adopted here deliberately, ahead of what that document scoped. This is a
considered expansion, not scope creep discovered after the fact.

## 2. Foundational Decisions

- **Module = separate project. Organization = row + RLS.** Each module
  (`vms` today, a health-org module likely next) is its own Supabase
  project, matching the split already established between `platform` and
  `vms/backend`. Organizations are never separate projects — they are rows
  in `platform`'s `organizations` table and are scoped within each module
  project via `organization_id` columns + RLS. This is required by vms's
  own core thesis (a volunteer's portfolio spans every org she's worked
  with — impossible if orgs were isolated databases), and it avoids
  per-tenant infrastructure growth as organizations are added.
- **Staff auth lives only in `platform`, once.** No module runs its own
  staff Auth. A module may run its own *end-user* Auth if it has
  public-facing users (vms has volunteers; a health module would have its
  own equivalent) — staff never authenticate against a module's Auth
  directly, they carry `platform`'s signed token into it.
- **Module enablement is `platform_owner`-only.** `org_modules` (§3) is
  written only by `platform_owner` — no org-level role can enable a
  module for its own organization. This is a cross-org, effectively
  billing/contract-level decision, not an operational one.
- **Module access is per-staff-member, per-module, on top of
  per-organization enablement.** An organization having a module enabled
  is necessary but not sufficient — an org's `super_admin`/`admin` must
  additionally grant a specific staff member a role for that specific
  module (`staff_module_roles`, §3) before that staff member sees or can
  use it. Two staff at the same org, both with access to `vms`, can hold
  different roles with different permissions inside it.
- **Staff aren't invited, they're created.** An org's `super_admin` or
  `admin` (or `platform_owner`, for any org) creates a staff account
  directly with a system-generated temporary password. The account is
  flagged to force a password change on first login before anything else
  is reachable — there is no email-invite-link flow.
- **Org-management authority is a separate, mostly-hardcoded tier from
  module permissions.** `org_super_admin` unconditionally bypasses every
  permission check within its org and is the only tier that can perform
  destructive (hard-delete) actions — remove another admin, delete the
  org. `org_admin` can do everything operational — create staff, build
  custom roles, grant/revoke staff module access — but can only
  deactivate (soft-delete), never hard-delete, mirroring the
  soft-delete-only convention already used everywhere else in this
  system (vms spec §3). Regular staff hold no org-management tier at all
  — only whatever module role(s) they've been granted.
- **Permissions available to build a role from come from the
  organization's enabled modules.** A role (system-provided or custom)
  can only be assigned permissions that belong to a module the
  organization actually has enabled (via `org_modules`). Custom roles are
  defined per-organization — each org's `admin`/`super_admin` builds its
  own, rather than picking from a platform-wide template library.
- **The JWT carries resolved permissions, not just role names.**
  Fine-grained enforcement has to happen at the module backend (RLS/Edge
  Functions), not just by hiding buttons in `platform`'s UI, or a caller
  could bypass it by hitting the module backend directly with a valid
  staff token. The only way to do that without the module backend calling
  back into `platform` per request (which would violate `vms/backend`'s
  own "no dependency on `platform`" goal) is for `mintStaffToken()` to
  resolve and embed the staff's actual permission set per module at mint
  time (§4). This is a known ripple into `vms-backend`'s already-written
  RLS and Edge Function tasks — see §7.
- **Organizations are pushed into module backends, never pulled at
  request time.** When `platform` creates, renames, or deactivates an
  organization with a module enabled, it pushes the change to that
  module's backend (`syncOrganization()` on `vms/backend` — see the vms
  spec §3–4). A module's frontend never makes a live cross-project call
  just to resolve a name; this was considered and rejected in favor of
  the push model specifically to avoid `vms/frontend`'s request path
  depending on `platform`'s uptime.
- **Module UI code lives inside `platform`, not imported from a module's
  own repo.** Each module gets a hand-written, typed client
  (`lib/modules/<key>/client.ts`) inside `platform` that calls that
  module's backend directly from the browser, using the staff JWT. No
  cross-repo package publishing, no shared UI components across repos —
  the alternative (publishing an importable package from `vms` or
  building a real monorepo spanning both repos) re-couples the two repos'
  release cycles for a type-safety benefit a small, stable, spec'd
  contract doesn't need yet, and would need to be repeated per module as
  more are added.
- **A module backend's contract with `platform` must never break in
  place.** A breaking change ships as a new, additively-versioned
  endpoint alongside the old one; the old one is removed only after
  `platform` has migrated off it. See §7 for how this is verified today,
  and when to revisit that mechanism.

## 3. Data Model (`platform`)

All tables use UUID primary keys and soft-delete (`deactivated_at`)
rather than hard deletes.

### `staff`

id, auth_user_id (FK to `platform`'s own `auth.users`), full_name, email,
`platform_owner` (bool — bypasses all org/module scoping, same as vms's
`is_platform_owner()`), `must_change_password` (bool — set `true` on
creation, cleared once the staff member sets their own password),
status (active/deactivated), created_at, deactivated_at.

### `organizations`

id, name, slug, status, created_at, deactivated_at. Rizq is the first
row. ("Youth Republic" is the brand name of the `vms` product itself, not
an organization/tenant.)

### `modules`

id, key (the string that appears in the JWT and in a module backend's
Edge Functions, e.g. `"vms"`), display_name.

### `org_modules`

`organization_id, module_id` — composite PK. Which modules an
organization has enabled. Written only by `platform_owner` (§2).

### `staff_org_roles`

`staff_id, organization_id, org_tier` — composite PK. `org_tier` ∈
`super_admin | admin | null`. Governs org-management authority only
(create staff, build custom roles, grant/revoke `staff_module_roles`) —
not module-level permissions. `null`/absent means the staff member has no
org-management authority, only whatever module roles they hold.
`org_tier` is a `platform`-internal concept and is never sent to a module
backend — vms/backend has no reason to know whether a staff member is an
`admin` or `super_admin` in `platform`'s own admin hub. A module backend
only needs (a) which orgs a staff member is affiliated with, for
visibility joins, and (b) that staff member's resolved permissions for
that module — both covered by `module_access` (§4). This is why the JWT's
`org_roles` claim carries only `organization_id`, nothing else.

### `permissions`

id, module_id, resource, action. `action` ∈ `read | write | update |
delete`. A catalog — e.g. `(vms, applications, write)`,
`(vms, hours, verify)` is really `(vms, hours, update)` in this scheme
(business-specific verbs like "verify" or "decide" map onto the nearest
of the four canonical actions; the resource distinguishes the rest).

### `roles`

id, organization_id, module_id, name, `is_system` (bool). Org-scoped and
module-scoped. `is_system` roles (e.g. a default "Viewer" — all reads —
and "Editor" — read/write/update — per module) are seeded when
`platform_owner` enables that module for the org, and can't be edited or
deleted. Custom roles are built freely by that org's `admin`/
`super_admin` from the permissions belonging to modules the org has
enabled.

### `role_permissions`

`role_id, permission_id` — composite PK.

### `staff_module_roles`

`staff_id, organization_id, module_id, role_id` — composite PK. The
per-staff, per-module grant (§2). No row here means no access to that
module for that staff member in that org, regardless of `org_modules`.

## 4. Auth & JWT Issuance

- **Staff login** uses `platform`'s own Supabase Auth (email/password to
  start — no SSO needed yet).
- **Staff creation**: an org's `admin`/`super_admin`, or `platform_owner`
  for any org, creates the staff account with a system-generated
  temporary password and sets `must_change_password: true`. The admin
  hub checks this flag right after login and routes to a "set your
  password" screen before anything else is reachable.
- **`mintStaffToken()`** runs on login (and on session refresh) and joins
  `staff_org_roles`, `staff_module_roles`, `roles`, and `role_permissions`
  to build:

  ```json
  {
    "actor_type": "staff",
    "staff_id": "staff-1",
    "platform_owner": false,
    "org_roles": [{ "organization_id": "org-1" }],
    "module_access": [
      {
        "organization_id": "org-1",
        "module": "vms",
        "permissions": ["applications:read", "applications:write", "hours:read"]
      }
    ]
  }
  ```

  `staff_id` is the minting staff member's own `staff.id` — the durable
  identifier a module backend uses to attribute a write to the actual
  authenticated actor (e.g. `admin_action_log.staff_id`,
  `applications.decided_by`), instead of trusting a `staffId` field a caller
  supplies in its own request body.

  `org_roles` carries only `organization_id` — no `org_tier`, no role
  name — since a module backend's authorization decisions are driven
  entirely by `module_access[].permissions` (§3). Signed HS256 with
  `STAFF_JWT_SECRET`, shared with every module backend (`vms/backend`
  today). Short-lived; role/permission changes take effect on the next
  refresh, not instantly. `org_super_admin` still gets an explicit
  `module_access` entry per module the org has enabled, with every
  available permission for that module resolved in — bypass is
  implemented as "has all the org's permissions," not as a separate code
  path module backends need to special-case.
- This staff token is distinct from `platform`'s own Supabase session
  token. The admin hub uses its own Supabase session for `platform`'s own
  tables (staff/org/module/role registry) and attaches the staff JWT as
  the `Authorization` header only when calling out to a module backend.
- **`syncOrganization()` calls** (into a module backend, e.g.
  `vms/backend`) are authenticated with a staff token minted for
  `platform_owner: true` — no separate secret or mechanism.

## 5. Admin Hub Shell & Module Structure

- Next.js app, authenticated-only — no public pages, unlike `vms/frontend`.
- Nav is built from the staff's `org_roles` + `module_access` claims: an
  org switcher if the staff has roles in more than one organization, then
  the module list they've actually been granted access to for the
  selected org (not merely every module the org has enabled).
- An `org_admin`/`org_super_admin` section (per org) manages that org's
  staff, custom roles, and per-staff module access grants.
- A `platform_owner`-only section manages organizations and per-org
  module enablement platform-wide.
- **Code structure** — a module's code lives entirely under its own
  `modules/<key>/` subfolder everywhere; the only file that "knows about"
  every module is a single registry manifest the shell iterates over
  against the staff's `module_access` claim:

  ```
  platform/
    registry/
      modules.ts          # module key -> {navLabel, route, icon, component}
    app/modules/
      vms/...              # VMS-admin routes only
      health/...            # added later, own folder, no edits to vms/
    lib/modules/
      vms/client.ts         # typed wrappers over vms/backend's API
      health/client.ts       # added later
    components/modules/
      vms/...
      health/...
    components/shell/        # org switcher, nav, staff/role/module management
  ```

  Adding a second module later means: a new `modules` row, a new folder
  set under each of `app/`, `lib/`, `components/`, and one new entry in
  `registry/modules.ts` — nothing inside `modules/vms/` changes. This is
  a static folder convention, not a dynamic plugin-loading system —
  right-sized for one-to-two modules; revisit only if the module count
  grows enough to make it unwieldy.
- The VMS-admin section is built directly here, using
  `lib/modules/vms/client.ts` and the staff JWT, per the "module UI lives
  inside `platform`" decision in §2. Its required scope is detailed in §6.

## 6. VMS Module Scope Inside the Admin Hub (Phase 1)

Captured here so it isn't lost before this section gets its own
implementation plan — this is the requirements doc's Admin nav (§4) and
Admin Dashboard & Reporting scope (§8), which nothing built so far
addresses yet:

- **Dashboard** — a KPI summary: Total Registered Volunteers, Active
  Volunteers, Completed Participations, Volunteers by City, Volunteers by
  Province, Volunteers by Institution, Applications Received, Selected
  Volunteers, Total Verified Volunteer Hours, Participation by
  Opportunity/Activity Type.
- **Volunteers** — search by name/email/phone; filter by City, Province,
  Institution, Volunteer Status; view; CSV/Excel export.
- **Opportunities** — create, edit, publish; filter by type/status.
- **Applications** — review and decide (`selected` / `waitlisted` /
  `rejected` / `under_review`), including promoting a `waitlisted`
  application to `selected` when a spot opens (manual, per the
  requirements doc §5D); filter by Opportunity and Application Status.
- **Activities & Hours** — record, verify (`verifyHours()`), bulk-assign
  hours for fixed-duration activities (`bulkAssignHours()`); filter by
  Activity Type and Participation Status.
- **Reports & Exports** — CSV/Excel export on every list view above, not
  only the opportunity/application/hours export already scoped in
  `vms/backend`'s `exportCSV()` (vms spec §4) — volunteer list export
  needs the same treatment.

All of the above operate through `lib/modules/vms/client.ts` under the
RBAC model in §2–4: a staff member only sees and can act on what their
resolved `module_access` permissions for `vms` in that org allow.

## 7. Cross-Repo Integration & Connectivity Safety

- **Direct client calls, no proxy.** The admin hub's browser client calls
  a module backend's PostgREST/Edge Functions directly, attaching the
  staff JWT. `platform` never proxies or duplicates a module's data.
- **Org data is pushed, not pulled** — see §2 and the vms spec's
  `organizations` mirror table + `syncOrganization()` (vms spec §3–4).
  `platform` calls this whenever it creates/renames/deactivates an
  organization with `vms` enabled. This is the only direction data flows
  from `platform` into a module backend; everything else is `platform`
  reading from the module backend as a client.
- **Fine-grained permission enforcement ripples into `vms-backend`'s
  existing plan.** The JWT's `org_roles` entries drop the `role` field
  entirely (§4) — `vms-backend`'s `staff_has_org_role(p_org_id,
  p_roles)` (Task 10) already only ever gets called with `p_roles: null`
  in every existing test, so this is a simplification, not a break: it
  becomes a pure "is this staff affiliated with this org" check, used
  only for RLS *visibility* (can a staff member see this row at all).
  *Authorization* for actually taking an action (e.g. `decide-application`
  requiring `applications:write`) needs a new function — e.g.
  `staff_has_permission(p_org_id uuid, p_module text, p_permission text)
  returns boolean`, reading the new `module_access` claim — wired into
  every Edge Function in Tasks 14–23 that currently only checks org
  membership before performing a write. `vms-backend`'s `StaffClaims`
  type (Task 12) needs the corresponding `moduleAccess` field. Tracked as
  a known follow-up pass on `vms-backend`'s plan, not yet applied.
- **Contract verification, today's mechanism.** `platform`'s CI checks
  out the module's repo (e.g. `vms`), boots its local Supabase stack
  (already fully scripted by the vms-backend plan), and runs a small
  integration suite exercising each `lib/modules/<key>/client.ts` against
  the real endpoints it wraps. This catches drift before merge with zero
  additional hosted infrastructure.
- **Deferred: consumer-driven contract testing (Pact).** The
  production-grade version of the above is CDC — `platform` publishes
  consumer contracts to a broker, and each module backend verifies
  against them in its own CI, independent of `platform`'s pipeline. This
  is deliberately deferred: it requires a hosted broker and adds real
  authoring overhead that pays off once there are genuinely independent
  teams/modules, not while `vms/backend` itself is still being built.
  Revisit when the health module lands and there are 3+ independently
  evolving repos, or when a module's contract has stabilized enough to
  want stronger regression protection than a same-repo-family
  integration suite gives.
- **Never break a contract in place** (§2) — a module backend ships
  breaking changes as new, additively-versioned endpoints; `platform`
  migrates and only then is the old endpoint removed. This rule is now
  recorded as a Global Constraint in `vms-backend`'s implementation plan
  and applies identically to any future module.

## 8. Cross-Cutting Concerns

- **Hosting** — a separate Supabase project for `platform` (staff Auth +
  org/module/staff/role registry tables, distinct from any module's own
  Supabase project), Next.js app on Vercel. No hosted infrastructure
  beyond that, since CDC/Pact is deferred (§7).
- **Public endpoints** — none. `platform` has no public write endpoints
  (staff accounts are created by admins, not self-serve) and, since org
  data reaches modules by push (§7) rather than by a live public read, no
  public read endpoint either.
- **Testing** — unit tests on `mintStaffToken()`'s claims derivation
  (org tiers, module access, and resolved permissions computed correctly
  from `staff_org_roles` + `staff_module_roles` + `roles` +
  `role_permissions`), on the module/permission-catalog queries (a role
  can't be given a permission from a module the org hasn't enabled), plus
  the cross-repo integration suite described in §7.
- **Backups** — same Supabase free-tier caveat as `vms`: acceptable to
  leave unresolved during internal testing, must be resolved before this
  holds real staff accounts/org data at MVP launch.
- **Secrets** — `STAFF_JWT_SECRET`, shared with every module backend
  (today: `vms/backend`). No other module-specific secrets belong here;
  each module manages its own (e.g. `vms/backend`'s R2/Resend
  credentials).

## 9. Explicitly Out of Scope

- Self-serve organization or staff signup — organizations and module
  enablement stay `platform_owner`-only; staff accounts are created by an
  org's admin/super_admin or by `platform_owner`, never self-registered.
- Building the health-org module's own UI/backend — only the module and
  permission registry need to be generic enough to support it later
  (§2, §3).
- CDC/Pact contract-testing infrastructure — deferred per §7.
- SSO or non-password staff auth.
- A dynamic/generic plugin-loading system for modules — the static
  `modules/<key>/` folder convention (§5) is the right size for
  one-to-two modules.
- A platform-tier roles/permissions table (beyond the single
  `platform_owner` flag) — revisit only if a platform-wide role narrower
  than full ownership is actually needed.

# Platform Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Supabase project that owns staff identity, the organization/module registry, and the fine-grained role/permission system, plus the Edge Functions that mint the cross-project staff JWT and manage staff/orgs/roles — as a fully working, independently testable service, with no dependency on the admin hub UI (Plan 2) or any module backend at request time.

**Architecture:** Postgres schema for staff, organizations, modules, and a permission catalog, with roles built per-organization from that catalog. Two authentication layers are kept deliberately separate: `platform`'s own Supabase Auth session (used for reading/writing `platform`'s own tables) and a signed cross-project staff JWT (`mintStaffToken()`) that a module backend like `vms/backend` verifies independently, carrying only resolved permissions — never `platform`-internal concepts like `org_tier`. Every write requiring nuanced authorization (create staff, assign a role, enable a module) goes through a service-role Edge Function with its own authorization check, matching the pattern already established in `vms/backend`; RLS on `platform`'s own tables covers reads.

**Tech Stack:** Supabase (Postgres 15, Auth, Edge Functions), Supabase CLI for local dev and migrations, Deno + TypeScript for Edge Functions, pgTAP for database/RLS tests, Deno's built-in test runner for Edge Function tests.

**Spec:** [docs/superpowers/specs/2026-08-27-platform-design.md](../specs/2026-08-27-platform-design.md)

## Global Constraints

- Module enablement (`org_modules`) is written only by `platform_owner` — no org-level role can enable a module for its own org (spec §2).
- Module access is per-staff-member, per-module (`staff_module_roles`), on top of per-org enablement — an org having a module enabled is necessary but not sufficient for any given staff member to see or use it (spec §2).
- Staff aren't invited, they're created: an org's `admin`/`super_admin` (or `platform_owner`, for any org) creates a staff account directly with a system-generated temporary password; `must_change_password` forces a password-set step before anything else is reachable (spec §2, §4).
- `org_tier` (`super_admin`/`admin`) governs `platform`-internal org-management authority only — it is never sent to a module backend. Only `platform_owner` and `org_super_admin` bypass fine-grained checks; `org_admin` is otherwise an ordinary permission-holder who can create staff and manage roles but can only deactivate, never hard-delete (spec §2).
- Permissions assignable to a role must belong to a module the organization has enabled — enforced at role-creation time (spec §2).
- Custom roles are per-organization; there is no platform-wide role template library (spec §2).
- The staff JWT's `org_roles` claim carries only `organization_id` (no role name); all authorization decisions in a module backend are driven by the JWT's `module_access[].permissions` (spec §3, §4).
- No hard deletes outside append-only concerns; use `deactivated_at` / `status` (spec §3, matching the soft-delete convention already used in `vms`).
- `syncOrganization()` calls into a module backend are authenticated with a staff token minted for `platform_owner: true` — no separate secret (spec §4).
- **This plan runs against a hosted Supabase Cloud project, not local Docker.** The plan was originally written assuming `npx supabase start` (a local Postgres/Auth/Edge-Functions stack via Docker) for every task's test cycle. Neither the local dev machine nor the intended cloud execution environment for this plan has Docker available, so every task below has been rewritten to work against a real hosted project instead — this is a substitution, not a design change; nothing about the schema, RLS policies, or Edge Function logic differs. Concretely: `npx supabase db reset && npx supabase test db` becomes `npx supabase db push --linked && for f in supabase/tests/database/*.sql; do psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$f"; done` (push whatever new migration the task just added, then run every pgTAP test file directly against the hosted database over `psql`); a standalone `npx supabase test db` (used to confirm a test fails *before* its migration exists) becomes just the `psql` loop, with no push; `deno test`/`deno task test` commands are unchanged — they already just read `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` from the environment, local or hosted makes no difference to them. Running pgTAP files directly via `psql` is safe to repeat against a shared project because every test file wraps its assertions in `begin; ...; rollback;` — nothing persists past the file. `.env` (git-ignored, from `.env.example`) must be sourced (`set -a; source .env; set +a`) before any of these commands in a given shell. This project must stay a genuinely separate hosted Supabase project from `vms/backend`'s (spec §2, "Module = separate project") — `SUPABASE_URL`/`SUPABASE_DB_URL`/etc. here must never point at the same project as `youth-republic/backend/.env`.

---

## File Structure

```
supabase/
  config.toml
  migrations/
    0001_staff.sql
    0002_organizations.sql
    0003_modules.sql
    0004_org_modules.sql
    0005_permissions.sql
    0006_staff_org_roles.sql
    0007_roles_and_role_permissions.sql
    0008_staff_module_roles.sql
    0009_rls.sql
  tests/database/
    000_setup.sql
    staff_test.sql
    organizations_test.sql
    modules_test.sql
    org_modules_test.sql
    permissions_test.sql
    staff_org_roles_test.sql
    roles_and_role_permissions_test.sql
    staff_module_roles_test.sql
    rls_test.sql
  functions/
    _shared/
      supabaseAdmin.ts
      verifyPlatformStaffSession.ts
      verifyPlatformStaffSession.test.ts
      moduleBackends.ts
    mint-staff-token/
      handler.ts
      handler.test.ts
      index.ts
    create-staff/
      handler.ts
      handler.test.ts
      index.ts
    set-password/
      handler.ts
      handler.test.ts
      index.ts
    create-organization/
      handler.ts
      handler.test.ts
      index.ts
    update-organization/
      handler.ts
      handler.test.ts
      index.ts
    enable-module/
      handler.ts
      handler.test.ts
      index.ts
    assign-staff-module-role/
      handler.ts
      handler.test.ts
      index.ts
    create-custom-role/
      handler.ts
      handler.test.ts
      index.ts
    deactivate-staff/
      handler.ts
      handler.test.ts
      index.ts
  deno.jsonc
```

Each Edge Function directory splits `handler.ts` (pure logic, takes a Supabase client as a parameter, unit-tested directly) from `index.ts` (the `Deno.serve` HTTP wrapper), matching `vms/backend`'s pattern.

---

### Task 1: Backend project bootstrap

**Files:**
- Create: `supabase/config.toml` (via `supabase init`)
- Create: `supabase/deno.jsonc`
- Create: `supabase/functions/_shared/supabaseAdmin.ts`
- Create: `README.md`
- Consumes (already committed, not created by this task): `.env.example` — copy it to `.env` and fill in real values before starting Task 1; every command in this plan reads from that file.

**Interfaces:**
- Produces: `getAdminClient(): SupabaseClient` — every Edge Function handler test and `index.ts` wrapper uses this to get a service-role client against the project's own database.

**Environment note:** this plan runs against a real hosted Supabase Cloud project, not a local Docker-based stack — see the Global Constraints section for the full rationale (same one `vms-backend`'s plan documents, since both hit the identical Docker-unavailable constraint).

- [ ] **Step 1: Install the Supabase CLI and initialize the project**

```bash
npx supabase init
```

`supabase init` is local scaffolding only — it doesn't need Docker.

- [ ] **Step 2: Link to the hosted Supabase Cloud project and confirm connectivity**

Copy `.env.example` to `.env` (if not already done) and fill in `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, `SUPABASE_PROJECT_REF`, and `SUPABASE_ACCESS_TOKEN` from the project's dashboard (Settings > API for the first three, Settings > Database > Connection string > URI for `SUPABASE_DB_URL`, Settings > General for the project ref, and https://supabase.com/dashboard/account/tokens for a personal access token). Then, from the repo root:

```bash
set -a; source .env; set +a
npx supabase link --project-ref "$SUPABASE_PROJECT_REF"
psql "$SUPABASE_DB_URL" -c "select 1;"
```

Expected: `link` completes without error, and the `psql` sanity check returns a single row containing `1`. Every later task's `Run:` commands assume `.env` has already been sourced this way in the current shell.

- [ ] **Step 3: Add the Deno config for Edge Functions**

Create `supabase/deno.jsonc`:

```jsonc
{
  "imports": {
    "@supabase/supabase-js": "npm:@supabase/supabase-js@2"
  },
  "tasks": {
    "test": "deno test --allow-net --allow-env functions/"
  }
}
```

- [ ] **Step 4: Write the shared admin client module**

Create `supabase/functions/_shared/supabaseAdmin.ts`:

```typescript
import { createClient, SupabaseClient } from "@supabase/supabase-js";

export function getAdminClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
```

- [ ] **Step 5: Document dev setup in the README**

Create `README.md`:

```markdown
# platform

Runs against a real hosted Supabase Cloud project — no local Docker stack.

Setup (once):

    cp .env.example .env       # then fill in real values, see .env.example for where each comes from
    set -a; source .env; set +a
    npx supabase link --project-ref "$SUPABASE_PROJECT_REF"

Every dev session:

    set -a; source .env; set +a
    npx supabase db push --linked                                                          # applies any new migrations
    for f in supabase/tests/database/*.sql; do psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$f"; done   # runs pgTAP database/RLS tests
    cd supabase && deno task test                                                           # runs Edge Function unit tests

Required environment variables (see `.env.example`, values are set
per-environment, never committed): `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, `SUPABASE_PROJECT_REF`,
`SUPABASE_ACCESS_TOKEN`, `STAFF_JWT_SECRET` (shared with every module
backend), `VMS_BACKEND_FUNCTIONS_URL` (vms/backend's Edge Functions base
URL, used to push organization syncs).
```

- [ ] **Step 6: Commit**

```bash
git add supabase/config.toml supabase/deno.jsonc supabase/functions/_shared/supabaseAdmin.ts README.md
git commit -m "chore: bootstrap platform Supabase project"
```

---

### Task 2: `staff` table and platform RLS helper functions

**Files:**
- Create: `supabase/migrations/0001_staff.sql`
- Test: `supabase/tests/database/000_setup.sql`
- Test: `supabase/tests/database/staff_test.sql`

**Interfaces:**
- Produces: table `staff`; functions `current_staff_id() returns uuid`, `is_platform_owner() returns boolean`. Used by every RLS policy and Edge Function handler from Task 5 onward.

- [ ] **Step 1: Write the pgTAP test setup file**

Create `supabase/tests/database/000_setup.sql`:

```sql
create extension if not exists pgtap with schema extensions;
```

- [ ] **Step 2: Write the failing test**

Create `supabase/tests/database/staff_test.sql`:

```sql
begin;
select plan(6);

select has_table('public', 'staff', 'staff table exists');
select has_column('public', 'staff', 'must_change_password', 'has must_change_password column');
select col_is_unique('public', 'staff', 'email', 'email is unique');
select col_is_unique('public', 'staff', 'auth_user_id', 'auth_user_id is unique');

insert into staff (auth_user_id, full_name, email, platform_owner)
values (gen_random_uuid(), 'Owner Test', 'owner-test@example.com', true);

select set_config('request.jwt.claims', '{}', true);
select set_config('role', 'authenticated', true);

select is(is_platform_owner(), false, 'is_platform_owner is false with no session');

select * from finish();
rollback;
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `for f in supabase/tests/database/*.sql; do psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$f"; done`
Expected: FAIL — `staff` table does not exist.

- [ ] **Step 4: Write the migration**

Create `supabase/migrations/0001_staff.sql`:

```sql
create table staff (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  platform_owner boolean not null default false,
  must_change_password boolean not null default true,
  status text not null default 'active' check (status in ('active', 'deactivated')),
  created_at timestamptz not null default now(),
  deactivated_at timestamptz
);

create index staff_status_idx on staff (status);

create or replace function current_staff_id() returns uuid as $$
  select id from staff where auth_user_id = auth.uid();
$$ language sql stable;

create or replace function is_platform_owner() returns boolean as $$
  select coalesce((select platform_owner from staff where auth_user_id = auth.uid()), false);
$$ language sql stable;
```

- [ ] **Step 5: Apply the migration and run tests**

Run: `npx supabase db push --linked && for f in supabase/tests/database/*.sql; do psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$f"; done`
Expected: PASS on all 6 assertions.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0001_staff.sql supabase/tests/database/000_setup.sql supabase/tests/database/staff_test.sql
git commit -m "feat: add staff table and platform RLS helper functions"
```

---

### Task 3: `organizations` table

**Files:**
- Create: `supabase/migrations/0002_organizations.sql`
- Test: `supabase/tests/database/organizations_test.sql`

**Interfaces:**
- Produces: table `organizations`. Rizq is the first row seeded by Task 15's `create-organization` function in practice, not by migration — this table starts empty.

- [ ] **Step 1: Write the failing test**

Create `supabase/tests/database/organizations_test.sql`:

```sql
begin;
select plan(3);

select has_table('public', 'organizations', 'organizations exists');
select col_is_unique('public', 'organizations', 'slug', 'slug is unique');

insert into organizations (name, slug) values ('Rizq', 'rizq');
select is((select status from organizations where slug = 'rizq'), 'active', 'defaults to active');

select * from finish();
rollback;
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `for f in supabase/tests/database/*.sql; do psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$f"; done`
Expected: FAIL — table does not exist.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/0002_organizations.sql`:

```sql
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'active' check (status in ('active', 'deactivated')),
  created_at timestamptz not null default now(),
  deactivated_at timestamptz
);
```

- [ ] **Step 4: Apply and run tests**

Run: `npx supabase db push --linked && for f in supabase/tests/database/*.sql; do psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$f"; done`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0002_organizations.sql supabase/tests/database/organizations_test.sql
git commit -m "feat: add organizations table"
```

---

### Task 4: `modules` table

**Files:**
- Create: `supabase/migrations/0003_modules.sql`
- Test: `supabase/tests/database/modules_test.sql`

**Interfaces:**
- Produces: table `modules`. Consumed by Tasks 5–9 (`org_modules`, `permissions`, `roles`, `staff_module_roles`).

- [ ] **Step 1: Write the failing test**

Create `supabase/tests/database/modules_test.sql`:

```sql
begin;
select plan(2);

select has_table('public', 'modules', 'modules exists');
select col_is_unique('public', 'modules', 'key', 'key is unique');

select * from finish();
rollback;
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `for f in supabase/tests/database/*.sql; do psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$f"; done`
Expected: FAIL — table does not exist.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/0003_modules.sql`:

```sql
create table modules (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  display_name text not null
);

insert into modules (key, display_name) values ('vms', 'Volunteer Management System');
```

- [ ] **Step 4: Apply and run tests**

Run: `npx supabase db push --linked && for f in supabase/tests/database/*.sql; do psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$f"; done`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0003_modules.sql supabase/tests/database/modules_test.sql
git commit -m "feat: add modules table, seed vms module"
```

---

### Task 5: `org_modules` table

**Files:**
- Create: `supabase/migrations/0004_org_modules.sql`
- Test: `supabase/tests/database/org_modules_test.sql`

**Interfaces:**
- Consumes: `organizations` (Task 3), `modules` (Task 4).
- Produces: table `org_modules`. Written only by the `enable-module` Edge Function (Task 15) — no RLS insert/update/delete policy is ever defined for it (Task 10).

- [ ] **Step 1: Write the failing test**

Create `supabase/tests/database/org_modules_test.sql`:

```sql
begin;
select plan(2);

select has_table('public', 'org_modules', 'org_modules exists');

insert into organizations (name, slug) values ('Rizq', 'rizq') returning id as org_id \gset
insert into org_modules (organization_id, module_id)
select :'org_id', id from modules where key = 'vms';

select is((select count(*) from org_modules where organization_id = :'org_id'), 1::bigint, 'vms enabled for the org');

select * from finish();
rollback;
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `for f in supabase/tests/database/*.sql; do psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$f"; done`
Expected: FAIL — table does not exist.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/0004_org_modules.sql`:

```sql
create table org_modules (
  organization_id uuid not null references organizations(id) on delete cascade,
  module_id uuid not null references modules(id) on delete cascade,
  enabled_at timestamptz not null default now(),
  primary key (organization_id, module_id)
);
```

- [ ] **Step 4: Apply and run tests**

Run: `npx supabase db push --linked && for f in supabase/tests/database/*.sql; do psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$f"; done`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0004_org_modules.sql supabase/tests/database/org_modules_test.sql
git commit -m "feat: add org_modules table"
```

---

### Task 6: `permissions` table and the `vms` permission catalog

**Files:**
- Create: `supabase/migrations/0005_permissions.sql`
- Test: `supabase/tests/database/permissions_test.sql`

**Interfaces:**
- Consumes: `modules` (Task 4).
- Produces: table `permissions`, seeded with `vms`'s catalog. Consumed by Task 7 (`roles`/`role_permissions`) and Task 12 (`mintStaffToken()`).

Business-specific verbs (e.g. "verify hours," "decide an application") map onto the nearest of the four canonical actions per the spec (§3): `verifyHours()` needs `hours:update`, `decideApplication()` needs `applications:update`, etc. The catalog below is scoped to what `vms/backend`'s plan actually implements today, including `participation:write` for admin-direct enrollment (a participation row created without a prior application — vms design spec §3, `vms-backend` Task 28) alongside the existing `participation:update` used by the selected→participating→{completed|no_show|withdrawn} transitions.

- [ ] **Step 1: Write the failing test**

Create `supabase/tests/database/permissions_test.sql`:

```sql
begin;
select plan(3);

select has_table('public', 'permissions', 'permissions exists');

select is(
  (select count(*) from permissions p join modules m on m.id = p.module_id where m.key = 'vms'),
  20::bigint,
  'vms catalog seeded with 20 permissions'
);

select throws_ok(
  $$ insert into permissions (module_id, resource, action) select id, 'opportunities', 'archive' from modules where key = 'vms' $$,
  '23514',
  null,
  'action is restricted to read|write|update|delete'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `for f in supabase/tests/database/*.sql; do psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$f"; done`
Expected: FAIL — table does not exist.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/0005_permissions.sql`:

```sql
create table permissions (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references modules(id) on delete cascade,
  resource text not null,
  action text not null check (action in ('read', 'write', 'update', 'delete')),
  unique (module_id, resource, action)
);

insert into permissions (module_id, resource, action)
select m.id, r.resource, r.action
from modules m
cross join (values
  ('volunteers', 'read'), ('volunteers', 'update'),
  ('opportunities', 'read'), ('opportunities', 'write'), ('opportunities', 'update'), ('opportunities', 'delete'),
  ('applications', 'read'), ('applications', 'write'), ('applications', 'update'),
  ('participation', 'read'), ('participation', 'write'), ('participation', 'update'),
  ('hours', 'read'), ('hours', 'write'), ('hours', 'update'),
  ('chapters', 'read'), ('chapters', 'write'), ('chapters', 'update'), ('chapters', 'delete'),
  ('admin_action_log', 'read'),
  ('export', 'read')
) as r(resource, action)
where m.key = 'vms';
```

- [ ] **Step 4: Apply and run tests**

Run: `npx supabase db push --linked && for f in supabase/tests/database/*.sql; do psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$f"; done`
Expected: PASS on all 3 assertions.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0005_permissions.sql supabase/tests/database/permissions_test.sql
git commit -m "feat: add permissions table, seed vms permission catalog"
```

---

### Task 7: `staff_org_roles` table

**Files:**
- Create: `supabase/migrations/0006_staff_org_roles.sql`
- Test: `supabase/tests/database/staff_org_roles_test.sql`

**Interfaces:**
- Consumes: `staff` (Task 2), `organizations` (Task 3).
- Produces: table `staff_org_roles`; function `staff_org_tier(p_org_id uuid) returns text`, `is_org_admin_or_above(p_org_id uuid) returns boolean`. A staff member with no row here for an org has no org-management authority — this is how "the third value" (spec's `null`) is represented: absence, not a nullable column.

- [ ] **Step 1: Write the failing test**

Create `supabase/tests/database/staff_org_roles_test.sql`:

```sql
begin;
select plan(4);

select has_table('public', 'staff_org_roles', 'staff_org_roles exists');

insert into staff (auth_user_id, full_name, email) values (gen_random_uuid(), 'Admin Test', 'admin-test@example.com') returning id as staff_id \gset
insert into organizations (name, slug) values ('Rizq', 'rizq') returning id as org_id \gset

insert into staff_org_roles (staff_id, organization_id, org_tier) values (:'staff_id', :'org_id', 'admin');

select is(staff_org_tier(:'org_id'), null, 'staff_org_tier reads the JWT-authenticated staff, not an arbitrary staff_id — null with no session');

select throws_ok(
  format($$ insert into staff_org_roles (staff_id, organization_id, org_tier) values ('%s', '%s', 'bogus') $$, :'staff_id', :'org_id'),
  '23514',
  null,
  'org_tier is restricted to super_admin|admin'
);

select is((select org_tier from staff_org_roles where staff_id = :'staff_id'), 'admin', 'row stores the assigned tier');

select * from finish();
rollback;
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `for f in supabase/tests/database/*.sql; do psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$f"; done`
Expected: FAIL — table does not exist.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/0006_staff_org_roles.sql`:

```sql
create table staff_org_roles (
  staff_id uuid not null references staff(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  org_tier text not null check (org_tier in ('super_admin', 'admin')),
  primary key (staff_id, organization_id)
);

create index staff_org_roles_org_idx on staff_org_roles (organization_id);

create or replace function staff_org_tier(p_org_id uuid) returns text as $$
  select org_tier from staff_org_roles
  where staff_id = current_staff_id() and organization_id = p_org_id;
$$ language sql stable;

create or replace function is_org_admin_or_above(p_org_id uuid) returns boolean as $$
  select is_platform_owner() or staff_org_tier(p_org_id) in ('admin', 'super_admin');
$$ language sql stable;
```

- [ ] **Step 4: Apply and run tests**

Run: `npx supabase db push --linked && for f in supabase/tests/database/*.sql; do psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$f"; done`
Expected: PASS on all 4 assertions.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0006_staff_org_roles.sql supabase/tests/database/staff_org_roles_test.sql
git commit -m "feat: add staff_org_roles table and org-tier RLS helpers"
```

---

### Task 8: `roles` and `role_permissions` tables, system role seeding

**Files:**
- Create: `supabase/migrations/0007_roles_and_role_permissions.sql`
- Test: `supabase/tests/database/roles_and_role_permissions_test.sql`

**Interfaces:**
- Consumes: `organizations` (Task 3), `modules` (Task 4), `permissions` (Task 6).
- Produces: tables `roles`, `role_permissions`; function `seed_system_roles_for_module(p_org_id uuid, p_module_id uuid) returns void`. Called by Task 15's `enable-module` handler whenever a module is enabled for an org.

- [ ] **Step 1: Write the failing test**

Create `supabase/tests/database/roles_and_role_permissions_test.sql`:

```sql
begin;
select plan(5);

select has_table('public', 'roles', 'roles exists');
select has_table('public', 'role_permissions', 'role_permissions exists');

insert into organizations (name, slug) values ('Rizq', 'rizq') returning id as org_id \gset
select id as module_id from modules where key = 'vms' \gset

select seed_system_roles_for_module(:'org_id', :'module_id');

select is((select count(*) from roles where organization_id = :'org_id' and is_system), 2::bigint, 'seeds Viewer and Editor');

select is(
  (select count(*) from role_permissions rp join roles r on r.id = rp.role_id
   where r.organization_id = :'org_id' and r.name = 'Viewer'),
  (select count(*) from permissions p join modules m on m.id = p.module_id where m.key = 'vms' and p.action = 'read'),
  'Viewer gets every read permission for the module'
);

select is(
  (select count(*) from role_permissions rp join roles r on r.id = rp.role_id
   join permissions p on p.id = rp.permission_id
   where r.organization_id = :'org_id' and r.name = 'Editor' and p.action = 'delete'),
  0::bigint,
  'Editor does not get delete permissions'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `for f in supabase/tests/database/*.sql; do psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$f"; done`
Expected: FAIL — tables do not exist.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/0007_roles_and_role_permissions.sql`:

```sql
create table roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  module_id uuid not null references modules(id) on delete cascade,
  name text not null,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  unique (organization_id, module_id, name)
);

create table role_permissions (
  role_id uuid not null references roles(id) on delete cascade,
  permission_id uuid not null references permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

create or replace function seed_system_roles_for_module(p_org_id uuid, p_module_id uuid) returns void as $$
declare
  v_viewer_role_id uuid;
  v_editor_role_id uuid;
begin
  insert into roles (organization_id, module_id, name, is_system)
  values (p_org_id, p_module_id, 'Viewer', true)
  returning id into v_viewer_role_id;

  insert into role_permissions (role_id, permission_id)
  select v_viewer_role_id, id from permissions where module_id = p_module_id and action = 'read';

  insert into roles (organization_id, module_id, name, is_system)
  values (p_org_id, p_module_id, 'Editor', true)
  returning id into v_editor_role_id;

  insert into role_permissions (role_id, permission_id)
  select v_editor_role_id, id from permissions where module_id = p_module_id and action in ('read', 'write', 'update');
end;
$$ language plpgsql;
```

- [ ] **Step 4: Apply and run tests**

Run: `npx supabase db push --linked && for f in supabase/tests/database/*.sql; do psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$f"; done`
Expected: PASS on all 5 assertions.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0007_roles_and_role_permissions.sql supabase/tests/database/roles_and_role_permissions_test.sql
git commit -m "feat: add roles/role_permissions tables and system role seeding"
```

---

### Task 9: `staff_module_roles` table

**Files:**
- Create: `supabase/migrations/0008_staff_module_roles.sql`
- Test: `supabase/tests/database/staff_module_roles_test.sql`

**Interfaces:**
- Consumes: `staff` (Task 2), `organizations` (Task 3), `modules` (Task 4), `roles` (Task 8).
- Produces: table `staff_module_roles` — the per-staff, per-module grant. Consumed by Task 12 (`mintStaffToken()`).

- [ ] **Step 1: Write the failing test**

Create `supabase/tests/database/staff_module_roles_test.sql`:

```sql
begin;
select plan(3);

select has_table('public', 'staff_module_roles', 'staff_module_roles exists');

insert into staff (auth_user_id, full_name, email) values (gen_random_uuid(), 'Grant Test', 'grant-test@example.com') returning id as staff_id \gset
insert into organizations (name, slug) values ('Rizq', 'rizq') returning id as org_id \gset
select id as module_id from modules where key = 'vms' \gset
select seed_system_roles_for_module(:'org_id', :'module_id');
select id as role_id from roles where organization_id = :'org_id' and name = 'Editor' \gset

insert into staff_module_roles (staff_id, organization_id, module_id, role_id)
values (:'staff_id', :'org_id', :'module_id', :'role_id');

select is((select count(*) from staff_module_roles where staff_id = :'staff_id'), 1::bigint, 'grant created');

select throws_ok(
  format($$ insert into staff_module_roles (staff_id, organization_id, module_id, role_id) values ('%s', '%s', '%s', '%s') $$, :'staff_id', :'org_id', :'module_id', :'role_id'),
  '23505',
  null,
  'duplicate grant for the same staff+org+module is rejected'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `for f in supabase/tests/database/*.sql; do psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$f"; done`
Expected: FAIL — table does not exist.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/0008_staff_module_roles.sql`:

```sql
create table staff_module_roles (
  staff_id uuid not null references staff(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  module_id uuid not null references modules(id) on delete cascade,
  role_id uuid not null references roles(id) on delete cascade,
  primary key (staff_id, organization_id, module_id)
);

create index staff_module_roles_org_module_idx on staff_module_roles (organization_id, module_id);
```

- [ ] **Step 4: Apply and run tests**

Run: `npx supabase db push --linked && for f in supabase/tests/database/*.sql; do psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$f"; done`
Expected: PASS on all 3 assertions.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0008_staff_module_roles.sql supabase/tests/database/staff_module_roles_test.sql
git commit -m "feat: add staff_module_roles table"
```

---

### Task 10: RLS across all platform tables

**Files:**
- Create: `supabase/migrations/0009_rls.sql`
- Test: `supabase/tests/database/rls_test.sql`

**Interfaces:**
- Consumes: every table and helper function from Tasks 2–9.

Every table below gets a `select` policy only. All writes to these tables go through the service-role Edge Functions in Tasks 11–17, which encode nuanced authorization (e.g. "admin can deactivate, only super_admin can remove") in application code rather than RLS — the same pattern `vms/backend` already uses for `admin_action_log`.

- [ ] **Step 1: Write the failing test**

Create `supabase/tests/database/rls_test.sql`:

```sql
begin;
select plan(3);

insert into staff (auth_user_id, full_name, email, platform_owner)
values (gen_random_uuid(), 'RLS Owner', 'rls-owner@example.com', true)
returning auth_user_id as owner_auth_id \gset

select set_config('request.jwt.claims', format('{"sub": "%s"}', :'owner_auth_id'), true);
select set_config('role', 'authenticated', true);

select ok(is_platform_owner(), 'platform_owner sees themself as owner once authenticated');

select set_config('request.jwt.claims', '{}', true);
select is((select count(*) from staff), 0::bigint, 'no session means no visible staff rows');

select set_config('request.jwt.claims', format('{"sub": "%s"}', :'owner_auth_id'), true);
select is((select count(*) from staff) >= 1, true, 'platform_owner can see staff rows once authenticated');

select * from finish();
rollback;
```

Note: `auth.uid()` reads `sub` from `request.jwt.claims`, matching how vms/backend's RLS tests simulate a session locally.

- [ ] **Step 2: Run tests to verify they fail**

Run: `for f in supabase/tests/database/*.sql; do psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$f"; done`
Expected: FAIL — RLS not yet enabled, so the "no session means no visible rows" assertion fails.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/0009_rls.sql`:

```sql
alter table staff enable row level security;

create policy staff_self_select on staff
  for select using (auth_user_id = auth.uid());

create policy staff_platform_owner_select on staff
  for select using (is_platform_owner());

create policy staff_org_admin_select on staff
  for select using (
    exists (
      select 1 from staff_org_roles sor
      where sor.staff_id = staff.id and is_org_admin_or_above(sor.organization_id)
    )
    or exists (
      select 1 from staff_module_roles smr
      where smr.staff_id = staff.id and is_org_admin_or_above(smr.organization_id)
    )
  );

alter table organizations enable row level security;

create policy organizations_select on organizations
  for select using (
    is_platform_owner()
    or exists (select 1 from staff_org_roles sor where sor.staff_id = current_staff_id() and sor.organization_id = organizations.id)
    or exists (select 1 from staff_module_roles smr where smr.staff_id = current_staff_id() and smr.organization_id = organizations.id)
  );

alter table modules enable row level security;

create policy modules_select on modules for select using (true);

alter table org_modules enable row level security;

create policy org_modules_select on org_modules
  for select using (is_platform_owner() or is_org_admin_or_above(organization_id));

alter table permissions enable row level security;

create policy permissions_select on permissions for select using (true);

alter table staff_org_roles enable row level security;

create policy staff_org_roles_select on staff_org_roles
  for select using (staff_id = current_staff_id() or is_org_admin_or_above(organization_id));

alter table roles enable row level security;

create policy roles_select on roles
  for select using (is_platform_owner() or is_org_admin_or_above(organization_id));

alter table role_permissions enable row level security;

create policy role_permissions_select on role_permissions
  for select using (
    exists (select 1 from roles r where r.id = role_permissions.role_id and (is_platform_owner() or is_org_admin_or_above(r.organization_id)))
  );

alter table staff_module_roles enable row level security;

create policy staff_module_roles_select on staff_module_roles
  for select using (staff_id = current_staff_id() or is_org_admin_or_above(organization_id));
```

- [ ] **Step 4: Apply and run tests**

Run: `npx supabase db push --linked && for f in supabase/tests/database/*.sql; do psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$f"; done`
Expected: PASS on all 3 assertions, and the full suite (`for f in supabase/tests/database/*.sql; do psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$f"; done`) still passes end to end.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0009_rls.sql supabase/tests/database/rls_test.sql
git commit -m "feat: add RLS across all platform tables"
```

---

### Task 11: `verifyPlatformStaffSession()` shared module

**Files:**
- Create: `supabase/functions/_shared/verifyPlatformStaffSession.ts`
- Create: `supabase/functions/_shared/verifyPlatformStaffSession.test.ts`

**Interfaces:**
- Produces: `verifyPlatformStaffSession(supabase: SupabaseClient, authHeader: string | null): Promise<{ staffId: string; platformOwner: boolean }>` — throws `Error("unauthorized")` on any failure. This verifies `platform`'s *own* Supabase Auth session (the browser's logged-in staff member), distinct from the cross-project staff JWT `mintStaffToken()` produces (Task 12) — a module backend never sees this function or its output. Used by every Edge Function in Tasks 13–17.

- [ ] **Step 1: Write the failing test**

Create `supabase/functions/_shared/verifyPlatformStaffSession.test.ts`:

```typescript
import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { verifyPlatformStaffSession } from "./verifyPlatformStaffSession.ts";

function fakeSupabase(options: { user?: { id: string } | null; staff?: { id: string; platform_owner: boolean } | null }) {
  return {
    auth: {
      async getUser(_token: string) {
        return options.user
          ? { data: { user: options.user }, error: null }
          : { data: { user: null }, error: new Error("invalid token") };
      },
    },
    from(_table: string) {
      return {
        select(_columns: string) {
          return {
            eq(_column: string, _value: string) {
              return {
                async single() {
                  return options.staff
                    ? { data: options.staff, error: null }
                    : { data: null, error: new Error("not found") };
                },
              };
            },
          };
        },
      };
    },
  };
}

Deno.test("verifyPlatformStaffSession resolves staffId and platformOwner for a valid session", async () => {
  const supabase = fakeSupabase({ user: { id: "auth-1" }, staff: { id: "staff-1", platform_owner: true } });
  const result = await verifyPlatformStaffSession(supabase as never, "Bearer good-token");
  assertEquals(result.staffId, "staff-1");
  assertEquals(result.platformOwner, true);
});

Deno.test("verifyPlatformStaffSession rejects a missing header", async () => {
  const supabase = fakeSupabase({ user: null });
  await assertRejects(() => verifyPlatformStaffSession(supabase as never, null), Error, "unauthorized");
});

Deno.test("verifyPlatformStaffSession rejects a session with no staff row", async () => {
  const supabase = fakeSupabase({ user: { id: "auth-1" }, staff: null });
  await assertRejects(() => verifyPlatformStaffSession(supabase as never, "Bearer good-token"), Error, "unauthorized");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd supabase && deno test --allow-net --allow-env functions/_shared/verifyPlatformStaffSession.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write the implementation**

Create `supabase/functions/_shared/verifyPlatformStaffSession.ts`:

```typescript
import { SupabaseClient } from "@supabase/supabase-js";

export async function verifyPlatformStaffSession(
  supabase: SupabaseClient,
  authHeader: string | null,
): Promise<{ staffId: string; platformOwner: boolean }> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("unauthorized");
  }
  const token = authHeader.slice("Bearer ".length);
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) {
    throw new Error("unauthorized");
  }

  const { data: staff, error: staffError } = await supabase
    .from("staff")
    .select("id, platform_owner")
    .eq("auth_user_id", userData.user.id)
    .single();
  if (staffError || !staff) {
    throw new Error("unauthorized");
  }

  return { staffId: staff.id, platformOwner: staff.platform_owner };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd supabase && deno test --allow-net --allow-env functions/_shared/verifyPlatformStaffSession.test.ts`
Expected: PASS on all 3 tests.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/verifyPlatformStaffSession.ts supabase/functions/_shared/verifyPlatformStaffSession.test.ts
git commit -m "feat: add verifyPlatformStaffSession shared module"
```

---

### Task 12: `mintStaffToken()` Edge Function

**Files:**
- Create: `supabase/functions/mint-staff-token/handler.ts`
- Create: `supabase/functions/mint-staff-token/handler.test.ts`
- Create: `supabase/functions/mint-staff-token/index.ts`

**Interfaces:**
- Consumes: `verifyPlatformStaffSession()` (Task 11).
- Produces: `mintStaffToken(supabase, staffId: string, platformOwner: boolean): Promise<string>` — the signed cross-project JWT string. Called by `index.ts` after verifying the caller's own `platform` session, and internally whenever another Edge Function in this plan needs to call into a module backend (e.g. Task 15's `enable-module`, which mints a `platform_owner: true` token to call `vms/backend`'s `sync-organization`). The payload carries a `staff_id` claim — the minting staff member's own `staff.id` — so a module backend can attribute a write to the actual authenticated actor (`admin_action_log.staff_id`, `applications.decided_by`, `activity_hours.verified_by`) instead of trusting whatever `staffId` a caller puts in its own request body. Before this, no claim carried a durable staff identifier at all, which is why `vms-backend`'s Edge Functions accepted `staffId` from client input in the first place — see the vms-backend plan's Task 12 (`StaffClaims.staffId`) for the consuming side.

`org_super_admin` gets every permission for every module their org has enabled, resolved directly into the token — not a bypass flag a module backend has to know about (spec §4).

- [ ] **Step 1: Write the failing test**

Create `supabase/functions/mint-staff-token/handler.test.ts`:

```typescript
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { verify } from "https://deno.land/x/djwt@v3.0.2/mod.ts";
import { mintStaffToken } from "./handler.ts";

function testClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

async function verifyKey() {
  return await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(Deno.env.get("STAFF_JWT_SECRET")!),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
}

Deno.test("mintStaffToken resolves full permissions for an org_super_admin", async () => {
  Deno.env.set("STAFF_JWT_SECRET", "test-shared-secret-32-characters!");
  const supabase = testClient();

  const { data: staff } = await supabase.from("staff").insert({
    auth_user_id: crypto.randomUUID(),
    full_name: "Super Admin Test",
    email: `super-${crypto.randomUUID()}@example.com`,
  }).select("id").single();

  const { data: org } = await supabase.from("organizations").insert({
    name: "Mint Test Org",
    slug: `mint-test-${crypto.randomUUID()}`,
  }).select("id").single();

  const { data: vmsModule } = await supabase.from("modules").select("id").eq("key", "vms").single();
  await supabase.from("org_modules").insert({ organization_id: org!.id, module_id: vmsModule!.id });
  await supabase.from("staff_org_roles").insert({ staff_id: staff!.id, organization_id: org!.id, org_tier: "super_admin" });

  const token = await mintStaffToken(supabase, staff!.id, false);
  const payload = await verify(token, await verifyKey());

  const moduleAccess = payload.module_access as Array<{ organization_id: string; module: string; permissions: string[] }>;
  const vmsAccess = moduleAccess.find((m) => m.organization_id === org!.id && m.module === "vms");

  assertEquals(payload.platform_owner, false);
  assertEquals(payload.staff_id, staff!.id);
  assertEquals(vmsAccess!.permissions.includes("applications:read"), true);
  assertEquals(vmsAccess!.permissions.includes("opportunities:delete"), true);
});

Deno.test("mintStaffToken resolves only the granted role's permissions for a regular staff member", async () => {
  Deno.env.set("STAFF_JWT_SECRET", "test-shared-secret-32-characters!");
  const supabase = testClient();

  const { data: staff } = await supabase.from("staff").insert({
    auth_user_id: crypto.randomUUID(),
    full_name: "Regular Staff Test",
    email: `regular-${crypto.randomUUID()}@example.com`,
  }).select("id").single();

  const { data: org } = await supabase.from("organizations").insert({
    name: "Mint Test Org 2",
    slug: `mint-test-2-${crypto.randomUUID()}`,
  }).select("id").single();

  const { data: vmsModule } = await supabase.from("modules").select("id").eq("key", "vms").single();
  await supabase.from("org_modules").insert({ organization_id: org!.id, module_id: vmsModule!.id });
  await supabase.rpc("seed_system_roles_for_module", { p_org_id: org!.id, p_module_id: vmsModule!.id });
  const { data: viewerRole } = await supabase.from("roles").select("id").eq("organization_id", org!.id).eq("name", "Viewer").single();
  await supabase.from("staff_module_roles").insert({
    staff_id: staff!.id,
    organization_id: org!.id,
    module_id: vmsModule!.id,
    role_id: viewerRole!.id,
  });

  const token = await mintStaffToken(supabase, staff!.id, false);
  const payload = await verify(token, await verifyKey());

  const moduleAccess = payload.module_access as Array<{ organization_id: string; module: string; permissions: string[] }>;
  const vmsAccess = moduleAccess.find((m) => m.organization_id === org!.id && m.module === "vms");

  assertEquals(payload.staff_id, staff!.id);
  assertEquals(vmsAccess!.permissions.includes("applications:read"), true);
  assertEquals(vmsAccess!.permissions.includes("applications:write"), false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd supabase && deno test --allow-net --allow-env functions/mint-staff-token/handler.test.ts`
Expected: FAIL — `handler.ts` does not exist.

- [ ] **Step 3: Write the implementation**

Create `supabase/functions/mint-staff-token/handler.ts`:

```typescript
import { SupabaseClient } from "@supabase/supabase-js";
import { create, getNumericDate } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

interface ModuleAccessEntry {
  organization_id: string;
  module: string;
  permissions: string[];
}

async function signingKey(): Promise<CryptoKey> {
  const secret = Deno.env.get("STAFF_JWT_SECRET");
  if (!secret) throw new Error("STAFF_JWT_SECRET must be set");
  return await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

export async function mintStaffToken(
  supabase: SupabaseClient,
  staffId: string,
  platformOwner: boolean,
): Promise<string> {
  const { data: orgRoleRows } = await supabase
    .from("staff_org_roles")
    .select("organization_id, org_tier")
    .eq("staff_id", staffId);

  const superAdminOrgIds = (orgRoleRows ?? [])
    .filter((r) => r.org_tier === "super_admin")
    .map((r) => r.organization_id as string);

  const { data: moduleRoleRows } = await supabase
    .from("staff_module_roles")
    .select("organization_id, module_id, role_id")
    .eq("staff_id", staffId);

  const orgIds = new Set<string>([
    ...(orgRoleRows ?? []).map((r) => r.organization_id as string),
    ...(moduleRoleRows ?? []).map((r) => r.organization_id as string),
  ]);

  const moduleAccessMap = new Map<string, ModuleAccessEntry>();

  async function moduleKeyFor(moduleId: string): Promise<string> {
    const { data } = await supabase.from("modules").select("key").eq("id", moduleId).single();
    return data!.key as string;
  }

  function addPermissions(organizationId: string, moduleKey: string, permissions: string[]) {
    const key = `${organizationId}:${moduleKey}`;
    const existing = moduleAccessMap.get(key);
    if (existing) {
      existing.permissions = Array.from(new Set([...existing.permissions, ...permissions]));
    } else {
      moduleAccessMap.set(key, { organization_id: organizationId, module: moduleKey, permissions: [...new Set(permissions)] });
    }
  }

  for (const orgId of superAdminOrgIds) {
    const { data: enabledModules } = await supabase.from("org_modules").select("module_id").eq("organization_id", orgId);
    for (const row of enabledModules ?? []) {
      const moduleKey = await moduleKeyFor(row.module_id as string);
      const { data: perms } = await supabase
        .from("permissions")
        .select("resource, action")
        .eq("module_id", row.module_id);
      addPermissions(orgId, moduleKey, (perms ?? []).map((p) => `${p.resource}:${p.action}`));
    }
  }

  for (const row of moduleRoleRows ?? []) {
    const moduleKey = await moduleKeyFor(row.module_id as string);
    const { data: rolePerms } = await supabase
      .from("role_permissions")
      .select("permissions(resource, action)")
      .eq("role_id", row.role_id);
    const permissions = (rolePerms ?? []).map((rp) => {
      const p = rp.permissions as unknown as { resource: string; action: string };
      return `${p.resource}:${p.action}`;
    });
    addPermissions(row.organization_id as string, moduleKey, permissions);
  }

  const key = await signingKey();
  return await create(
    { alg: "HS256", typ: "JWT" },
    {
      exp: getNumericDate(60 * 60),
      actor_type: "staff",
      staff_id: staffId,
      platform_owner: platformOwner,
      org_roles: Array.from(orgIds).map((organizationId) => ({ organization_id: organizationId })),
      module_access: Array.from(moduleAccessMap.values()),
    },
    key,
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx supabase db push --linked && cd supabase && deno test --allow-net --allow-env functions/mint-staff-token/handler.test.ts`
Expected: PASS on both tests.

- [ ] **Step 5: Write the HTTP wrapper**

Create `supabase/functions/mint-staff-token/index.ts`:

```typescript
import { getAdminClient } from "../_shared/supabaseAdmin.ts";
import { verifyPlatformStaffSession } from "../_shared/verifyPlatformStaffSession.ts";
import { mintStaffToken } from "./handler.ts";

Deno.serve(async (req) => {
  try {
    const supabase = getAdminClient();
    const { staffId, platformOwner } = await verifyPlatformStaffSession(supabase, req.headers.get("Authorization"));
    const token = await mintStaffToken(supabase, staffId, platformOwner);
    return new Response(JSON.stringify({ token }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    const status = message === "unauthorized" ? 401 : 400;
    return new Response(JSON.stringify({ error: message }), { status });
  }
});
```

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/mint-staff-token/
git commit -m "feat: add mint-staff-token Edge Function"
```

---

### Task 13: `create-staff` Edge Function

**Files:**
- Create: `supabase/functions/create-staff/handler.ts`
- Create: `supabase/functions/create-staff/handler.test.ts`
- Create: `supabase/functions/create-staff/index.ts`

**Interfaces:**
- Consumes: `verifyPlatformStaffSession()` (Task 11).
- Produces: `createStaff(supabase, callerStaffId: string, callerPlatformOwner: boolean, input: { fullName: string; email: string; organizationId: string }): Promise<{ staffId: string; temporaryPassword: string }>`. Throws `Error("forbidden")` if the caller is neither `platform_owner` nor `admin`/`super_admin` for `input.organizationId`.

The caller must already be `admin`/`super_admin` for the target org (or `platform_owner`) — this task does not itself grant the new staff member any org tier or module role; that's a separate step via Task 16/17 or a direct `staff_org_roles` insert done by whoever calls this, matching "staff aren't invited, they're created" without conflating creation with role assignment.

- [ ] **Step 1: Write the failing test**

Create `supabase/functions/create-staff/handler.test.ts`:

```typescript
import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { createStaff } from "./handler.ts";

function testClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

async function makeOrgAdmin(supabase: ReturnType<typeof testClient>) {
  const { data: staff } = await supabase.from("staff").insert({
    auth_user_id: crypto.randomUUID(),
    full_name: "Org Admin Test",
    email: `org-admin-${crypto.randomUUID()}@example.com`,
  }).select("id").single();

  const { data: org } = await supabase.from("organizations").insert({
    name: "Create Staff Test Org",
    slug: `create-staff-${crypto.randomUUID()}`,
  }).select("id").single();

  await supabase.from("staff_org_roles").insert({ staff_id: staff!.id, organization_id: org!.id, org_tier: "admin" });

  return { adminStaffId: staff!.id as string, orgId: org!.id as string };
}

Deno.test("createStaff creates a staff account with must_change_password set", async () => {
  const supabase = testClient();
  const { adminStaffId, orgId } = await makeOrgAdmin(supabase);

  const result = await createStaff(supabase, adminStaffId, false, {
    fullName: "New Staff",
    email: `new-staff-${crypto.randomUUID()}@example.com`,
    organizationId: orgId,
  });

  assertEquals(typeof result.staffId, "string");
  assertEquals(typeof result.temporaryPassword, "string");

  const { data: staffRow } = await supabase.from("staff").select("must_change_password").eq("id", result.staffId).single();
  assertEquals(staffRow!.must_change_password, true);
});

Deno.test("createStaff rejects a caller who is not admin/super_admin for the org", async () => {
  const supabase = testClient();
  const { data: staff } = await supabase.from("staff").insert({
    auth_user_id: crypto.randomUUID(),
    full_name: "No Authority",
    email: `no-authority-${crypto.randomUUID()}@example.com`,
  }).select("id").single();

  const { data: org } = await supabase.from("organizations").insert({
    name: "Forbidden Test Org",
    slug: `forbidden-${crypto.randomUUID()}`,
  }).select("id").single();

  await assertRejects(
    () =>
      createStaff(supabase, staff!.id, false, {
        fullName: "New Staff",
        email: `blocked-${crypto.randomUUID()}@example.com`,
        organizationId: org!.id,
      }),
    Error,
    "forbidden",
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd supabase && deno test --allow-net --allow-env functions/create-staff/handler.test.ts`
Expected: FAIL — `handler.ts` does not exist.

- [ ] **Step 3: Write the implementation**

Create `supabase/functions/create-staff/handler.ts`:

```typescript
import { SupabaseClient } from "@supabase/supabase-js";

export interface CreateStaffInput {
  fullName: string;
  email: string;
  organizationId: string;
}

export interface CreateStaffResult {
  staffId: string;
  temporaryPassword: string;
}

function generateTemporaryPassword(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
}

export async function createStaff(
  supabase: SupabaseClient,
  callerStaffId: string,
  callerPlatformOwner: boolean,
  input: CreateStaffInput,
): Promise<CreateStaffResult> {
  if (!callerPlatformOwner) {
    const { data: callerRole } = await supabase
      .from("staff_org_roles")
      .select("org_tier")
      .eq("staff_id", callerStaffId)
      .eq("organization_id", input.organizationId)
      .single();
    if (!callerRole || !["admin", "super_admin"].includes(callerRole.org_tier)) {
      throw new Error("forbidden");
    }
  }

  const temporaryPassword = generateTemporaryPassword();

  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: input.email,
    password: temporaryPassword,
    email_confirm: true,
  });
  if (authError || !authUser.user) throw authError ?? new Error("failed_to_create_auth_user");

  const { data: staff, error: staffError } = await supabase
    .from("staff")
    .insert({
      auth_user_id: authUser.user.id,
      full_name: input.fullName,
      email: input.email,
      must_change_password: true,
    })
    .select("id")
    .single();
  if (staffError) throw staffError;

  return { staffId: staff.id, temporaryPassword };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx supabase db push --linked && cd supabase && deno test --allow-net --allow-env functions/create-staff/handler.test.ts`
Expected: PASS on both tests.

- [ ] **Step 5: Write the HTTP wrapper**

Create `supabase/functions/create-staff/index.ts`:

```typescript
import { getAdminClient } from "../_shared/supabaseAdmin.ts";
import { verifyPlatformStaffSession } from "../_shared/verifyPlatformStaffSession.ts";
import { createStaff } from "./handler.ts";

Deno.serve(async (req) => {
  try {
    const supabase = getAdminClient();
    const { staffId, platformOwner } = await verifyPlatformStaffSession(supabase, req.headers.get("Authorization"));
    const input = await req.json();
    const result = await createStaff(supabase, staffId, platformOwner, input);
    return new Response(JSON.stringify(result), { status: 201, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    const status = message === "unauthorized" ? 401 : message === "forbidden" ? 403 : 400;
    return new Response(JSON.stringify({ error: message }), { status });
  }
});
```

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/create-staff/
git commit -m "feat: add create-staff Edge Function"
```

---

### Task 14: `set-password` Edge Function

**Files:**
- Create: `supabase/functions/set-password/handler.ts`
- Create: `supabase/functions/set-password/handler.test.ts`
- Create: `supabase/functions/set-password/index.ts`

**Interfaces:**
- Consumes: `verifyPlatformStaffSession()` (Task 11).
- Produces: `setPassword(supabase, staffId: string, authUserId: string, newPassword: string): Promise<{ staffId: string }>` — updates the Auth password and clears `must_change_password`. This is the forced first-login step (spec §4).

- [ ] **Step 1: Write the failing test**

Create `supabase/functions/set-password/handler.test.ts`:

```typescript
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { setPassword } from "./handler.ts";

function testClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

Deno.test("setPassword clears must_change_password", async () => {
  const supabase = testClient();
  const { data: authUser } = await supabase.auth.admin.createUser({
    email: `set-password-${crypto.randomUUID()}@example.com`,
    password: "temporary-password-1",
    email_confirm: true,
  });

  const { data: staff } = await supabase.from("staff").insert({
    auth_user_id: authUser!.user!.id,
    full_name: "Set Password Test",
    email: authUser!.user!.email,
    must_change_password: true,
  }).select("id").single();

  const result = await setPassword(supabase, staff!.id, authUser!.user!.id, "brand-new-password-2");

  assertEquals(result.staffId, staff!.id);

  const { data: updated } = await supabase.from("staff").select("must_change_password").eq("id", staff!.id).single();
  assertEquals(updated!.must_change_password, false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd supabase && deno test --allow-net --allow-env functions/set-password/handler.test.ts`
Expected: FAIL — `handler.ts` does not exist.

- [ ] **Step 3: Write the implementation**

Create `supabase/functions/set-password/handler.ts`:

```typescript
import { SupabaseClient } from "@supabase/supabase-js";

export async function setPassword(
  supabase: SupabaseClient,
  staffId: string,
  authUserId: string,
  newPassword: string,
): Promise<{ staffId: string }> {
  const { error: authError } = await supabase.auth.admin.updateUserById(authUserId, { password: newPassword });
  if (authError) throw authError;

  const { error: staffError } = await supabase
    .from("staff")
    .update({ must_change_password: false })
    .eq("id", staffId);
  if (staffError) throw staffError;

  return { staffId };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx supabase db push --linked && cd supabase && deno test --allow-net --allow-env functions/set-password/handler.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the HTTP wrapper**

Create `supabase/functions/set-password/index.ts`:

```typescript
import { getAdminClient } from "../_shared/supabaseAdmin.ts";
import { verifyPlatformStaffSession } from "../_shared/verifyPlatformStaffSession.ts";
import { setPassword } from "./handler.ts";

Deno.serve(async (req) => {
  try {
    const supabase = getAdminClient();
    const authHeader = req.headers.get("Authorization");
    const { staffId } = await verifyPlatformStaffSession(supabase, authHeader);
    const token = authHeader!.slice("Bearer ".length);
    const { data: userData } = await supabase.auth.getUser(token);
    const { newPassword } = await req.json();
    const result = await setPassword(supabase, staffId, userData.user!.id, newPassword);
    return new Response(JSON.stringify(result), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    const status = message === "unauthorized" ? 401 : 400;
    return new Response(JSON.stringify({ error: message }), { status });
  }
});
```

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/set-password/
git commit -m "feat: add set-password Edge Function for forced first-login change"
```

---

### Task 15: Organization management Edge Functions (`create-organization`, `update-organization`, `enable-module`)

**Files:**
- Create: `supabase/functions/_shared/moduleBackends.ts`
- Create: `supabase/functions/create-organization/handler.ts`
- Create: `supabase/functions/create-organization/handler.test.ts`
- Create: `supabase/functions/create-organization/index.ts`
- Create: `supabase/functions/update-organization/handler.ts`
- Create: `supabase/functions/update-organization/handler.test.ts`
- Create: `supabase/functions/update-organization/index.ts`
- Create: `supabase/functions/enable-module/handler.ts`
- Create: `supabase/functions/enable-module/handler.test.ts`
- Create: `supabase/functions/enable-module/index.ts`

**Interfaces:**
- Consumes: `verifyPlatformStaffSession()` (Task 11), `mintStaffToken()` (Task 12), `seed_system_roles_for_module()` (Task 8).
- Produces: `createOrganization()`, `updateOrganization()`, `enableModule()` — all `platform_owner`-only (spec §2). `updateOrganization()` and `enableModule()` push to the module's backend via `pushOrganizationSync()` (below) whenever the org already has that module enabled.

All three functions are bundled in one task because they share the sync-push concern and are all gated identically — a reviewer would need to see them together to confirm the push logic is consistent.

- [ ] **Step 1: Write the shared module-backend config**

Create `supabase/functions/_shared/moduleBackends.ts`:

```typescript
export function functionsUrlForModule(moduleKey: string): string | null {
  if (moduleKey === "vms") {
    return Deno.env.get("VMS_BACKEND_FUNCTIONS_URL") ?? null;
  }
  return null;
}

export async function pushOrganizationSync(
  moduleKey: string,
  staffToken: string,
  organization: { id: string; name: string; slug: string; deactivatedAt: string | null },
): Promise<void> {
  const baseUrl = functionsUrlForModule(moduleKey);
  if (!baseUrl) return;

  await fetch(`${baseUrl}/sync-organization`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${staffToken}`,
    },
    body: JSON.stringify({
      organizationId: organization.id,
      name: organization.name,
      slug: organization.slug,
      deactivatedAt: organization.deactivatedAt,
    }),
  });
}
```

- [ ] **Step 2: Write the failing test for `create-organization`**

Create `supabase/functions/create-organization/handler.test.ts`:

```typescript
import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { createOrganization } from "./handler.ts";

function testClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

Deno.test("createOrganization creates an org when the caller is platform_owner", async () => {
  const supabase = testClient();
  const result = await createOrganization(supabase, true, { name: "Rizq", slug: `rizq-${crypto.randomUUID()}` });
  assertEquals(typeof result.organizationId, "string");
});

Deno.test("createOrganization rejects a non-platform_owner caller", async () => {
  const supabase = testClient();
  await assertRejects(
    () => createOrganization(supabase, false, { name: "Blocked Org", slug: `blocked-${crypto.randomUUID()}` }),
    Error,
    "forbidden",
  );
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd supabase && deno test --allow-net --allow-env functions/create-organization/handler.test.ts`
Expected: FAIL — `handler.ts` does not exist.

- [ ] **Step 4: Write `create-organization`'s handler and wrapper**

Create `supabase/functions/create-organization/handler.ts`:

```typescript
import { SupabaseClient } from "@supabase/supabase-js";

export interface CreateOrganizationInput {
  name: string;
  slug: string;
}

export async function createOrganization(
  supabase: SupabaseClient,
  callerPlatformOwner: boolean,
  input: CreateOrganizationInput,
): Promise<{ organizationId: string }> {
  if (!callerPlatformOwner) throw new Error("forbidden");

  const { data, error } = await supabase
    .from("organizations")
    .insert({ name: input.name, slug: input.slug })
    .select("id")
    .single();
  if (error) throw error;

  return { organizationId: data.id };
}
```

Create `supabase/functions/create-organization/index.ts`:

```typescript
import { getAdminClient } from "../_shared/supabaseAdmin.ts";
import { verifyPlatformStaffSession } from "../_shared/verifyPlatformStaffSession.ts";
import { createOrganization } from "./handler.ts";

Deno.serve(async (req) => {
  try {
    const supabase = getAdminClient();
    const { platformOwner } = await verifyPlatformStaffSession(supabase, req.headers.get("Authorization"));
    const input = await req.json();
    const result = await createOrganization(supabase, platformOwner, input);
    return new Response(JSON.stringify(result), { status: 201, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    const status = message === "unauthorized" ? 401 : message === "forbidden" ? 403 : 400;
    return new Response(JSON.stringify({ error: message }), { status });
  }
});
```

- [ ] **Step 5: Run test to verify it passes, then commit**

Run: `npx supabase db push --linked && cd supabase && deno test --allow-net --allow-env functions/create-organization/handler.test.ts`
Expected: PASS on both tests.

```bash
git add supabase/functions/_shared/moduleBackends.ts supabase/functions/create-organization/
git commit -m "feat: add create-organization Edge Function"
```

- [ ] **Step 6: Write the failing test for `update-organization`**

Create `supabase/functions/update-organization/handler.test.ts`:

```typescript
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { updateOrganization } from "./handler.ts";

function testClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

Deno.test("updateOrganization renames the org and reports which modules need a re-sync", async () => {
  const supabase = testClient();
  const { data: org } = await supabase.from("organizations").insert({
    name: "Old Name",
    slug: `update-test-${crypto.randomUUID()}`,
  }).select("id").single();

  const { data: vmsModule } = await supabase.from("modules").select("id").eq("key", "vms").single();
  await supabase.from("org_modules").insert({ organization_id: org!.id, module_id: vmsModule!.id });

  const result = await updateOrganization(supabase, true, { organizationId: org!.id, name: "New Name" });

  assertEquals(result.enabledModuleKeys, ["vms"]);
  const { data: updated } = await supabase.from("organizations").select("name").eq("id", org!.id).single();
  assertEquals(updated!.name, "New Name");
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `cd supabase && deno test --allow-net --allow-env functions/update-organization/handler.test.ts`
Expected: FAIL — `handler.ts` does not exist.

- [ ] **Step 8: Write `update-organization`'s handler and wrapper**

Create `supabase/functions/update-organization/handler.ts`:

```typescript
import { SupabaseClient } from "@supabase/supabase-js";

export interface UpdateOrganizationInput {
  organizationId: string;
  name: string;
}

export async function updateOrganization(
  supabase: SupabaseClient,
  callerPlatformOwner: boolean,
  input: UpdateOrganizationInput,
): Promise<{ enabledModuleKeys: string[] }> {
  if (!callerPlatformOwner) throw new Error("forbidden");

  const { error } = await supabase.from("organizations").update({ name: input.name }).eq("id", input.organizationId);
  if (error) throw error;

  const { data: enabledModules } = await supabase
    .from("org_modules")
    .select("modules(key)")
    .eq("organization_id", input.organizationId);

  const enabledModuleKeys = (enabledModules ?? []).map((row) => (row.modules as unknown as { key: string }).key);

  return { enabledModuleKeys };
}
```

The caller of this handler (the `index.ts` wrapper) is responsible for actually pushing the sync per returned module key, using `pushOrganizationSync()` — kept out of the pure handler so the handler stays testable without a real HTTP call to a module backend.

Create `supabase/functions/update-organization/index.ts`:

```typescript
import { getAdminClient } from "../_shared/supabaseAdmin.ts";
import { verifyPlatformStaffSession } from "../_shared/verifyPlatformStaffSession.ts";
import { pushOrganizationSync } from "../_shared/moduleBackends.ts";
import { mintStaffToken } from "../mint-staff-token/handler.ts";
import { updateOrganization } from "./handler.ts";

Deno.serve(async (req) => {
  try {
    const supabase = getAdminClient();
    const { staffId, platformOwner } = await verifyPlatformStaffSession(supabase, req.headers.get("Authorization"));
    const input = await req.json();
    const result = await updateOrganization(supabase, platformOwner, input);

    const { data: org } = await supabase.from("organizations").select("id, name, slug, deactivated_at").eq("id", input.organizationId).single();
    const syncToken = await mintStaffToken(supabase, staffId, true);
    for (const moduleKey of result.enabledModuleKeys) {
      await pushOrganizationSync(moduleKey, syncToken, {
        id: org!.id,
        name: org!.name,
        slug: org!.slug,
        deactivatedAt: org!.deactivated_at,
      });
    }

    return new Response(JSON.stringify(result), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    const status = message === "unauthorized" ? 401 : message === "forbidden" ? 403 : 400;
    return new Response(JSON.stringify({ error: message }), { status });
  }
});
```

- [ ] **Step 9: Run test to verify it passes, then commit**

Run: `npx supabase db push --linked && cd supabase && deno test --allow-net --allow-env functions/update-organization/handler.test.ts`
Expected: PASS.

```bash
git add supabase/functions/update-organization/
git commit -m "feat: add update-organization Edge Function with module re-sync"
```

- [ ] **Step 10: Write the failing test for `enable-module`**

Create `supabase/functions/enable-module/handler.test.ts`:

```typescript
import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { enableModule } from "./handler.ts";

function testClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

Deno.test("enableModule enables the module and seeds system roles", async () => {
  const supabase = testClient();
  const { data: org } = await supabase.from("organizations").insert({
    name: "Enable Module Test",
    slug: `enable-module-${crypto.randomUUID()}`,
  }).select("id").single();

  const result = await enableModule(supabase, true, { organizationId: org!.id, moduleKey: "vms" });

  assertEquals(result.moduleKey, "vms");

  const { data: roles } = await supabase.from("roles").select("name").eq("organization_id", org!.id);
  assertEquals((roles ?? []).map((r) => r.name).sort(), ["Editor", "Viewer"]);
});

Deno.test("enableModule rejects a non-platform_owner caller", async () => {
  const supabase = testClient();
  const { data: org } = await supabase.from("organizations").insert({
    name: "Enable Module Forbidden Test",
    slug: `enable-module-forbidden-${crypto.randomUUID()}`,
  }).select("id").single();

  await assertRejects(
    () => enableModule(supabase, false, { organizationId: org!.id, moduleKey: "vms" }),
    Error,
    "forbidden",
  );
});
```

- [ ] **Step 11: Run test to verify it fails**

Run: `cd supabase && deno test --allow-net --allow-env functions/enable-module/handler.test.ts`
Expected: FAIL — `handler.ts` does not exist.

- [ ] **Step 12: Write `enable-module`'s handler and wrapper**

Create `supabase/functions/enable-module/handler.ts`:

```typescript
import { SupabaseClient } from "@supabase/supabase-js";

export interface EnableModuleInput {
  organizationId: string;
  moduleKey: string;
}

export async function enableModule(
  supabase: SupabaseClient,
  callerPlatformOwner: boolean,
  input: EnableModuleInput,
): Promise<{ moduleKey: string }> {
  if (!callerPlatformOwner) throw new Error("forbidden");

  const { data: moduleRow, error: moduleError } = await supabase
    .from("modules")
    .select("id")
    .eq("key", input.moduleKey)
    .single();
  if (moduleError || !moduleRow) throw new Error("unknown_module");

  const { error: orgModuleError } = await supabase
    .from("org_modules")
    .insert({ organization_id: input.organizationId, module_id: moduleRow.id });
  if (orgModuleError) throw orgModuleError;

  const { error: seedError } = await supabase.rpc("seed_system_roles_for_module", {
    p_org_id: input.organizationId,
    p_module_id: moduleRow.id,
  });
  if (seedError) throw seedError;

  return { moduleKey: input.moduleKey };
}
```

Create `supabase/functions/enable-module/index.ts`:

```typescript
import { getAdminClient } from "../_shared/supabaseAdmin.ts";
import { verifyPlatformStaffSession } from "../_shared/verifyPlatformStaffSession.ts";
import { pushOrganizationSync } from "../_shared/moduleBackends.ts";
import { mintStaffToken } from "../mint-staff-token/handler.ts";
import { enableModule } from "./handler.ts";

Deno.serve(async (req) => {
  try {
    const supabase = getAdminClient();
    const { staffId, platformOwner } = await verifyPlatformStaffSession(supabase, req.headers.get("Authorization"));
    const input = await req.json();
    const result = await enableModule(supabase, platformOwner, input);

    const { data: org } = await supabase.from("organizations").select("id, name, slug, deactivated_at").eq("id", input.organizationId).single();
    const syncToken = await mintStaffToken(supabase, staffId, true);
    await pushOrganizationSync(result.moduleKey, syncToken, {
      id: org!.id,
      name: org!.name,
      slug: org!.slug,
      deactivatedAt: org!.deactivated_at,
    });

    return new Response(JSON.stringify(result), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    const status = message === "unauthorized" ? 401 : message === "forbidden" ? 403 : 400;
    return new Response(JSON.stringify({ error: message }), { status });
  }
});
```

- [ ] **Step 13: Run test to verify it passes, then commit**

Run: `npx supabase db push --linked && cd supabase && deno test --allow-net --allow-env functions/enable-module/handler.test.ts`
Expected: PASS on both tests.

```bash
git add supabase/functions/enable-module/
git commit -m "feat: add enable-module Edge Function with system role seeding and org sync push"
```

---

### Task 16: `assign-staff-module-role` Edge Function

**Files:**
- Create: `supabase/functions/assign-staff-module-role/handler.ts`
- Create: `supabase/functions/assign-staff-module-role/handler.test.ts`
- Create: `supabase/functions/assign-staff-module-role/index.ts`

**Interfaces:**
- Produces: `assignStaffModuleRole(supabase, callerStaffId: string, callerPlatformOwner: boolean, input: { staffId: string; organizationId: string; moduleId: string; roleId: string }): Promise<{ staffId: string }>`. Throws `Error("forbidden")` unless the caller is `platform_owner` or `admin`/`super_admin` for `input.organizationId`. Throws `Error("module_not_enabled")` if the org doesn't have `moduleId` enabled — this is the "org enablement is necessary but not sufficient, and also a precondition" check (spec §2).

- [ ] **Step 1: Write the failing test**

Create `supabase/functions/assign-staff-module-role/handler.test.ts`:

```typescript
import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { assignStaffModuleRole } from "./handler.ts";

function testClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

async function setupOrgWithVms(supabase: ReturnType<typeof testClient>) {
  const { data: org } = await supabase.from("organizations").insert({
    name: "Assign Role Test Org",
    slug: `assign-role-${crypto.randomUUID()}`,
  }).select("id").single();
  const { data: vmsModule } = await supabase.from("modules").select("id").eq("key", "vms").single();
  await supabase.from("org_modules").insert({ organization_id: org!.id, module_id: vmsModule!.id });
  await supabase.rpc("seed_system_roles_for_module", { p_org_id: org!.id, p_module_id: vmsModule!.id });
  const { data: editorRole } = await supabase.from("roles").select("id").eq("organization_id", org!.id).eq("name", "Editor").single();
  return { orgId: org!.id as string, moduleId: vmsModule!.id as string, editorRoleId: editorRole!.id as string };
}

Deno.test("assignStaffModuleRole grants a role when the caller is admin", async () => {
  const supabase = testClient();
  const { orgId, moduleId, editorRoleId } = await setupOrgWithVms(supabase);

  const { data: admin } = await supabase.from("staff").insert({
    auth_user_id: crypto.randomUUID(), full_name: "Admin", email: `assign-admin-${crypto.randomUUID()}@example.com`,
  }).select("id").single();
  await supabase.from("staff_org_roles").insert({ staff_id: admin!.id, organization_id: orgId, org_tier: "admin" });

  const { data: target } = await supabase.from("staff").insert({
    auth_user_id: crypto.randomUUID(), full_name: "Target", email: `assign-target-${crypto.randomUUID()}@example.com`,
  }).select("id").single();

  const result = await assignStaffModuleRole(supabase, admin!.id, false, {
    staffId: target!.id, organizationId: orgId, moduleId, roleId: editorRoleId,
  });

  assertEquals(result.staffId, target!.id);
});

Deno.test("assignStaffModuleRole rejects assigning a role for a module the org hasn't enabled", async () => {
  const supabase = testClient();
  const { data: org } = await supabase.from("organizations").insert({
    name: "No Module Test Org",
    slug: `no-module-${crypto.randomUUID()}`,
  }).select("id").single();

  const { data: target } = await supabase.from("staff").insert({
    auth_user_id: crypto.randomUUID(), full_name: "Target", email: `no-module-target-${crypto.randomUUID()}@example.com`,
  }).select("id").single();

  const { data: vmsModule } = await supabase.from("modules").select("id").eq("key", "vms").single();

  await assertRejects(
    () => assignStaffModuleRole(supabase, target!.id, true, {
      staffId: target!.id, organizationId: org!.id, moduleId: vmsModule!.id, roleId: crypto.randomUUID(),
    }),
    Error,
    "module_not_enabled",
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd supabase && deno test --allow-net --allow-env functions/assign-staff-module-role/handler.test.ts`
Expected: FAIL — `handler.ts` does not exist.

- [ ] **Step 3: Write the implementation**

Create `supabase/functions/assign-staff-module-role/handler.ts`:

```typescript
import { SupabaseClient } from "@supabase/supabase-js";

export interface AssignStaffModuleRoleInput {
  staffId: string;
  organizationId: string;
  moduleId: string;
  roleId: string;
}

export async function assignStaffModuleRole(
  supabase: SupabaseClient,
  callerStaffId: string,
  callerPlatformOwner: boolean,
  input: AssignStaffModuleRoleInput,
): Promise<{ staffId: string }> {
  if (!callerPlatformOwner) {
    const { data: callerRole } = await supabase
      .from("staff_org_roles")
      .select("org_tier")
      .eq("staff_id", callerStaffId)
      .eq("organization_id", input.organizationId)
      .single();
    if (!callerRole || !["admin", "super_admin"].includes(callerRole.org_tier)) {
      throw new Error("forbidden");
    }
  }

  const { data: orgModule } = await supabase
    .from("org_modules")
    .select("module_id")
    .eq("organization_id", input.organizationId)
    .eq("module_id", input.moduleId)
    .single();
  if (!orgModule) throw new Error("module_not_enabled");

  const { error } = await supabase
    .from("staff_module_roles")
    .upsert({
      staff_id: input.staffId,
      organization_id: input.organizationId,
      module_id: input.moduleId,
      role_id: input.roleId,
    });
  if (error) throw error;

  return { staffId: input.staffId };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx supabase db push --linked && cd supabase && deno test --allow-net --allow-env functions/assign-staff-module-role/handler.test.ts`
Expected: PASS on both tests.

- [ ] **Step 5: Write the HTTP wrapper**

Create `supabase/functions/assign-staff-module-role/index.ts`:

```typescript
import { getAdminClient } from "../_shared/supabaseAdmin.ts";
import { verifyPlatformStaffSession } from "../_shared/verifyPlatformStaffSession.ts";
import { assignStaffModuleRole } from "./handler.ts";

Deno.serve(async (req) => {
  try {
    const supabase = getAdminClient();
    const { staffId, platformOwner } = await verifyPlatformStaffSession(supabase, req.headers.get("Authorization"));
    const input = await req.json();
    const result = await assignStaffModuleRole(supabase, staffId, platformOwner, input);
    return new Response(JSON.stringify(result), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    const status = message === "unauthorized" ? 401 : message === "forbidden" ? 403 : 400;
    return new Response(JSON.stringify({ error: message }), { status });
  }
});
```

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/assign-staff-module-role/
git commit -m "feat: add assign-staff-module-role Edge Function"
```

---

### Task 17: `create-custom-role` Edge Function

**Files:**
- Create: `supabase/functions/create-custom-role/handler.ts`
- Create: `supabase/functions/create-custom-role/handler.test.ts`
- Create: `supabase/functions/create-custom-role/index.ts`

**Interfaces:**
- Produces: `createCustomRole(supabase, callerStaffId: string, callerPlatformOwner: boolean, input: { organizationId: string; moduleId: string; name: string; permissionIds: string[] }): Promise<{ roleId: string }>`. Throws `Error("forbidden")` unless the caller is `platform_owner` or `admin`/`super_admin` for the org. Throws `Error("module_not_enabled")` if `input.organizationId` doesn't have `input.moduleId` enabled via `org_modules` — the `permissions` table (Task 6) has no `organization_id` column at all, so checking that `permissionIds` belong to `moduleId` proves nothing about whether *this org* has that module; enablement has to be checked separately against `org_modules`, the same table `assignStaffModuleRole` (Task 16) already checks. Throws `Error("permission_not_available")` if any `permissionIds` entry doesn't belong to `moduleId`, enforcing "permissions available to build a role from come from the organization's enabled modules" (spec §2) at the permission level once module enablement is confirmed.

- [ ] **Step 1: Write the failing test**

Create `supabase/functions/create-custom-role/handler.test.ts`:

```typescript
import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { createCustomRole } from "./handler.ts";

function testClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

Deno.test("createCustomRole builds a role from the module's own permissions", async () => {
  const supabase = testClient();
  const { data: org } = await supabase.from("organizations").insert({
    name: "Custom Role Test Org",
    slug: `custom-role-${crypto.randomUUID()}`,
  }).select("id").single();
  const { data: vmsModule } = await supabase.from("modules").select("id").eq("key", "vms").single();
  await supabase.from("org_modules").insert({ organization_id: org!.id, module_id: vmsModule!.id });

  const { data: admin } = await supabase.from("staff").insert({
    auth_user_id: crypto.randomUUID(), full_name: "Custom Role Admin", email: `custom-role-admin-${crypto.randomUUID()}@example.com`,
  }).select("id").single();
  await supabase.from("staff_org_roles").insert({ staff_id: admin!.id, organization_id: org!.id, org_tier: "super_admin" });

  const { data: perms } = await supabase.from("permissions").select("id").eq("module_id", vmsModule!.id).in("resource", ["hours"]).eq("action", "update");

  const result = await createCustomRole(supabase, admin!.id, false, {
    organizationId: org!.id,
    moduleId: vmsModule!.id,
    name: "Hours Verifier",
    permissionIds: perms!.map((p) => p.id),
  });

  assertEquals(typeof result.roleId, "string");
  const { data: rolePerms } = await supabase.from("role_permissions").select("permission_id").eq("role_id", result.roleId);
  assertEquals(rolePerms!.length, perms!.length);
});

Deno.test("createCustomRole rejects a permission from a different module", async () => {
  const supabase = testClient();
  const { data: org } = await supabase.from("organizations").insert({
    name: "Custom Role Reject Test Org",
    slug: `custom-role-reject-${crypto.randomUUID()}`,
  }).select("id").single();

  const { data: vmsModule } = await supabase.from("modules").select("id").eq("key", "vms").single();
  const { data: otherModule } = await supabase.from("modules").insert({ key: `other-${crypto.randomUUID()}`, display_name: "Other" }).select("id").single();
  const { data: otherPerm } = await supabase.from("permissions").insert({ module_id: otherModule!.id, resource: "widgets", action: "read" }).select("id").single();

  await supabase.from("org_modules").insert({ organization_id: org!.id, module_id: vmsModule!.id });

  await assertRejects(
    () => createCustomRole(supabase, crypto.randomUUID(), true, {
      organizationId: org!.id,
      moduleId: vmsModule!.id,
      name: "Bad Role",
      permissionIds: [otherPerm!.id],
    }),
    Error,
    "permission_not_available",
  );
});

Deno.test("createCustomRole rejects building a role for a module the org hasn't enabled", async () => {
  const supabase = testClient();
  const { data: org } = await supabase.from("organizations").insert({
    name: "Custom Role Unenabled Module Test Org",
    slug: `custom-role-unenabled-${crypto.randomUUID()}`,
  }).select("id").single();
  // Deliberately no org_modules row for this org — vms is a real, globally-readable
  // module/permission catalog, but this org was never sold/enabled for it.
  const { data: vmsModule } = await supabase.from("modules").select("id").eq("key", "vms").single();
  const { data: perms } = await supabase.from("permissions").select("id").eq("module_id", vmsModule!.id).limit(1);

  await assertRejects(
    () => createCustomRole(supabase, crypto.randomUUID(), true, {
      organizationId: org!.id,
      moduleId: vmsModule!.id,
      name: "Should Not Exist",
      permissionIds: perms!.map((p) => p.id),
    }),
    Error,
    "module_not_enabled",
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd supabase && deno test --allow-net --allow-env functions/create-custom-role/handler.test.ts`
Expected: FAIL — `handler.ts` does not exist.

- [ ] **Step 3: Write the implementation**

Create `supabase/functions/create-custom-role/handler.ts`:

```typescript
import { SupabaseClient } from "@supabase/supabase-js";

export interface CreateCustomRoleInput {
  organizationId: string;
  moduleId: string;
  name: string;
  permissionIds: string[];
}

export async function createCustomRole(
  supabase: SupabaseClient,
  callerStaffId: string,
  callerPlatformOwner: boolean,
  input: CreateCustomRoleInput,
): Promise<{ roleId: string }> {
  if (!callerPlatformOwner) {
    const { data: callerRole } = await supabase
      .from("staff_org_roles")
      .select("org_tier")
      .eq("staff_id", callerStaffId)
      .eq("organization_id", input.organizationId)
      .single();
    if (!callerRole || !["admin", "super_admin"].includes(callerRole.org_tier)) {
      throw new Error("forbidden");
    }
  }

  const { data: orgModule } = await supabase
    .from("org_modules")
    .select("module_id")
    .eq("organization_id", input.organizationId)
    .eq("module_id", input.moduleId)
    .maybeSingle();
  if (!orgModule) {
    throw new Error("module_not_enabled");
  }

  const { data: validPermissions } = await supabase
    .from("permissions")
    .select("id")
    .eq("module_id", input.moduleId)
    .in("id", input.permissionIds);

  if ((validPermissions ?? []).length !== input.permissionIds.length) {
    throw new Error("permission_not_available");
  }

  const { data: role, error: roleError } = await supabase
    .from("roles")
    .insert({ organization_id: input.organizationId, module_id: input.moduleId, name: input.name, is_system: false })
    .select("id")
    .single();
  if (roleError) throw roleError;

  const { error: rolePermsError } = await supabase
    .from("role_permissions")
    .insert(input.permissionIds.map((permissionId) => ({ role_id: role.id, permission_id: permissionId })));
  if (rolePermsError) throw rolePermsError;

  return { roleId: role.id };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx supabase db push --linked && cd supabase && deno test --allow-net --allow-env functions/create-custom-role/handler.test.ts`
Expected: PASS on all 3 tests.

- [ ] **Step 5: Write the HTTP wrapper**

Create `supabase/functions/create-custom-role/index.ts`:

```typescript
import { getAdminClient } from "../_shared/supabaseAdmin.ts";
import { verifyPlatformStaffSession } from "../_shared/verifyPlatformStaffSession.ts";
import { createCustomRole } from "./handler.ts";

Deno.serve(async (req) => {
  try {
    const supabase = getAdminClient();
    const { staffId, platformOwner } = await verifyPlatformStaffSession(supabase, req.headers.get("Authorization"));
    const input = await req.json();
    const result = await createCustomRole(supabase, staffId, platformOwner, input);
    return new Response(JSON.stringify(result), { status: 201, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    const status = message === "unauthorized" ? 401 : message === "forbidden" ? 403 : 400;
    return new Response(JSON.stringify({ error: message }), { status });
  }
});
```

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/create-custom-role/
git commit -m "feat: add create-custom-role Edge Function"
```

---

### Task 18: `deactivate-staff` Edge Function

**Files:**
- Create: `supabase/functions/deactivate-staff/handler.ts`
- Create: `supabase/functions/deactivate-staff/handler.test.ts`
- Create: `supabase/functions/deactivate-staff/index.ts`

**Interfaces:**
- Produces: `deactivateStaff(supabase, callerStaffId: string, callerPlatformOwner: boolean, targetStaffId: string): Promise<{ staffId: string }>`. Implements the Global Constraint that `org_admin` can deactivate but never remove a peer or superior: an `admin` may deactivate a staff member with no `org_tier` row (a regular staff member) in a shared org, but not another `admin` or `super_admin`; `super_admin` (or `platform_owner`) may deactivate anyone in the org. Authorization requires the caller and target to actually share an organization — the caller's own `admin`/`super_admin` role in *some* org is never sufficient on its own, since it says nothing about the target being affiliated with that org at all. A target's organization affiliation is read from both `staff_org_roles` (org-tier holders) and `staff_module_roles` (regular staff who only hold a module grant), since a staff member created via Task 13 may never receive an `staff_org_roles` row. A `platform_owner` target can only be deactivated by another `platform_owner` (i.e. `callerPlatformOwner: true`) — org-tier authority never reaches a platform-owner account, matching `org_tier` being a `platform`-internal concept unrelated to the `platform_owner` flag (spec §3).

- [ ] **Step 1: Write the failing test**

Create `supabase/functions/deactivate-staff/handler.test.ts`:

```typescript
import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { deactivateStaff } from "./handler.ts";

function testClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

async function makeOrg(supabase: ReturnType<typeof testClient>) {
  const { data: org } = await supabase.from("organizations").insert({
    name: "Deactivate Test Org",
    slug: `deactivate-${crypto.randomUUID()}`,
  }).select("id").single();
  return org!.id as string;
}

async function makeStaff(supabase: ReturnType<typeof testClient>, platformOwner = false) {
  const { data: staff } = await supabase.from("staff").insert({
    auth_user_id: crypto.randomUUID(),
    full_name: "Tier Test",
    email: `tier-${crypto.randomUUID()}@example.com`,
    platform_owner: platformOwner,
  }).select("id").single();
  return staff!.id as string;
}

async function grantOrgTier(supabase: ReturnType<typeof testClient>, staffId: string, orgId: string, orgTier: "admin" | "super_admin") {
  await supabase.from("staff_org_roles").insert({ staff_id: staffId, organization_id: orgId, org_tier: orgTier });
}

// A "regular" staff member has no staff_org_roles row at all — their only
// affiliation with an org is a module-role grant, matching the spec: "regular
// staff hold no org-management tier at all — only whatever module role(s)
// they've been granted." This is what deactivateStaff must recognize as
// "belongs to this org" for its shared-org check to mean anything.
async function grantModuleAffiliation(supabase: ReturnType<typeof testClient>, staffId: string, orgId: string) {
  const { data: vmsModule } = await supabase.from("modules").select("id").eq("key", "vms").single();
  await supabase.from("org_modules").upsert({ organization_id: orgId, module_id: vmsModule!.id });
  await supabase.rpc("seed_system_roles_for_module", { p_org_id: orgId, p_module_id: vmsModule!.id });
  const { data: viewerRole } = await supabase.from("roles").select("id").eq("organization_id", orgId).eq("name", "Viewer").single();
  await supabase.from("staff_module_roles").insert({ staff_id: staffId, organization_id: orgId, module_id: vmsModule!.id, role_id: viewerRole!.id });
}

Deno.test("deactivateStaff lets an admin deactivate a regular staff member in the same org", async () => {
  const supabase = testClient();
  const orgId = await makeOrg(supabase);
  const adminId = await makeStaff(supabase);
  await grantOrgTier(supabase, adminId, orgId, "admin");
  const regularId = await makeStaff(supabase);
  await grantModuleAffiliation(supabase, regularId, orgId);

  const result = await deactivateStaff(supabase, adminId, false, regularId);
  assertEquals(result.staffId, regularId);

  const { data } = await supabase.from("staff").select("status").eq("id", regularId).single();
  assertEquals(data!.status, "deactivated");
});

Deno.test("deactivateStaff rejects an admin deactivating another admin in the same org", async () => {
  const supabase = testClient();
  const orgId = await makeOrg(supabase);
  const adminId = await makeStaff(supabase);
  await grantOrgTier(supabase, adminId, orgId, "admin");
  const otherAdminId = await makeStaff(supabase);
  await grantOrgTier(supabase, otherAdminId, orgId, "admin");

  await assertRejects(() => deactivateStaff(supabase, adminId, false, otherAdminId), Error, "forbidden");
});

Deno.test("deactivateStaff lets a super_admin deactivate another admin in the same org", async () => {
  const supabase = testClient();
  const orgId = await makeOrg(supabase);
  const superAdminId = await makeStaff(supabase);
  await grantOrgTier(supabase, superAdminId, orgId, "super_admin");
  const adminId = await makeStaff(supabase);
  await grantOrgTier(supabase, adminId, orgId, "admin");

  const result = await deactivateStaff(supabase, superAdminId, false, adminId);
  assertEquals(result.staffId, adminId);
});

Deno.test("deactivateStaff rejects an admin deactivating a staff member who shares no organization with them", async () => {
  const supabase = testClient();
  const callerOrgId = await makeOrg(supabase);
  const targetOrgId = await makeOrg(supabase);
  const adminId = await makeStaff(supabase);
  await grantOrgTier(supabase, adminId, callerOrgId, "admin");
  const unrelatedId = await makeStaff(supabase);
  await grantModuleAffiliation(supabase, unrelatedId, targetOrgId);

  // Regression test for the bug where the handler picked the caller's first
  // staff_org_roles row and treated a target with no row *in that org* as an
  // ordinary staff member fair game for deactivation — even when the target
  // was never affiliated with that org (or any org the caller has authority
  // over) at all.
  await assertRejects(() => deactivateStaff(supabase, adminId, false, unrelatedId), Error, "forbidden");
});

Deno.test("deactivateStaff rejects an admin deactivating a platform_owner account", async () => {
  const supabase = testClient();
  const orgId = await makeOrg(supabase);
  const adminId = await makeStaff(supabase);
  await grantOrgTier(supabase, adminId, orgId, "admin");
  const ownerId = await makeStaff(supabase, true);
  await grantModuleAffiliation(supabase, ownerId, orgId);

  await assertRejects(() => deactivateStaff(supabase, adminId, false, ownerId), Error, "forbidden");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd supabase && deno test --allow-net --allow-env functions/deactivate-staff/handler.test.ts`
Expected: FAIL — `handler.ts` does not exist.

- [ ] **Step 3: Write the implementation**

Create `supabase/functions/deactivate-staff/handler.ts`:

```typescript
import { SupabaseClient } from "@supabase/supabase-js";

// Every organization the target staff member is affiliated with, mapped to
// their org_tier there (null if the only affiliation is a module-role grant,
// not a staff_org_roles row). This is deliberately the union of both tables —
// a regular staff member created via createStaff (Task 13) but never granted
// an org_tier row is still "affiliated" with an org once they hold a module
// role in it, and must remain deactivatable by that org's admin.
async function targetOrgAffiliations(
  supabase: SupabaseClient,
  targetStaffId: string,
): Promise<Map<string, string | null>> {
  const affiliations = new Map<string, string | null>();

  const { data: orgRoles } = await supabase
    .from("staff_org_roles")
    .select("organization_id, org_tier")
    .eq("staff_id", targetStaffId);
  for (const row of orgRoles ?? []) {
    affiliations.set(row.organization_id as string, row.org_tier as string);
  }

  const { data: moduleRoles } = await supabase
    .from("staff_module_roles")
    .select("organization_id")
    .eq("staff_id", targetStaffId);
  for (const row of moduleRoles ?? []) {
    if (!affiliations.has(row.organization_id as string)) {
      affiliations.set(row.organization_id as string, null);
    }
  }

  return affiliations;
}

async function callerMayDeactivate(
  supabase: SupabaseClient,
  callerStaffId: string,
  targetStaffId: string,
): Promise<boolean> {
  const { data: targetStaff } = await supabase
    .from("staff")
    .select("platform_owner")
    .eq("id", targetStaffId)
    .single();
  if (!targetStaff) throw new Error("not_found");
  // org_tier is a platform-internal concept unrelated to the platform_owner
  // flag (spec §3) — no amount of org authority reaches a platform-owner
  // account. Only another platform_owner (the callerPlatformOwner bypass
  // above) may deactivate one.
  if (targetStaff.platform_owner) {
    return false;
  }

  const targetAffiliations = await targetOrgAffiliations(supabase, targetStaffId);

  const { data: callerOrgRoles } = await supabase
    .from("staff_org_roles")
    .select("organization_id, org_tier")
    .eq("staff_id", callerStaffId)
    .in("org_tier", ["admin", "super_admin"]);

  for (const callerRole of callerOrgRoles ?? []) {
    const organizationId = callerRole.organization_id as string;
    // The caller's admin/super_admin authority in *some* org is never
    // sufficient on its own — the target must actually be affiliated with
    // that same org, or this is a cross-org authorization bypass.
    if (!targetAffiliations.has(organizationId)) continue;

    const targetTierHere = targetAffiliations.get(organizationId);
    const targetIsAdminOrAbove = targetTierHere === "admin" || targetTierHere === "super_admin";

    if (callerRole.org_tier === "super_admin") return true;
    if (callerRole.org_tier === "admin" && !targetIsAdminOrAbove) return true;
  }

  return false;
}

export async function deactivateStaff(
  supabase: SupabaseClient,
  callerStaffId: string,
  callerPlatformOwner: boolean,
  targetStaffId: string,
): Promise<{ staffId: string }> {
  if (!callerPlatformOwner) {
    const authorized = await callerMayDeactivate(supabase, callerStaffId, targetStaffId);
    if (!authorized) {
      throw new Error("forbidden");
    }
  }

  const { error } = await supabase
    .from("staff")
    .update({ status: "deactivated", deactivated_at: new Date().toISOString() })
    .eq("id", targetStaffId);
  if (error) throw error;

  return { staffId: targetStaffId };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx supabase db push --linked && cd supabase && deno test --allow-net --allow-env functions/deactivate-staff/handler.test.ts`
Expected: PASS on all 5 tests.

- [ ] **Step 5: Write the HTTP wrapper**

Create `supabase/functions/deactivate-staff/index.ts`:

```typescript
import { getAdminClient } from "../_shared/supabaseAdmin.ts";
import { verifyPlatformStaffSession } from "../_shared/verifyPlatformStaffSession.ts";
import { deactivateStaff } from "./handler.ts";

Deno.serve(async (req) => {
  try {
    const supabase = getAdminClient();
    const { staffId, platformOwner } = await verifyPlatformStaffSession(supabase, req.headers.get("Authorization"));
    const { targetStaffId } = await req.json();
    const result = await deactivateStaff(supabase, staffId, platformOwner, targetStaffId);
    return new Response(JSON.stringify(result), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    const status = message === "unauthorized" ? 401 : message === "forbidden" ? 403 : 400;
    return new Response(JSON.stringify({ error: message }), { status });
  }
});
```

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/deactivate-staff/
git commit -m "feat: add deactivate-staff Edge Function with admin/super_admin hierarchy check"
```

---

## Post-plan checklist (not a task — verify before moving to Plan 2)

- [ ] `npx supabase db push --linked && for f in supabase/tests/database/*.sql; do psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$f"; done` passes in full.
- [ ] `cd supabase && deno task test` passes in full.
- [ ] Every table listed in spec §3 exists with RLS enabled (`select relrowsecurity from pg_class where relname = '<table>';` for each).
- [ ] `STAFF_JWT_SECRET`, `VMS_BACKEND_FUNCTIONS_URL` are documented in `README.md` as required environment variables (values set per-environment, never committed), and `STAFF_JWT_SECRET`'s value matches `vms/backend`'s exactly — a mismatch here fails every cross-project call silently until checked.
- [ ] Manually mint a token for a `super_admin` staff member and verify against `vms/backend`'s `verifyStaffToken()` locally, confirming the `module_access` shape both sides agree on (this is the seam Plan 2 and `vms-backend`'s permission-check follow-up both depend on).
- [ ] The `permissions` catalog has 20 rows for `vms`, including `participation:write` (Task 6) — added specifically so `vms-backend`'s `enroll-participant` (Task 28) has a real permission to check; confirm `vms-backend`'s RLS/Edge-Function permission strings and this catalog haven't drifted apart, since nothing enforces that agreement automatically across the two repos today.
- [ ] `deactivateStaff` (Task 18) rejects a caller and target that share no organization, and rejects deactivating any `platform_owner` account from a non-`platform_owner` caller — both were silent authorization bypasses in an earlier version of this handler; re-run Task 18's full test suite specifically, not just the overall `deno task test` pass/fail.

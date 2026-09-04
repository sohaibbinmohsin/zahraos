# Team & Access — Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the platform-project schema, edge functions, and staff-token changes that back the prototype's Team & Access screen (multi-role assignments with chapter scope, invitations, an audit log), plus the one missing YR-backend read function for chapters.

**Architecture:** Approach A from the spec — the prototype's five-capability grid maps onto the existing flexible `permissions`/`roles`/`role_permissions` schema via a shared translation helper; "Granted/Read Only/Restricted" is a convention over which `(resource, action)` rows a role holds. A new `staff_role_assignments` table replaces one-row-per-module `staff_module_roles` and carries a per-assignment chapter scope. `mint-staff-token` unions each member's chapter ids into the staff JWT's `module_access` entries. Every mutation writes an `admin_audit_log` row via the service-role client.

**Tech Stack:** Supabase (hosted, no local Docker), Postgres + pgTAP tests, Deno Edge Functions with `deno test`, `@supabase/supabase-js` v2, `djwt` for the staff token.

**Spec:** `docs/superpowers/specs/2026-09-04-team-and-access-design.md`

## Global Constraints

- Runs against a **real hosted Supabase project**, no local stack. Apply migrations with `npx supabase@latest db push --linked`; run DB tests with `for f in supabase/tests/database/*.sql; do psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$f"; done`; run function tests with `cd supabase && deno task test`. Always `set -a; source .env; set +a` first.
- Migration files are **append-only** and already-applied versions are never edited (see the comment block in `0010_fix_rls_helper_functions_recursion.sql`). New migration is `0013_team_access.sql`.
- The YR module's key is `youth-republic` (renamed from `vms` by `0011_rename_vms_module_to_youth_republic.sql`). Never hardcode `vms`.
- Every new/changed edge function: `index.ts` calls `corsPreflightResponse(req)` first, then `getAdminClient()`, then `verifyPlatformStaffSession(supabase, req.headers.get("Authorization"))`, wraps the handler, and maps errors `unauthorized→401`, `forbidden→403`, else `400`. Copy the exact shape from `supabase/functions/create-staff/index.ts`.
- Authorization in every handler: `callerPlatformOwner` bypasses; otherwise the caller must hold `staff_org_roles.org_tier in ('admin','super_admin')` for the target `organizationId`. Copy the check from `create-staff/handler.ts`.
- `permissions.action` CHECK is `in ('read','write','update','delete')` — no other verbs are storable.
- Capability → permission-key map (used verbatim in Task 3 and the Task 1 seed function):
  - `drive` granted → `opportunities:write`
  - `publish` granted → `noticeboard:write`
  - `triage` granted → `applications:update` + `applications:read`; read_only → `applications:read`
  - `hours` granted → `hours:update` + `hours:read`; read_only → `hours:read`
  - `team` granted → `team:write`
  - any capability restricted → no rows for it
- Five system roles and their grids (Task 1 seed):

  | Role | drive | publish | triage | hours | team |
  |---|---|---|---|---|---|
  | Super Admin | granted | granted | granted | granted | granted |
  | Operations Lead | granted | granted | granted | granted | restricted |
  | Drive Coordinator | granted | restricted | granted | granted | restricted |
  | Application Reviewer | restricted | restricted | granted | restricted | restricted |
  | Auditor | restricted | restricted | read_only | read_only | restricted |

  Descriptions (verbatim from the prototype `ROLES` array):
  - Super Admin: `Full platform control and unconstrained administrative privileges across all operational modules.`
  - Operations Lead: `Oversees local chapter operations, drive execution, applicant selection, and field shift oversight.`
  - Drive Coordinator: `Manages on-ground drive shifts, volunteer gate attendance, and direct shift hours logging.`
  - Application Reviewer: `Screens and shortlists volunteer applicants, assesses question responses, and assigns candidate statuses.`
  - Auditor: `Read-only compliance officer auditing hours logs, certifications, and operational activity records.`
- `admin_audit_log.action` values used by this plan: `Member Invited`, `Access Changed`, `Member Removed`, `Role Created`, `Role Modified`.

---

## File Structure

**`tmp-partner-admin` (platform):**
- `supabase/migrations/0013_team_access.sql` — new: all schema, data migration, seed function.
- `supabase/tests/database/team_access_test.sql` — new: pgTAP for the migration.
- `supabase/functions/_shared/capabilityMap.ts` — new: capability grid ↔ permission keys, both directions.
- `supabase/functions/_shared/capabilityMap.test.ts` — new.
- `supabase/functions/_shared/auditLog.ts` — new: `writeAuditLog()`.
- `supabase/functions/_shared/testSupport.ts` — modify: point helpers at `staff_role_assignments` + YR system roles.
- `supabase/functions/mint-staff-token/handler.ts` — modify: read new table, emit `chapters`.
- `supabase/functions/mint-staff-token/handler.test.ts` — modify: new table, `chapters` assertions.
- `supabase/functions/invite-staff-member/{index,handler}.ts` (+ `handler.test.ts`) — new.
- `supabase/functions/update-staff-access/{index,handler}.ts` (+ `handler.test.ts`) — new.
- `supabase/functions/remove-staff-member/{index,handler}.ts` (+ `handler.test.ts`) — new.
- `supabase/functions/create-custom-role/{handler}.ts` (+ `handler.test.ts`) — modify: new input contract.
- `supabase/functions/update-custom-role/{index,handler}.ts` (+ `handler.test.ts`) — new.
- `supabase/functions/delete-custom-role/{index,handler}.ts` (+ `handler.test.ts`) — new.
- `supabase/functions/enable-module/handler.ts` — modify: branch YR seeding.
- `supabase/functions/deactivate-staff/handler.ts` + `handler.test.ts` — modify: `staff_module_roles` → `staff_role_assignments`.
- Delete: `supabase/functions/create-staff/`, `supabase/functions/assign-staff-module-role/`.

**`youth-republic/backend` (YR module):**
- `supabase/functions/list-chapters/{index,handler}.ts` (+ `handler.test.ts`) — new.

---

## Task 1: Migration `0013_team_access.sql` + pgTAP

**Files:**
- Create: `supabase/migrations/0013_team_access.sql`
- Create: `supabase/tests/database/team_access_test.sql`

**Interfaces:**
- Produces:
  - table `staff_role_assignments (id uuid, staff_id uuid, organization_id uuid, module_id uuid, role_id uuid, scope_kind text, chapter_id uuid null, scope_label text, created_at timestamptz, created_by uuid null)`
  - table `staff_invitations (id, organization_id, staff_id, email, full_name, phone, status, enforce_2fa, send_activation_email, token_hash, invited_by, invited_at, accepted_at)`
  - table `admin_audit_log (id, organization_id, actor_staff_id, actor_name, action, entity_type, entity_id, summary, scope_label, ip, created_at)`
  - column `roles.description text`
  - function `seed_youth_republic_system_roles(p_org_id uuid, p_module_id uuid) returns void`
  - `permissions` rows `noticeboard:write` and `team:write` for the `youth-republic` module
  - `staff_module_roles` is **dropped**

- [ ] **Step 1: Write the migration — extension columns, capability rows, `roles.description`**

Create `supabase/migrations/0013_team_access.sql` with:

```sql
-- 0013_team_access.sql — Team & Access: multi-role assignments with chapter
-- scope, invitations, audit log. See
-- docs/superpowers/specs/2026-09-04-team-and-access-design.md.

-- 1. roles gains a description (prototype shows it in the roles table).
alter table roles add column description text;

-- 2. staff.status gains 'invited'.
alter table staff drop constraint staff_status_check;
alter table staff add constraint staff_status_check
  check (status in ('active', 'invited', 'deactivated'));

-- 3. Two new capability permission rows for the youth-republic module.
--    opportunities:*, applications:*, hours:* already exist (0005).
insert into permissions (module_id, resource, action)
select m.id, r.resource, r.action
from modules m
cross join (values ('noticeboard', 'write'), ('team', 'write')) as r(resource, action)
where m.key = 'youth-republic'
on conflict (module_id, resource, action) do nothing;
```

- [ ] **Step 2: Add `staff_role_assignments` + RLS to the migration**

Append:

```sql
-- 4. staff_role_assignments replaces staff_module_roles: many roles per
--    member, each with an operational scope.
create table staff_role_assignments (
  id               uuid primary key default gen_random_uuid(),
  staff_id         uuid not null references staff(id) on delete cascade,
  organization_id  uuid not null references organizations(id) on delete cascade,
  module_id        uuid not null references modules(id) on delete cascade,
  role_id          uuid not null references roles(id) on delete cascade,
  scope_kind       text not null default 'org_wide' check (scope_kind in ('org_wide', 'chapter')),
  chapter_id       uuid,
  scope_label      text not null,
  created_at       timestamptz not null default now(),
  created_by       uuid references staff(id),
  constraint staff_role_assignments_scope_shape check (
    (scope_kind = 'org_wide'  and chapter_id is null) or
    (scope_kind = 'chapter'   and chapter_id is not null)
  )
);

create index staff_role_assignments_org_module_idx
  on staff_role_assignments (organization_id, module_id);
create index staff_role_assignments_staff_idx
  on staff_role_assignments (staff_id);
create unique index staff_role_assignments_unique
  on staff_role_assignments (
    staff_id, role_id,
    coalesce(chapter_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

alter table staff_role_assignments enable row level security;

create policy staff_role_assignments_select on staff_role_assignments
  for select using (
    staff_id = current_staff_id() or is_org_admin_or_above(organization_id)
  );
-- No insert/update/delete policy: writes go through service-role Edge Functions.
```

- [ ] **Step 3: Add `staff_invitations` and `admin_audit_log` to the migration**

Append:

```sql
-- 5. Invitations. An invited person is a real staff row (status='invited')
--    with real assignments, so they show in the members table immediately.
create table staff_invitations (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references organizations(id) on delete cascade,
  staff_id              uuid not null references staff(id) on delete cascade,
  email                 text not null,
  full_name             text not null,
  phone                 text,
  status                text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  enforce_2fa           boolean not null default true,
  send_activation_email boolean not null default true,
  token_hash            text,
  invited_by            uuid references staff(id),
  invited_at            timestamptz not null default now(),
  accepted_at           timestamptz
);
create index staff_invitations_org_idx on staff_invitations (organization_id);

alter table staff_invitations enable row level security;
create policy staff_invitations_select on staff_invitations
  for select using (is_org_admin_or_above(organization_id));

-- 6. Audit log. Insert is service-role only (no insert policy).
create table admin_audit_log (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  actor_staff_id   uuid references staff(id),
  actor_name       text not null,
  action           text not null,
  entity_type      text not null,
  entity_id        text,
  summary          text not null,
  scope_label      text,
  ip               text,
  created_at       timestamptz not null default now()
);
create index admin_audit_log_org_created_idx
  on admin_audit_log (organization_id, created_at desc);

alter table admin_audit_log enable row level security;
create policy admin_audit_log_select on admin_audit_log
  for select using (is_org_admin_or_above(organization_id));
```

- [ ] **Step 4: Add the YR system-role seed function to the migration**

Append:

```sql
-- 7. Youth Republic system roles: five named roles with fixed capability
--    grids, replacing the generic Viewer/Editor pair for this module.
create or replace function seed_youth_republic_system_role(
  p_org_id uuid, p_module_id uuid, p_name text, p_description text, p_perm_keys text[]
) returns void as $$
declare
  v_role_id uuid;
begin
  insert into roles (organization_id, module_id, name, is_system, description)
  values (p_org_id, p_module_id, p_name, true, p_description)
  returning id into v_role_id;

  insert into role_permissions (role_id, permission_id)
  select v_role_id, p.id
  from permissions p
  where p.module_id = p_module_id
    and (p.resource || ':' || p.action) = any (p_perm_keys);
end;
$$ language plpgsql;

create or replace function seed_youth_republic_system_roles(p_org_id uuid, p_module_id uuid)
returns void as $$
begin
  perform seed_youth_republic_system_role(p_org_id, p_module_id, 'Super Admin',
    'Full platform control and unconstrained administrative privileges across all operational modules.',
    array['opportunities:write','noticeboard:write','applications:update','applications:read','hours:update','hours:read','team:write']);
  perform seed_youth_republic_system_role(p_org_id, p_module_id, 'Operations Lead',
    'Oversees local chapter operations, drive execution, applicant selection, and field shift oversight.',
    array['opportunities:write','noticeboard:write','applications:update','applications:read','hours:update','hours:read']);
  perform seed_youth_republic_system_role(p_org_id, p_module_id, 'Drive Coordinator',
    'Manages on-ground drive shifts, volunteer gate attendance, and direct shift hours logging.',
    array['opportunities:write','applications:update','applications:read','hours:update','hours:read']);
  perform seed_youth_republic_system_role(p_org_id, p_module_id, 'Application Reviewer',
    'Screens and shortlists volunteer applicants, assesses question responses, and assigns candidate statuses.',
    array['applications:update','applications:read']);
  perform seed_youth_republic_system_role(p_org_id, p_module_id, 'Auditor',
    'Read-only compliance officer auditing hours logs, certifications, and operational activity records.',
    array['applications:read','hours:read']);
end;
$$ language plpgsql;
```

- [ ] **Step 5: Add data migration + drop `staff_module_roles` to the migration**

Append:

```sql
-- 8. Seed the five YR system roles into every org that already has the
--    youth-republic module enabled.
do $$
declare
  v_module_id uuid;
  v_org record;
begin
  select id into v_module_id from modules where key = 'youth-republic';
  for v_org in
    select organization_id from org_modules where module_id = v_module_id
  loop
    perform seed_youth_republic_system_roles(v_org.organization_id, v_module_id);
  end loop;
end $$;

-- 9. Migrate staff_module_roles -> staff_role_assignments. A row pointing at
--    the old generic Viewer/Editor system roles maps to 'Operations Lead';
--    custom-role rows keep their role_id. All become org-wide.
insert into staff_role_assignments (staff_id, organization_id, module_id, role_id, scope_kind, scope_label)
select smr.staff_id, smr.organization_id, smr.module_id,
  case
    when r.is_system and r.name in ('Viewer', 'Editor')
      then (select id from roles ro
            where ro.organization_id = smr.organization_id
              and ro.module_id = smr.module_id
              and ro.name = 'Operations Lead')
    else smr.role_id
  end,
  'org_wide', 'National / All Chapters'
from staff_module_roles smr
join roles r on r.id = smr.role_id;

-- 10. Remove the now-unreferenced generic system roles for the YR module.
delete from role_permissions rp
using roles r
where rp.role_id = r.id
  and r.is_system and r.name in ('Viewer', 'Editor')
  and r.module_id = (select id from modules where key = 'youth-republic');

delete from roles r
where r.is_system and r.name in ('Viewer', 'Editor')
  and r.module_id = (select id from modules where key = 'youth-republic')
  and not exists (select 1 from staff_role_assignments sra where sra.role_id = r.id);

-- 11. Repoint the RLS policy that referenced staff_module_roles, then drop it.
drop policy staff_org_admin_select on staff;
create policy staff_org_admin_select on staff
  for select using (
    exists (
      select 1 from staff_org_roles sor
      where sor.staff_id = staff.id and is_org_admin_or_above(sor.organization_id)
    )
    or exists (
      select 1 from staff_role_assignments sra
      where sra.staff_id = staff.id and is_org_admin_or_above(sra.organization_id)
    )
  );

drop policy staff_module_roles_select on staff_module_roles;
drop table staff_module_roles;
```

- [ ] **Step 6: Write the pgTAP test**

Create `supabase/tests/database/team_access_test.sql`:

```sql
begin;
select plan(14);

select has_table('public', 'staff_role_assignments', 'staff_role_assignments exists');
select has_table('public', 'staff_invitations', 'staff_invitations exists');
select has_table('public', 'admin_audit_log', 'admin_audit_log exists');
select has_column('public', 'roles', 'description', 'roles has description');
select hasnt_table('public', 'staff_module_roles', 'staff_module_roles is dropped');
select col_has_check('public', 'staff', 'status', 'staff.status still has a check constraint');

insert into organizations (name, slug) values ('TA Test', 'ta-test') returning id as org_id \gset
select id as module_id from modules where key = 'youth-republic' \gset
insert into org_modules (organization_id, module_id) values (:'org_id', :'module_id');

select seed_youth_republic_system_roles(:'org_id', :'module_id');

select is(
  (select count(*) from roles where organization_id = :'org_id' and module_id = :'module_id' and is_system),
  5::bigint, 'seeds five YR system roles');

select is(
  (select count(*) from role_permissions rp
     join roles r on r.id = rp.role_id
     join permissions p on p.id = rp.permission_id
   where r.organization_id = :'org_id' and r.name = 'Super Admin'
     and (p.resource || ':' || p.action) = 'team:write'),
  1::bigint, 'Super Admin holds team:write');

select is(
  (select count(*) from role_permissions rp
     join roles r on r.id = rp.role_id
     join permissions p on p.id = rp.permission_id
   where r.organization_id = :'org_id' and r.name = 'Auditor'
     and p.action in ('write', 'update')),
  0::bigint, 'Auditor holds no write/update permissions');

select is(
  (select count(*) from role_permissions rp
     join roles r on r.id = rp.role_id
     join permissions p on p.id = rp.permission_id
   where r.organization_id = :'org_id' and r.name = 'Application Reviewer'
     and (p.resource || ':' || p.action) in ('applications:update', 'applications:read')),
  2::bigint, 'Application Reviewer holds applications update+read only');

-- scope-shape CHECK
select id as super_admin_role_id from roles where organization_id = :'org_id' and name = 'Super Admin' \gset
with u as (insert into auth.users (id) values (gen_random_uuid()) returning id)
insert into staff (auth_user_id, full_name, email) select id, 'Scope Test', 'scope-test@example.com' from u
returning id as scope_staff_id \gset

select throws_ok(
  $$ insert into staff_role_assignments (staff_id, organization_id, module_id, role_id, scope_kind, chapter_id, scope_label)
     values ( (select id from staff where email = 'scope-test@example.com'),
       '$$ || :'org_id' || $$', '$$ || :'module_id' || $$', '$$ || :'super_admin_role_id' || $$',
       'chapter', null, 'Broken') $$,
  '23514', 'scope_kind=chapter requires chapter_id');

select lives_ok(
  $$ insert into staff_role_assignments (staff_id, organization_id, module_id, role_id, scope_kind, scope_label)
     values ( (select id from staff where email = 'scope-test@example.com'),
       '$$ || :'org_id' || $$', '$$ || :'module_id' || $$', '$$ || :'super_admin_role_id' || $$',
       'org_wide', 'National / All Chapters') $$,
  'org_wide assignment with null chapter_id is allowed');

select throws_ok(
  $$ insert into staff_role_assignments (staff_id, organization_id, module_id, role_id, scope_kind, scope_label)
     values ( (select id from staff where email = 'scope-test@example.com'),
       '$$ || :'org_id' || $$', '$$ || :'module_id' || $$', '$$ || :'super_admin_role_id' || $$',
       'org_wide', 'Dup') $$,
  '23505', 'duplicate (staff, role, no-chapter) assignment is rejected');

select * from finish();
rollback;
```

- [ ] **Step 7: Apply and test**

```bash
set -a; source .env; set +a
npx supabase@latest db push --linked
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/database/team_access_test.sql
```
Expected: `db push` applies `0013`; pgTAP prints `ok 1`..`ok 14` and no `not ok`.

Also re-run the pre-existing suites that touch these tables to see what breaks (fixed in Task 2/9):
```bash
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/database/roles_and_role_permissions_test.sql
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/database/staff_org_roles_test.sql
```
`roles_and_role_permissions_test.sql` uses `where key = 'vms'` and `seed_system_roles_for_module` (generic Viewer/Editor) — it still passes because that function and the generic seeding path are untouched for non-YR modules. If it fails on `key = 'vms'` returning no rows, that is a pre-existing staleness (module was renamed by `0011`); leave it — not in scope.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/0013_team_access.sql supabase/tests/database/team_access_test.sql
git commit -m "feat(db): team & access schema — assignments with scope, invitations, audit log"
```

---

## Task 2: `mint-staff-token` reads `staff_role_assignments` and emits `chapters`

**Files:**
- Modify: `supabase/functions/mint-staff-token/handler.ts`
- Modify: `supabase/functions/mint-staff-token/handler.test.ts`
- Modify: `supabase/functions/_shared/testSupport.ts:88-110` (the `enableYouthRepublicModule` / `grantModuleAffiliation` helpers)

**Interfaces:**
- Consumes: `staff_role_assignments` (Task 1).
- Produces: staff JWT `module_access[]` entries gain `chapters?: string[]` — present only when the member has **no** `org_wide` assignment for that (org, module); value is the distinct union of `chapter_id`s. `org_roles` and `permissions` semantics unchanged.

- [ ] **Step 1: Update `testSupport.ts` helpers to the new table**

In `supabase/functions/_shared/testSupport.ts`, replace `enableYouthRepublicModule` and `grantModuleAffiliation`:

```ts
export async function enableYouthRepublicModule(supabase: SupabaseClient, organizationId: string): Promise<string> {
  const { data: youthRepublicModule } = await supabase.from("modules").select("id").eq("key", "youth-republic").single();
  await supabase.from("org_modules").upsert({ organization_id: organizationId, module_id: youthRepublicModule!.id });
  await supabase.rpc("seed_youth_republic_system_roles", { p_org_id: organizationId, p_module_id: youthRepublicModule!.id });
  return youthRepublicModule!.id as string;
}

export async function grantModuleAffiliation(
  supabase: SupabaseClient,
  staffId: string,
  organizationId: string,
): Promise<void> {
  const moduleId = await enableYouthRepublicModule(supabase, organizationId);
  const { data: role } = await supabase.from("roles").select("id")
    .eq("organization_id", organizationId).eq("name", "Auditor").single();
  await supabase.from("staff_role_assignments").insert({
    staff_id: staffId,
    organization_id: organizationId,
    module_id: moduleId,
    role_id: role!.id,
    scope_kind: "org_wide",
    scope_label: "National / All Chapters",
  });
}
```

- [ ] **Step 2: Write the failing test for `chapters` in the token**

In `supabase/functions/mint-staff-token/handler.test.ts`, first update every existing `staff_module_roles` insert in this file to `staff_role_assignments` with `scope_kind: "org_wide", scope_label: "National / All Chapters"` and use a YR system role id (`Operations Lead`) instead of `Editor`/`Viewer`. Then add:

```ts
Deno.test("mintStaffToken omits chapters for an org-wide assignment and unions chapter ids otherwise", async () => {
  const supabase = testClient();
  const { data: org } = await supabase.from("organizations").insert({
    name: "Scope Token Org", slug: `scope-token-${crypto.randomUUID()}`,
  }).select("id").single();
  const { data: mod } = await supabase.from("modules").select("id").eq("key", "youth-republic").single();
  await supabase.from("org_modules").insert({ organization_id: org!.id, module_id: mod!.id });
  await supabase.rpc("seed_youth_republic_system_roles", { p_org_id: org!.id, p_module_id: mod!.id });
  const { data: opsLead } = await supabase.from("roles").select("id")
    .eq("organization_id", org!.id).eq("name", "Operations Lead").single();
  const { data: reviewer } = await supabase.from("roles").select("id")
    .eq("organization_id", org!.id).eq("name", "Application Reviewer").single();

  const email = `scope-tok-${crypto.randomUUID()}@example.com`;
  const { data: authUser } = await supabase.auth.admin.createUser({ email, email_confirm: true });
  const { data: staff } = await supabase.from("staff").insert({
    auth_user_id: authUser!.user!.id, full_name: "Scoped", email,
  }).select("id").single();

  const chapterA = crypto.randomUUID();
  const chapterB = crypto.randomUUID();
  await supabase.from("staff_role_assignments").insert([
    { staff_id: staff!.id, organization_id: org!.id, module_id: mod!.id, role_id: reviewer!.id,
      scope_kind: "chapter", chapter_id: chapterA, scope_label: "Lahore Chapter" },
    { staff_id: staff!.id, organization_id: org!.id, module_id: mod!.id, role_id: opsLead!.id,
      scope_kind: "chapter", chapter_id: chapterB, scope_label: "Karachi Chapter" },
  ]);

  const token = await mintStaffToken(supabase, staff!.id, false);
  const payload = JSON.parse(atob(token.split(".")[1]));
  const entry = payload.module_access.find((m: { module: string }) => m.module === "youth-republic");
  assertEquals([...entry.chapters].sort(), [chapterA, chapterB].sort());

  // Adding an org-wide assignment drops chapters entirely.
  await supabase.from("staff_role_assignments").insert({
    staff_id: staff!.id, organization_id: org!.id, module_id: mod!.id, role_id: opsLead!.id,
    scope_kind: "org_wide", scope_label: "National / All Chapters",
  });
  const token2 = await mintStaffToken(supabase, staff!.id, false);
  const entry2 = JSON.parse(atob(token2.split(".")[1])).module_access
    .find((m: { module: string }) => m.module === "youth-republic");
  assertEquals(entry2.chapters, undefined);
});
```

- [ ] **Step 3: Run it — expect fail**

Run: `cd supabase && deno task test --filter "mintStaffToken omits chapters"`
Expected: FAIL — `entry.chapters` is `undefined` (handler still reads `staff_module_roles`, no `chapters` emitted).

- [ ] **Step 4: Update the handler**

In `supabase/functions/mint-staff-token/handler.ts`:

Replace the `moduleRoleRows` query:
```ts
  const { data: assignmentRows } = await supabase
    .from("staff_role_assignments")
    .select("organization_id, module_id, role_id, scope_kind, chapter_id")
    .eq("staff_id", staffId);
```

Replace every later use of `moduleRoleRows` with `assignmentRows`. In the `orgIds` set builder and the `for (const row of moduleRoleRows ?? [])` permission loop, use `assignmentRows`.

Add a `chapters` accumulator keyed like `moduleAccessMap`:
```ts
  // orgId:moduleKey -> { anyOrgWide: boolean, chapters: Set<string> }
  const scopeMap = new Map<string, { anyOrgWide: boolean; chapters: Set<string> }>();
  function noteScope(orgId: string, moduleKey: string, row: { scope_kind: string; chapter_id: string | null }) {
    const key = `${orgId}:${moduleKey}`;
    const cur = scopeMap.get(key) ?? { anyOrgWide: false, chapters: new Set<string>() };
    if (row.scope_kind === "org_wide") cur.anyOrgWide = true;
    else if (row.chapter_id) cur.chapters.add(row.chapter_id);
    scopeMap.set(key, cur);
  }
```

In the assignment permission loop, after `addPermissions(...)`, call `noteScope(row.organization_id, moduleKey, row)`.

The super-admin org path grants unrestricted access — mark it org-wide:
```ts
  for (const orgId of superAdminOrgIds) {
    // ... existing enabledModules loop ...
    for (const row of enabledModules ?? []) {
      const moduleKey = await moduleKeyFor(row.module_id as string);
      // ... existing addPermissions ...
      noteScope(orgId, moduleKey, { scope_kind: "org_wide", chapter_id: null });
    }
  }
```

When building the final array, attach `chapters` only when restricted:
```ts
  const moduleAccess = Array.from(moduleAccessMap.values()).map((entry) => {
    const scope = scopeMap.get(`${entry.organization_id}:${entry.module}`);
    if (scope && !scope.anyOrgWide && scope.chapters.size > 0) {
      return { ...entry, chapters: Array.from(scope.chapters) };
    }
    return entry;
  });
```
and pass `module_access: moduleAccess` into `create(...)`.

- [ ] **Step 5: Run the full mint-staff-token suite**

Run: `cd supabase && deno task test --filter "mintStaffToken"`
Expected: all PASS, including the new test and the ones you repointed in Step 2.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/mint-staff-token/ supabase/functions/_shared/testSupport.ts
git commit -m "feat(token): read staff_role_assignments and carry chapter scope in the staff JWT"
```

---

## Task 3: `_shared/capabilityMap.ts` — capability grid ↔ permission keys

**Files:**
- Create: `supabase/functions/_shared/capabilityMap.ts`
- Create: `supabase/functions/_shared/capabilityMap.test.ts`

**Interfaces:**
- Produces:
  - `type CapabilityKey = "drive" | "publish" | "triage" | "hours" | "team"`
  - `type CapabilityLevel = "granted" | "read_only" | "restricted"`
  - `type CapabilityGrid = Record<CapabilityKey, CapabilityLevel>`
  - `const CAPABILITY_KEYS: CapabilityKey[]`
  - `function gridToPermissionKeys(grid: CapabilityGrid): string[]` — sorted, deduped `"resource:action"` list
  - `function permissionKeysToGrid(keys: string[]): CapabilityGrid` — inverse; unknown keys ignored; missing → `"restricted"`

- [ ] **Step 1: Write the failing test**

Create `supabase/functions/_shared/capabilityMap.test.ts`:

```ts
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { gridToPermissionKeys, permissionKeysToGrid, type CapabilityGrid } from "./capabilityMap.ts";

Deno.test("gridToPermissionKeys expands each level", () => {
  const grid: CapabilityGrid = {
    drive: "granted", publish: "restricted", triage: "granted", hours: "read_only", team: "granted",
  };
  assertEquals(gridToPermissionKeys(grid), [
    "applications:read", "applications:update", "hours:read", "opportunities:write", "team:write",
  ]);
});

Deno.test("permissionKeysToGrid is the inverse and defaults missing to restricted", () => {
  assertEquals(permissionKeysToGrid(["applications:read", "hours:read"]), {
    drive: "restricted", publish: "restricted", triage: "read_only", hours: "read_only", team: "restricted",
  });
  assertEquals(permissionKeysToGrid(["opportunities:write", "noticeboard:write", "applications:update", "applications:read", "hours:update", "hours:read", "team:write"]), {
    drive: "granted", publish: "granted", triage: "granted", hours: "granted", team: "granted",
  });
});

Deno.test("round-trips", () => {
  const grid: CapabilityGrid = {
    drive: "granted", publish: "granted", triage: "read_only", hours: "restricted", team: "restricted",
  };
  assertEquals(permissionKeysToGrid(gridToPermissionKeys(grid)), grid);
});
```

- [ ] **Step 2: Run it — expect fail**

Run: `cd supabase && deno task test --filter capabilityMap`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `supabase/functions/_shared/capabilityMap.ts`:

```ts
export type CapabilityKey = "drive" | "publish" | "triage" | "hours" | "team";
export type CapabilityLevel = "granted" | "read_only" | "restricted";
export type CapabilityGrid = Record<CapabilityKey, CapabilityLevel>;

export const CAPABILITY_KEYS: CapabilityKey[] = ["drive", "publish", "triage", "hours", "team"];

const RULES: Record<CapabilityKey, { granted: string[]; read_only: string[] }> = {
  drive:   { granted: ["opportunities:write"],                    read_only: [] },
  publish: { granted: ["noticeboard:write"],                      read_only: [] },
  triage:  { granted: ["applications:update", "applications:read"], read_only: ["applications:read"] },
  hours:   { granted: ["hours:update", "hours:read"],             read_only: ["hours:read"] },
  team:    { granted: ["team:write"],                             read_only: [] },
};

export function gridToPermissionKeys(grid: CapabilityGrid): string[] {
  const keys = new Set<string>();
  for (const cap of CAPABILITY_KEYS) {
    const level = grid[cap];
    if (level === "granted") RULES[cap].granted.forEach((k) => keys.add(k));
    else if (level === "read_only") RULES[cap].read_only.forEach((k) => keys.add(k));
  }
  return [...keys].sort();
}

export function permissionKeysToGrid(keys: string[]): CapabilityGrid {
  const has = (k: string) => keys.includes(k);
  const grid = {} as CapabilityGrid;
  for (const cap of CAPABILITY_KEYS) {
    if (RULES[cap].granted.every(has) && RULES[cap].granted.length > 0) grid[cap] = "granted";
    else if (RULES[cap].read_only.every(has) && RULES[cap].read_only.length > 0) grid[cap] = "read_only";
    else grid[cap] = "restricted";
  }
  return grid;
}
```

- [ ] **Step 4: Run it — expect pass**

Run: `cd supabase && deno task test --filter capabilityMap`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/capabilityMap.ts supabase/functions/_shared/capabilityMap.test.ts
git commit -m "feat(shared): capability grid <-> permission key translation"
```

---

## Task 4: `_shared/auditLog.ts` + `invite-staff-member`

**Files:**
- Create: `supabase/functions/_shared/auditLog.ts`
- Create: `supabase/functions/invite-staff-member/index.ts`
- Create: `supabase/functions/invite-staff-member/handler.ts`
- Create: `supabase/functions/invite-staff-member/handler.test.ts`
- Delete: `supabase/functions/create-staff/` (whole dir)

**Interfaces:**
- Consumes: `verifyPlatformStaffSession`, `getAdminClient`, `corsPreflightResponse`/`corsHeaders`, `staff_role_assignments`, `staff_invitations`.
- Produces:
  - `type AuditLogEntry = { organizationId: string; actorStaffId: string | null; actorName: string; action: string; entityType: string; entityId?: string | null; summary: string; scopeLabel?: string | null; ip?: string | null }`
  - `function writeAuditLog(supabase: SupabaseClient, entry: AuditLogEntry): Promise<void>`
  - `type RoleAssignmentInput = { roleId: string; scopeKind: "org_wide" | "chapter"; chapterId?: string | null; scopeLabel: string }`
  - `function inviteStaffMember(supabase, callerStaffId: string, callerPlatformOwner: boolean, input: InviteStaffMemberInput): Promise<{ staffId: string; invitationId: string }>` where `InviteStaffMemberInput = { organizationId: string; fullName: string; email: string; phone?: string; roles: RoleAssignmentInput[]; sendActivationEmail: boolean; enforce2fa: boolean }`

- [ ] **Step 1: Implement `writeAuditLog`**

Create `supabase/functions/_shared/auditLog.ts`:

```ts
import { SupabaseClient } from "@supabase/supabase-js";

export interface AuditLogEntry {
  organizationId: string;
  actorStaffId: string | null;
  actorName: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  scopeLabel?: string | null;
  ip?: string | null;
}

// Best-effort: a failed audit write must never roll back or fail the
// mutation it records. Log and move on.
export async function writeAuditLog(supabase: SupabaseClient, entry: AuditLogEntry): Promise<void> {
  const { error } = await supabase.from("admin_audit_log").insert({
    organization_id: entry.organizationId,
    actor_staff_id: entry.actorStaffId,
    actor_name: entry.actorName,
    action: entry.action,
    entity_type: entry.entityType,
    entity_id: entry.entityId ?? null,
    summary: entry.summary,
    scope_label: entry.scopeLabel ?? null,
    ip: entry.ip ?? null,
  });
  if (error) console.error("writeAuditLog failed", error);
}

export async function actorName(supabase: SupabaseClient, staffId: string): Promise<string> {
  const { data } = await supabase.from("staff").select("full_name").eq("id", staffId).single();
  return (data?.full_name as string) ?? "Unknown";
}
```

- [ ] **Step 2: Write the failing test**

Create `supabase/functions/invite-staff-member/handler.test.ts`:

```ts
import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { inviteStaffMember } from "./handler.ts";

function testClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

async function setup() {
  const supabase = testClient();
  const { data: org } = await supabase.from("organizations").insert({
    name: "Invite Test Org", slug: `invite-${crypto.randomUUID()}`,
  }).select("id").single();
  const { data: mod } = await supabase.from("modules").select("id").eq("key", "youth-republic").single();
  await supabase.from("org_modules").insert({ organization_id: org!.id, module_id: mod!.id });
  await supabase.rpc("seed_youth_republic_system_roles", { p_org_id: org!.id, p_module_id: mod!.id });
  const { data: role } = await supabase.from("roles").select("id")
    .eq("organization_id", org!.id).eq("name", "Operations Lead").single();

  const adminEmail = `invite-admin-${crypto.randomUUID()}@example.com`;
  const { data: adminAuth } = await supabase.auth.admin.createUser({ email: adminEmail, email_confirm: true });
  const { data: admin } = await supabase.from("staff").insert({
    auth_user_id: adminAuth!.user!.id, full_name: "Inviter Admin", email: adminEmail,
  }).select("id").single();
  await supabase.from("staff_org_roles").insert({ staff_id: admin!.id, organization_id: org!.id, org_tier: "admin" });

  return { supabase, orgId: org!.id as string, moduleId: mod!.id as string, roleId: role!.id as string, adminId: admin!.id as string };
}

Deno.test("inviteStaffMember creates an invited staff row, assignments, and an audit entry", async () => {
  const { supabase, orgId, roleId, adminId } = await setup();
  const email = `invitee-${crypto.randomUUID()}@example.com`;

  const result = await inviteStaffMember(supabase, adminId, false, {
    organizationId: orgId, fullName: "Newly Invited", email, phone: "0300-1234567",
    roles: [
      { roleId, scopeKind: "org_wide", scopeLabel: "National / All Chapters" },
      { roleId, scopeKind: "chapter", chapterId: crypto.randomUUID(), scopeLabel: "Lahore Chapter" },
    ],
    sendActivationEmail: true, enforce2fa: true,
  });

  const { data: staff } = await supabase.from("staff").select("status, full_name").eq("id", result.staffId).single();
  assertEquals(staff!.status, "invited");

  const { data: assigns } = await supabase.from("staff_role_assignments").select("scope_kind")
    .eq("staff_id", result.staffId);
  assertEquals(assigns!.length, 2);

  const { data: invite } = await supabase.from("staff_invitations").select("status, enforce_2fa")
    .eq("id", result.invitationId).single();
  assertEquals(invite!.status, "pending");
  assertEquals(invite!.enforce_2fa, true);

  const { data: audit } = await supabase.from("admin_audit_log").select("action, summary")
    .eq("organization_id", orgId).eq("entity_id", result.staffId).single();
  assertEquals(audit!.action, "Member Invited");
});

Deno.test("inviteStaffMember rejects a non-admin caller", async () => {
  const { supabase, orgId, roleId } = await setup();
  const outsiderEmail = `outsider-${crypto.randomUUID()}@example.com`;
  const { data: outAuth } = await supabase.auth.admin.createUser({ email: outsiderEmail, email_confirm: true });
  const { data: outsider } = await supabase.from("staff").insert({
    auth_user_id: outAuth!.user!.id, full_name: "Outsider", email: outsiderEmail,
  }).select("id").single();

  await assertRejects(
    () => inviteStaffMember(supabase, outsider!.id, false, {
      organizationId: orgId, fullName: "X", email: `x-${crypto.randomUUID()}@example.com`,
      roles: [{ roleId, scopeKind: "org_wide", scopeLabel: "National / All Chapters" }],
      sendActivationEmail: false, enforce2fa: true,
    }),
    Error, "forbidden",
  );
});
```

- [ ] **Step 3: Run it — expect fail**

Run: `cd supabase && deno task test --filter inviteStaffMember`
Expected: FAIL — `./handler.ts` has no `inviteStaffMember` export.

- [ ] **Step 4: Implement the handler**

Create `supabase/functions/invite-staff-member/handler.ts`:

```ts
import { SupabaseClient } from "@supabase/supabase-js";
import { actorName, writeAuditLog } from "../_shared/auditLog.ts";

export interface RoleAssignmentInput {
  roleId: string;
  scopeKind: "org_wide" | "chapter";
  chapterId?: string | null;
  scopeLabel: string;
}

export interface InviteStaffMemberInput {
  organizationId: string;
  fullName: string;
  email: string;
  phone?: string;
  roles: RoleAssignmentInput[];
  sendActivationEmail: boolean;
  enforce2fa: boolean;
}

async function assertCallerIsOrgAdmin(
  supabase: SupabaseClient, callerStaffId: string, callerPlatformOwner: boolean, organizationId: string,
): Promise<void> {
  if (callerPlatformOwner) return;
  const { data } = await supabase.from("staff_org_roles").select("org_tier")
    .eq("staff_id", callerStaffId).eq("organization_id", organizationId).single();
  if (!data || !["admin", "super_admin"].includes(data.org_tier)) throw new Error("forbidden");
}

function randomPassword(): string {
  return crypto.randomUUID().replace(/-/g, "") + "A1!";
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function inviteStaffMember(
  supabase: SupabaseClient,
  callerStaffId: string,
  callerPlatformOwner: boolean,
  input: InviteStaffMemberInput,
): Promise<{ staffId: string; invitationId: string }> {
  await assertCallerIsOrgAdmin(supabase, callerStaffId, callerPlatformOwner, input.organizationId);

  if (!input.fullName?.trim() || !input.email?.trim()) throw new Error("missing_fields");
  if (!input.roles?.length) throw new Error("no_roles");

  const { data: orgModule } = await supabase.from("org_modules")
    .select("module_id").eq("organization_id", input.organizationId)
    .eq("module_id", (await moduleId(supabase))).maybeSingle();
  if (!orgModule) throw new Error("module_not_enabled");
  const modId = orgModule.module_id as string;

  const roleIds = [...new Set(input.roles.map((r) => r.roleId))];
  const { data: validRoles } = await supabase.from("roles").select("id")
    .eq("organization_id", input.organizationId).eq("module_id", modId).in("id", roleIds);
  if ((validRoles ?? []).length !== roleIds.length) throw new Error("role_not_available");

  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: input.email, password: randomPassword(), email_confirm: true,
  });
  if (authError || !authUser.user) throw authError ?? new Error("failed_to_create_auth_user");

  const { data: staff, error: staffError } = await supabase.from("staff").insert({
    auth_user_id: authUser.user.id, full_name: input.fullName, email: input.email,
    status: "invited", must_change_password: true,
  }).select("id").single();
  if (staffError) throw staffError;

  const { error: assignError } = await supabase.from("staff_role_assignments").insert(
    input.roles.map((r) => ({
      staff_id: staff.id, organization_id: input.organizationId, module_id: modId, role_id: r.roleId,
      scope_kind: r.scopeKind, chapter_id: r.scopeKind === "chapter" ? r.chapterId : null,
      scope_label: r.scopeLabel, created_by: callerStaffId,
    })),
  );
  if (assignError) throw assignError;

  const token = crypto.randomUUID();
  const { data: invite, error: inviteError } = await supabase.from("staff_invitations").insert({
    organization_id: input.organizationId, staff_id: staff.id, email: input.email,
    full_name: input.fullName, phone: input.phone ?? null, enforce_2fa: input.enforce2fa,
    send_activation_email: input.sendActivationEmail, token_hash: await sha256Hex(token),
    invited_by: callerStaffId,
  }).select("id").single();
  if (inviteError) throw inviteError;

  if (input.sendActivationEmail) {
    // Phase 1 stub: platform has no email infra. The activation-email/accept
    // flow is a follow-up (spec §1 out-of-scope). Log the link so it is
    // usable in dev.
    console.log(`[invite-staff-member] activation link for ${input.email}: /set-password?invite=${token}`);
  }

  await writeAuditLog(supabase, {
    organizationId: input.organizationId,
    actorStaffId: callerStaffId,
    actorName: await actorName(supabase, callerStaffId),
    action: "Member Invited",
    entityType: "staff",
    entityId: staff.id,
    summary: `Invited ${input.fullName} (${input.roles.map((r) => `${r.scopeLabel}`).join(", ")})`,
    scopeLabel: input.roles.map((r) => r.scopeLabel).join(", "),
  });

  return { staffId: staff.id, invitationId: invite.id };
}

async function moduleId(supabase: SupabaseClient): Promise<string> {
  const { data } = await supabase.from("modules").select("id").eq("key", "youth-republic").single();
  return data!.id as string;
}
```

- [ ] **Step 5: Implement the index wrapper**

Create `supabase/functions/invite-staff-member/index.ts` — copy `create-staff/index.ts` exactly, changing the import to `inviteStaffMember` from `./handler.ts`, the call to `await inviteStaffMember(supabase, staffId, platformOwner, input)`, and keep `status: 201`.

- [ ] **Step 6: Run tests — expect pass**

Run: `cd supabase && deno task test --filter inviteStaffMember`
Expected: PASS (2 tests).

- [ ] **Step 7: Delete `create-staff`**

```bash
git rm -r supabase/functions/create-staff
```
Grep for other references: `grep -rn "create-staff" supabase/functions` → expect none (the frontend reference is handled in the frontend plan).

- [ ] **Step 8: Commit**

```bash
git add supabase/functions/_shared/auditLog.ts supabase/functions/invite-staff-member/
git commit -m "feat(fn): invite-staff-member (replaces create-staff) + shared audit log writer"
```

---

## Task 5: `update-staff-access`

**Files:**
- Create: `supabase/functions/update-staff-access/{index,handler}.ts`
- Create: `supabase/functions/update-staff-access/handler.test.ts`
- Delete: `supabase/functions/assign-staff-module-role/` (whole dir)

**Interfaces:**
- Consumes: `RoleAssignmentInput` (Task 4), `writeAuditLog`/`actorName` (Task 4).
- Produces: `function updateStaffAccess(supabase, callerStaffId, callerPlatformOwner, input: UpdateStaffAccessInput): Promise<{ staffId: string }>` where `UpdateStaffAccessInput = { staffId: string; organizationId: string; roles: RoleAssignmentInput[]; status: "active" | "invited" | "deactivated" }`. Replaces the member's entire assignment set for that (org, YR module).

- [ ] **Step 1: Write the failing test**

Create `supabase/functions/update-staff-access/handler.test.ts`:

```ts
import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { updateStaffAccess } from "./handler.ts";

function testClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

async function setup() {
  const supabase = testClient();
  const { data: org } = await supabase.from("organizations").insert({
    name: "UpdAccess Org", slug: `upd-${crypto.randomUUID()}`,
  }).select("id").single();
  const { data: mod } = await supabase.from("modules").select("id").eq("key", "youth-republic").single();
  await supabase.from("org_modules").insert({ organization_id: org!.id, module_id: mod!.id });
  await supabase.rpc("seed_youth_republic_system_roles", { p_org_id: org!.id, p_module_id: mod!.id });
  const roleByName = async (n: string) =>
    (await supabase.from("roles").select("id").eq("organization_id", org!.id).eq("name", n).single()).data!.id as string;

  const adminEmail = `upd-admin-${crypto.randomUUID()}@example.com`;
  const { data: aAuth } = await supabase.auth.admin.createUser({ email: adminEmail, email_confirm: true });
  const { data: admin } = await supabase.from("staff").insert({
    auth_user_id: aAuth!.user!.id, full_name: "Upd Admin", email: adminEmail,
  }).select("id").single();
  await supabase.from("staff_org_roles").insert({ staff_id: admin!.id, organization_id: org!.id, org_tier: "admin" });

  const memEmail = `upd-mem-${crypto.randomUUID()}@example.com`;
  const { data: mAuth } = await supabase.auth.admin.createUser({ email: memEmail, email_confirm: true });
  const { data: member } = await supabase.from("staff").insert({
    auth_user_id: mAuth!.user!.id, full_name: "Upd Member", email: memEmail, status: "active",
  }).select("id").single();
  const opsLead = await roleByName("Operations Lead");
  await supabase.from("staff_role_assignments").insert({
    staff_id: member!.id, organization_id: org!.id, module_id: mod!.id, role_id: opsLead,
    scope_kind: "org_wide", scope_label: "National / All Chapters",
  });

  return { supabase, orgId: org!.id as string, adminId: admin!.id as string, memberId: member!.id as string, roleByName };
}

Deno.test("updateStaffAccess replaces the assignment set and updates status", async () => {
  const { supabase, orgId, adminId, memberId, roleByName } = await setup();
  const reviewer = await roleByName("Application Reviewer");
  const auditor = await roleByName("Auditor");

  await updateStaffAccess(supabase, adminId, false, {
    staffId: memberId, organizationId: orgId, status: "active",
    roles: [
      { roleId: reviewer, scopeKind: "chapter", chapterId: crypto.randomUUID(), scopeLabel: "Karachi Chapter" },
      { roleId: auditor, scopeKind: "org_wide", scopeLabel: "National / All Chapters" },
    ],
  });

  const { data: rows } = await supabase.from("staff_role_assignments")
    .select("role_id, scope_kind").eq("staff_id", memberId).eq("organization_id", orgId);
  assertEquals(rows!.length, 2);
  assertEquals(new Set(rows!.map((r) => r.role_id)), new Set([reviewer, auditor]));

  const { data: audit } = await supabase.from("admin_audit_log").select("action")
    .eq("organization_id", orgId).eq("entity_id", memberId).eq("action", "Access Changed").single();
  assertEquals(audit!.action, "Access Changed");
});

Deno.test("updateStaffAccess rejects a non-admin caller", async () => {
  const { supabase, orgId, memberId, roleByName } = await setup();
  await assertRejects(
    () => updateStaffAccess(supabase, memberId, false, {
      staffId: memberId, organizationId: orgId, status: "active",
      roles: [{ roleId: await roleByName("Auditor"), scopeKind: "org_wide", scopeLabel: "National / All Chapters" }],
    }),
    Error, "forbidden",
  );
});
```

- [ ] **Step 2: Run it — expect fail**

Run: `cd supabase && deno task test --filter updateStaffAccess` → FAIL (no export).

- [ ] **Step 3: Implement the handler**

Create `supabase/functions/update-staff-access/handler.ts`:

```ts
import { SupabaseClient } from "@supabase/supabase-js";
import { actorName, writeAuditLog } from "../_shared/auditLog.ts";
import type { RoleAssignmentInput } from "../invite-staff-member/handler.ts";

export interface UpdateStaffAccessInput {
  staffId: string;
  organizationId: string;
  roles: RoleAssignmentInput[];
  status: "active" | "invited" | "deactivated";
}

export async function updateStaffAccess(
  supabase: SupabaseClient,
  callerStaffId: string,
  callerPlatformOwner: boolean,
  input: UpdateStaffAccessInput,
): Promise<{ staffId: string }> {
  if (!callerPlatformOwner) {
    const { data } = await supabase.from("staff_org_roles").select("org_tier")
      .eq("staff_id", callerStaffId).eq("organization_id", input.organizationId).single();
    if (!data || !["admin", "super_admin"].includes(data.org_tier)) throw new Error("forbidden");
  }
  if (!input.roles?.length) throw new Error("no_roles");

  const { data: mod } = await supabase.from("modules").select("id").eq("key", "youth-republic").single();
  const modId = mod!.id as string;

  const roleIds = [...new Set(input.roles.map((r) => r.roleId))];
  const { data: validRoles } = await supabase.from("roles").select("id")
    .eq("organization_id", input.organizationId).eq("module_id", modId).in("id", roleIds);
  if ((validRoles ?? []).length !== roleIds.length) throw new Error("role_not_available");

  await supabase.from("staff_role_assignments").delete()
    .eq("staff_id", input.staffId).eq("organization_id", input.organizationId).eq("module_id", modId);

  const { error: insertError } = await supabase.from("staff_role_assignments").insert(
    input.roles.map((r) => ({
      staff_id: input.staffId, organization_id: input.organizationId, module_id: modId, role_id: r.roleId,
      scope_kind: r.scopeKind, chapter_id: r.scopeKind === "chapter" ? r.chapterId : null,
      scope_label: r.scopeLabel, created_by: callerStaffId,
    })),
  );
  if (insertError) throw insertError;

  const { error: statusError } = await supabase.from("staff")
    .update({ status: input.status }).eq("id", input.staffId);
  if (statusError) throw statusError;

  const { data: target } = await supabase.from("staff").select("full_name").eq("id", input.staffId).single();
  await writeAuditLog(supabase, {
    organizationId: input.organizationId,
    actorStaffId: callerStaffId,
    actorName: await actorName(supabase, callerStaffId),
    action: "Access Changed",
    entityType: "staff",
    entityId: input.staffId,
    summary: `Updated access for ${target?.full_name ?? "member"} — ${input.roles.length} role assignment(s), status ${input.status}`,
    scopeLabel: input.roles.map((r) => r.scopeLabel).join(", "),
  });

  return { staffId: input.staffId };
}
```

- [ ] **Step 4: Implement the index wrapper**

Create `supabase/functions/update-staff-access/index.ts` — copy `assign-staff-module-role/index.ts`, swap the import/call to `updateStaffAccess`, keep `status: 200`.

- [ ] **Step 5: Run tests — expect pass**

Run: `cd supabase && deno task test --filter updateStaffAccess` → PASS (2).

- [ ] **Step 6: Delete `assign-staff-module-role`**

```bash
git rm -r supabase/functions/assign-staff-module-role
grep -rn "assign-staff-module-role" supabase/functions   # expect no matches
```

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/update-staff-access/
git commit -m "feat(fn): update-staff-access (replaces assign-staff-module-role)"
```

---

## Task 6: `remove-staff-member`

**Files:**
- Create: `supabase/functions/remove-staff-member/{index,handler}.ts`
- Create: `supabase/functions/remove-staff-member/handler.test.ts`

**Interfaces:**
- Produces: `function removeStaffMember(supabase, callerStaffId, callerPlatformOwner, input: { staffId: string; organizationId: string }): Promise<{ staffId: string }>` — deletes the member's `staff_role_assignments` for that org and sets `staff.status='deactivated'`.

- [ ] **Step 1: Write the failing test**

Create `supabase/functions/remove-staff-member/handler.test.ts`:

```ts
import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { removeStaffMember } from "./handler.ts";

function testClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

Deno.test("removeStaffMember deletes assignments, deactivates, and audits", async () => {
  const supabase = testClient();
  const { data: org } = await supabase.from("organizations").insert({
    name: "Remove Org", slug: `rm-${crypto.randomUUID()}`,
  }).select("id").single();
  const { data: mod } = await supabase.from("modules").select("id").eq("key", "youth-republic").single();
  await supabase.from("org_modules").insert({ organization_id: org!.id, module_id: mod!.id });
  await supabase.rpc("seed_youth_republic_system_roles", { p_org_id: org!.id, p_module_id: mod!.id });
  const { data: role } = await supabase.from("roles").select("id")
    .eq("organization_id", org!.id).eq("name", "Auditor").single();

  const adminEmail = `rm-admin-${crypto.randomUUID()}@example.com`;
  const { data: aAuth } = await supabase.auth.admin.createUser({ email: adminEmail, email_confirm: true });
  const { data: admin } = await supabase.from("staff").insert({
    auth_user_id: aAuth!.user!.id, full_name: "Rm Admin", email: adminEmail,
  }).select("id").single();
  await supabase.from("staff_org_roles").insert({ staff_id: admin!.id, organization_id: org!.id, org_tier: "admin" });

  const memEmail = `rm-mem-${crypto.randomUUID()}@example.com`;
  const { data: mAuth } = await supabase.auth.admin.createUser({ email: memEmail, email_confirm: true });
  const { data: member } = await supabase.from("staff").insert({
    auth_user_id: mAuth!.user!.id, full_name: "Rm Member", email: memEmail, status: "active",
  }).select("id").single();
  await supabase.from("staff_role_assignments").insert({
    staff_id: member!.id, organization_id: org!.id, module_id: mod!.id, role_id: role!.id,
    scope_kind: "org_wide", scope_label: "National / All Chapters",
  });

  await removeStaffMember(supabase, admin!.id, false, { staffId: member!.id, organizationId: org!.id });

  const { data: rows } = await supabase.from("staff_role_assignments").select("id").eq("staff_id", member!.id);
  assertEquals(rows!.length, 0);
  const { data: s } = await supabase.from("staff").select("status").eq("id", member!.id).single();
  assertEquals(s!.status, "deactivated");
  const { data: audit } = await supabase.from("admin_audit_log").select("action")
    .eq("entity_id", member!.id).eq("action", "Member Removed").single();
  assertEquals(audit!.action, "Member Removed");

  await assertRejects(
    () => removeStaffMember(supabase, member!.id, false, { staffId: admin!.id, organizationId: org!.id }),
    Error, "forbidden",
  );
});
```

- [ ] **Step 2: Run it — expect fail**

Run: `cd supabase && deno task test --filter removeStaffMember` → FAIL.

- [ ] **Step 3: Implement the handler**

Create `supabase/functions/remove-staff-member/handler.ts`:

```ts
import { SupabaseClient } from "@supabase/supabase-js";
import { actorName, writeAuditLog } from "../_shared/auditLog.ts";

export interface RemoveStaffMemberInput {
  staffId: string;
  organizationId: string;
}

export async function removeStaffMember(
  supabase: SupabaseClient,
  callerStaffId: string,
  callerPlatformOwner: boolean,
  input: RemoveStaffMemberInput,
): Promise<{ staffId: string }> {
  if (callerStaffId === input.staffId) throw new Error("forbidden");
  if (!callerPlatformOwner) {
    const { data } = await supabase.from("staff_org_roles").select("org_tier")
      .eq("staff_id", callerStaffId).eq("organization_id", input.organizationId).single();
    if (!data || !["admin", "super_admin"].includes(data.org_tier)) throw new Error("forbidden");
  }

  const { data: target } = await supabase.from("staff").select("full_name, platform_owner")
    .eq("id", input.staffId).single();
  if (!target) throw new Error("not_found");
  if (target.platform_owner) throw new Error("forbidden");

  await supabase.from("staff_role_assignments").delete()
    .eq("staff_id", input.staffId).eq("organization_id", input.organizationId);
  await supabase.from("staff").update({ status: "deactivated", deactivated_at: new Date().toISOString() })
    .eq("id", input.staffId);

  await writeAuditLog(supabase, {
    organizationId: input.organizationId,
    actorStaffId: callerStaffId,
    actorName: await actorName(supabase, callerStaffId),
    action: "Member Removed",
    entityType: "staff",
    entityId: input.staffId,
    summary: `Removed ${target.full_name} from the team`,
  });

  return { staffId: input.staffId };
}
```

- [ ] **Step 4: Implement the index wrapper**

Create `supabase/functions/remove-staff-member/index.ts` — copy `assign-staff-module-role/index.ts`, swap to `removeStaffMember`, `status: 200`.

- [ ] **Step 5: Run tests — expect pass**

Run: `cd supabase && deno task test --filter removeStaffMember` → PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/remove-staff-member/
git commit -m "feat(fn): remove-staff-member"
```

---

## Task 7: `create-custom-role` (new contract) + `update-custom-role` + `delete-custom-role`

**Files:**
- Modify: `supabase/functions/create-custom-role/handler.ts`
- Modify: `supabase/functions/create-custom-role/handler.test.ts`
- Create: `supabase/functions/update-custom-role/{index,handler}.ts` + `handler.test.ts`
- Create: `supabase/functions/delete-custom-role/{index,handler}.ts` + `handler.test.ts`

**Interfaces:**
- Consumes: `CapabilityGrid`, `gridToPermissionKeys`, `permissionKeysToGrid` (Task 3); `writeAuditLog`, `actorName` (Task 4).
- Produces:
  - `createCustomRole(supabase, callerStaffId, callerPlatformOwner, input: { organizationId: string; moduleId: string; name: string; description: string; capabilities: CapabilityGrid }): Promise<{ roleId: string }>`
  - `updateCustomRole(supabase, callerStaffId, callerPlatformOwner, input: { roleId: string; name: string; description: string; capabilities: CapabilityGrid }): Promise<{ roleId: string }>`
  - `deleteCustomRole(supabase, callerStaffId, callerPlatformOwner, input: { roleId: string }): Promise<{ roleId: string }>`

- [ ] **Step 1: Rewrite `create-custom-role/handler.test.ts`**

Replace the file contents:

```ts
import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { createCustomRole } from "./handler.ts";
import { permissionKeysToGrid } from "../_shared/capabilityMap.ts";

function testClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

async function setup() {
  const supabase = testClient();
  const { data: org } = await supabase.from("organizations").insert({
    name: "CCR Org", slug: `ccr-${crypto.randomUUID()}`,
  }).select("id").single();
  const { data: mod } = await supabase.from("modules").select("id").eq("key", "youth-republic").single();
  await supabase.from("org_modules").insert({ organization_id: org!.id, module_id: mod!.id });
  await supabase.rpc("seed_youth_republic_system_roles", { p_org_id: org!.id, p_module_id: mod!.id });

  const adminEmail = `ccr-admin-${crypto.randomUUID()}@example.com`;
  const { data: aAuth } = await supabase.auth.admin.createUser({ email: adminEmail, email_confirm: true });
  const { data: admin } = await supabase.from("staff").insert({
    auth_user_id: aAuth!.user!.id, full_name: "CCR Admin", email: adminEmail,
  }).select("id").single();
  await supabase.from("staff_org_roles").insert({ staff_id: admin!.id, organization_id: org!.id, org_tier: "admin" });
  return { supabase, orgId: org!.id as string, moduleId: mod!.id as string, adminId: admin!.id as string };
}

Deno.test("createCustomRole stores the capability grid as role_permissions rows", async () => {
  const { supabase, orgId, moduleId, adminId } = await setup();
  const result = await createCustomRole(supabase, adminId, false, {
    organizationId: orgId, moduleId, name: "Regional Logistics Lead",
    description: "Coordinates warehouse inventory and regional dispatch.",
    capabilities: { drive: "granted", publish: "restricted", triage: "restricted", hours: "granted", team: "restricted" },
  });

  const { data: role } = await supabase.from("roles")
    .select("is_system, description").eq("id", result.roleId).single();
  assertEquals(role!.is_system, false);
  assertEquals(role!.description, "Coordinates warehouse inventory and regional dispatch.");

  const { data: perms } = await supabase.from("role_permissions")
    .select("permissions(resource, action)").eq("role_id", result.roleId);
  const keys = (perms ?? []).map((p: { permissions: { resource: string; action: string } }) =>
    `${p.permissions.resource}:${p.permissions.action}`).sort();
  assertEquals(keys, ["hours:read", "hours:update", "opportunities:write"]);
  assertEquals(permissionKeysToGrid(keys).hours, "granted");
});

Deno.test("createCustomRole rejects a non-admin caller", async () => {
  const { supabase, orgId, moduleId } = await setup();
  const outEmail = `ccr-out-${crypto.randomUUID()}@example.com`;
  const { data: oAuth } = await supabase.auth.admin.createUser({ email: outEmail, email_confirm: true });
  const { data: outsider } = await supabase.from("staff").insert({
    auth_user_id: oAuth!.user!.id, full_name: "Out", email: outEmail,
  }).select("id").single();
  await assertRejects(
    () => createCustomRole(supabase, outsider!.id, false, {
      organizationId: orgId, moduleId, name: "X", description: "",
      capabilities: { drive: "restricted", publish: "restricted", triage: "restricted", hours: "restricted", team: "restricted" },
    }),
    Error, "forbidden",
  );
});
```

- [ ] **Step 2: Run it — expect fail**

Run: `cd supabase && deno task test --filter createCustomRole` → FAIL (old handler expects `permissionIds`).

- [ ] **Step 3: Rewrite `create-custom-role/handler.ts`**

```ts
import { SupabaseClient } from "@supabase/supabase-js";
import { type CapabilityGrid, gridToPermissionKeys } from "../_shared/capabilityMap.ts";
import { actorName, writeAuditLog } from "../_shared/auditLog.ts";

export interface CreateCustomRoleInput {
  organizationId: string;
  moduleId: string;
  name: string;
  description: string;
  capabilities: CapabilityGrid;
}

async function assertCallerIsOrgAdmin(
  supabase: SupabaseClient, callerStaffId: string, callerPlatformOwner: boolean, organizationId: string,
): Promise<void> {
  if (callerPlatformOwner) return;
  const { data } = await supabase.from("staff_org_roles").select("org_tier")
    .eq("staff_id", callerStaffId).eq("organization_id", organizationId).single();
  if (!data || !["admin", "super_admin"].includes(data.org_tier)) throw new Error("forbidden");
}

async function permissionIdsForKeys(
  supabase: SupabaseClient, moduleId: string, keys: string[],
): Promise<string[]> {
  if (keys.length === 0) return [];
  const { data } = await supabase.from("permissions").select("id, resource, action").eq("module_id", moduleId);
  const byKey = new Map((data ?? []).map((p) => [`${p.resource}:${p.action}`, p.id as string]));
  const ids = keys.map((k) => byKey.get(k));
  if (ids.some((id) => !id)) throw new Error("permission_not_available");
  return ids as string[];
}

export async function createCustomRole(
  supabase: SupabaseClient,
  callerStaffId: string,
  callerPlatformOwner: boolean,
  input: CreateCustomRoleInput,
): Promise<{ roleId: string }> {
  await assertCallerIsOrgAdmin(supabase, callerStaffId, callerPlatformOwner, input.organizationId);
  if (!input.name?.trim()) throw new Error("missing_name");

  const { data: orgModule } = await supabase.from("org_modules").select("module_id")
    .eq("organization_id", input.organizationId).eq("module_id", input.moduleId).maybeSingle();
  if (!orgModule) throw new Error("module_not_enabled");

  const permissionIds = await permissionIdsForKeys(
    supabase, input.moduleId, gridToPermissionKeys(input.capabilities),
  );

  const { data: role, error: roleError } = await supabase.from("roles")
    .insert({
      organization_id: input.organizationId, module_id: input.moduleId,
      name: input.name.trim(), description: input.description || null, is_system: false,
    })
    .select("id").single();
  if (roleError) throw roleError;

  if (permissionIds.length > 0) {
    const { error } = await supabase.from("role_permissions")
      .insert(permissionIds.map((permission_id) => ({ role_id: role.id, permission_id })));
    if (error) throw error;
  }

  await writeAuditLog(supabase, {
    organizationId: input.organizationId,
    actorStaffId: callerStaffId,
    actorName: await actorName(supabase, callerStaffId),
    action: "Role Created",
    entityType: "role",
    entityId: role.id,
    summary: `Created custom role '${input.name.trim()}'`,
  });

  return { roleId: role.id };
}
```

- [ ] **Step 4: Run it — expect pass**

Run: `cd supabase && deno task test --filter createCustomRole` → PASS (2).

- [ ] **Step 5: Write the `update-custom-role` failing test**

Create `supabase/functions/update-custom-role/handler.test.ts`:

```ts
import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { createCustomRole } from "../create-custom-role/handler.ts";
import { updateCustomRole } from "./handler.ts";

function testClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}
async function setup() {
  const supabase = testClient();
  const { data: org } = await supabase.from("organizations").insert({
    name: "UCR Org", slug: `ucr-${crypto.randomUUID()}`,
  }).select("id").single();
  const { data: mod } = await supabase.from("modules").select("id").eq("key", "youth-republic").single();
  await supabase.from("org_modules").insert({ organization_id: org!.id, module_id: mod!.id });
  await supabase.rpc("seed_youth_republic_system_roles", { p_org_id: org!.id, p_module_id: mod!.id });
  const adminEmail = `ucr-admin-${crypto.randomUUID()}@example.com`;
  const { data: aAuth } = await supabase.auth.admin.createUser({ email: adminEmail, email_confirm: true });
  const { data: admin } = await supabase.from("staff").insert({
    auth_user_id: aAuth!.user!.id, full_name: "UCR Admin", email: adminEmail,
  }).select("id").single();
  await supabase.from("staff_org_roles").insert({ staff_id: admin!.id, organization_id: org!.id, org_tier: "admin" });
  return { supabase, orgId: org!.id as string, moduleId: mod!.id as string, adminId: admin!.id as string };
}

Deno.test("updateCustomRole rewrites permissions and rejects system roles", async () => {
  const { supabase, orgId, moduleId, adminId } = await setup();
  const { roleId } = await createCustomRole(supabase, adminId, false, {
    organizationId: orgId, moduleId, name: "Editable", description: "v1",
    capabilities: { drive: "granted", publish: "restricted", triage: "restricted", hours: "restricted", team: "restricted" },
  });

  await updateCustomRole(supabase, adminId, false, {
    roleId, name: "Editable v2", description: "v2",
    capabilities: { drive: "restricted", publish: "restricted", triage: "granted", hours: "read_only", team: "restricted" },
  });

  const { data: role } = await supabase.from("roles").select("name, description").eq("id", roleId).single();
  assertEquals(role!.name, "Editable v2");
  const { data: perms } = await supabase.from("role_permissions")
    .select("permissions(resource, action)").eq("role_id", roleId);
  const keys = (perms ?? []).map((p: { permissions: { resource: string; action: string } }) =>
    `${p.permissions.resource}:${p.permissions.action}`).sort();
  assertEquals(keys, ["applications:read", "applications:update", "hours:read"]);

  const { data: sysRole } = await supabase.from("roles").select("id")
    .eq("organization_id", orgId).eq("name", "Auditor").single();
  await assertRejects(
    () => updateCustomRole(supabase, adminId, false, {
      roleId: sysRole!.id, name: "Hacked", description: "",
      capabilities: { drive: "granted", publish: "granted", triage: "granted", hours: "granted", team: "granted" },
    }),
    Error, "system_role_immutable",
  );
});
```

- [ ] **Step 6: Run it — expect fail; then implement `update-custom-role/handler.ts`**

```ts
import { SupabaseClient } from "@supabase/supabase-js";
import { type CapabilityGrid, gridToPermissionKeys } from "../_shared/capabilityMap.ts";
import { actorName, writeAuditLog } from "../_shared/auditLog.ts";

export interface UpdateCustomRoleInput {
  roleId: string;
  name: string;
  description: string;
  capabilities: CapabilityGrid;
}

export async function updateCustomRole(
  supabase: SupabaseClient,
  callerStaffId: string,
  callerPlatformOwner: boolean,
  input: UpdateCustomRoleInput,
): Promise<{ roleId: string }> {
  const { data: role } = await supabase.from("roles")
    .select("id, organization_id, module_id, is_system").eq("id", input.roleId).single();
  if (!role) throw new Error("not_found");
  if (role.is_system) throw new Error("system_role_immutable");

  if (!callerPlatformOwner) {
    const { data } = await supabase.from("staff_org_roles").select("org_tier")
      .eq("staff_id", callerStaffId).eq("organization_id", role.organization_id).single();
    if (!data || !["admin", "super_admin"].includes(data.org_tier)) throw new Error("forbidden");
  }
  if (!input.name?.trim()) throw new Error("missing_name");

  const keys = gridToPermissionKeys(input.capabilities);
  const { data: perms } = await supabase.from("permissions").select("id, resource, action")
    .eq("module_id", role.module_id);
  const byKey = new Map((perms ?? []).map((p) => [`${p.resource}:${p.action}`, p.id as string]));
  const permissionIds = keys.map((k) => byKey.get(k));
  if (permissionIds.some((id) => !id)) throw new Error("permission_not_available");

  await supabase.from("roles").update({
    name: input.name.trim(), description: input.description || null,
  }).eq("id", input.roleId);

  await supabase.from("role_permissions").delete().eq("role_id", input.roleId);
  if (permissionIds.length > 0) {
    const { error } = await supabase.from("role_permissions")
      .insert((permissionIds as string[]).map((permission_id) => ({ role_id: input.roleId, permission_id })));
    if (error) throw error;
  }

  await writeAuditLog(supabase, {
    organizationId: role.organization_id,
    actorStaffId: callerStaffId,
    actorName: await actorName(supabase, callerStaffId),
    action: "Role Modified",
    entityType: "role",
    entityId: input.roleId,
    summary: `Updated custom role permissions for '${input.name.trim()}'`,
  });

  return { roleId: input.roleId };
}
```

Create `supabase/functions/update-custom-role/index.ts` — copy `create-custom-role/index.ts`, swap to `updateCustomRole`, `status: 200`.

- [ ] **Step 7: Write + run the `delete-custom-role` failing test, then implement**

Create `supabase/functions/delete-custom-role/handler.test.ts`:

```ts
import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { createCustomRole } from "../create-custom-role/handler.ts";
import { deleteCustomRole } from "./handler.ts";

function testClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

Deno.test("deleteCustomRole removes an unassigned custom role but blocks an assigned one and system roles", async () => {
  const supabase = testClient();
  const { data: org } = await supabase.from("organizations").insert({
    name: "DCR Org", slug: `dcr-${crypto.randomUUID()}`,
  }).select("id").single();
  const { data: mod } = await supabase.from("modules").select("id").eq("key", "youth-republic").single();
  await supabase.from("org_modules").insert({ organization_id: org!.id, module_id: mod!.id });
  await supabase.rpc("seed_youth_republic_system_roles", { p_org_id: org!.id, p_module_id: mod!.id });
  const adminEmail = `dcr-admin-${crypto.randomUUID()}@example.com`;
  const { data: aAuth } = await supabase.auth.admin.createUser({ email: adminEmail, email_confirm: true });
  const { data: admin } = await supabase.from("staff").insert({
    auth_user_id: aAuth!.user!.id, full_name: "DCR Admin", email: adminEmail,
  }).select("id").single();
  await supabase.from("staff_org_roles").insert({ staff_id: admin!.id, organization_id: org!.id, org_tier: "admin" });

  const { roleId } = await createCustomRole(supabase, admin!.id, false, {
    organizationId: org!.id, moduleId: mod!.id, name: "Disposable", description: "",
    capabilities: { drive: "restricted", publish: "restricted", triage: "restricted", hours: "restricted", team: "restricted" },
  });
  const res = await deleteCustomRole(supabase, admin!.id, false, { roleId });
  assertEquals(res.roleId, roleId);
  const { data: gone } = await supabase.from("roles").select("id").eq("id", roleId).maybeSingle();
  assertEquals(gone, null);

  const { data: sysRole } = await supabase.from("roles").select("id")
    .eq("organization_id", org!.id).eq("name", "Auditor").single();
  await assertRejects(() => deleteCustomRole(supabase, admin!.id, false, { roleId: sysRole!.id }), Error, "system_role_immutable");

  const { roleId: assignedRoleId } = await createCustomRole(supabase, admin!.id, false, {
    organizationId: org!.id, moduleId: mod!.id, name: "InUse", description: "",
    capabilities: { drive: "granted", publish: "restricted", triage: "restricted", hours: "restricted", team: "restricted" },
  });
  const memEmail = `dcr-mem-${crypto.randomUUID()}@example.com`;
  const { data: mAuth } = await supabase.auth.admin.createUser({ email: memEmail, email_confirm: true });
  const { data: member } = await supabase.from("staff").insert({
    auth_user_id: mAuth!.user!.id, full_name: "Mem", email: memEmail,
  }).select("id").single();
  await supabase.from("staff_role_assignments").insert({
    staff_id: member!.id, organization_id: org!.id, module_id: mod!.id, role_id: assignedRoleId,
    scope_kind: "org_wide", scope_label: "National / All Chapters",
  });
  await assertRejects(() => deleteCustomRole(supabase, admin!.id, false, { roleId: assignedRoleId }), Error, "role_in_use");
});
```

Then `supabase/functions/delete-custom-role/handler.ts`:

```ts
import { SupabaseClient } from "@supabase/supabase-js";
import { actorName, writeAuditLog } from "../_shared/auditLog.ts";

export interface DeleteCustomRoleInput {
  roleId: string;
}

export async function deleteCustomRole(
  supabase: SupabaseClient,
  callerStaffId: string,
  callerPlatformOwner: boolean,
  input: DeleteCustomRoleInput,
): Promise<{ roleId: string }> {
  const { data: role } = await supabase.from("roles")
    .select("id, organization_id, name, is_system").eq("id", input.roleId).single();
  if (!role) throw new Error("not_found");
  if (role.is_system) throw new Error("system_role_immutable");

  if (!callerPlatformOwner) {
    const { data } = await supabase.from("staff_org_roles").select("org_tier")
      .eq("staff_id", callerStaffId).eq("organization_id", role.organization_id).single();
    if (!data || !["admin", "super_admin"].includes(data.org_tier)) throw new Error("forbidden");
  }

  const { count } = await supabase.from("staff_role_assignments")
    .select("*", { count: "exact", head: true }).eq("role_id", input.roleId);
  if ((count ?? 0) > 0) throw new Error("role_in_use");

  await supabase.from("role_permissions").delete().eq("role_id", input.roleId);
  await supabase.from("roles").delete().eq("id", input.roleId);

  await writeAuditLog(supabase, {
    organizationId: role.organization_id,
    actorStaffId: callerStaffId,
    actorName: await actorName(supabase, callerStaffId),
    action: "Role Modified",
    entityType: "role",
    entityId: input.roleId,
    summary: `Deleted custom role '${role.name}'`,
  });

  return { roleId: input.roleId };
}
```

Create `supabase/functions/delete-custom-role/index.ts` — copy `create-custom-role/index.ts`, swap to `deleteCustomRole`, `status: 200`.

- [ ] **Step 8: Run all three suites — expect pass**

Run: `cd supabase && deno task test --filter "CustomRole"`
Expected: PASS across create/update/delete.

- [ ] **Step 9: Commit**

```bash
git add supabase/functions/create-custom-role/ supabase/functions/update-custom-role/ supabase/functions/delete-custom-role/
git commit -m "feat(fn): capability-grid role create/update/delete with audit"
```

---

## Task 8: Ripple fixes — `enable-module`, `deactivate-staff`

**Files:**
- Modify: `supabase/functions/enable-module/handler.ts`
- Modify: `supabase/functions/deactivate-staff/handler.ts:20-33` (the `targetOrgAffiliations` function)
- Modify: `supabase/functions/deactivate-staff/handler.test.ts`

**Interfaces:**
- Consumes: `seed_youth_republic_system_roles` RPC (Task 1), `staff_role_assignments` (Task 1).

- [ ] **Step 1: Branch the seeding in `enable-module/handler.ts`**

Replace the `seed_system_roles_for_module` RPC call:

```ts
  const seedFn = input.moduleKey === "youth-republic"
    ? "seed_youth_republic_system_roles"
    : "seed_system_roles_for_module";
  const { error: seedError } = await supabase.rpc(seedFn, {
    p_org_id: input.organizationId,
    p_module_id: moduleRow.id,
  });
  if (seedError) throw seedError;
```

- [ ] **Step 2: Update `enable-module/handler.test.ts`**

Wherever the test asserts `Viewer`/`Editor` were seeded for the YR module, change the expectation to the five YR system roles: `assertEquals(new Set(roleNames), new Set(["Super Admin", "Operations Lead", "Drive Coordinator", "Application Reviewer", "Auditor"]))`. If the test uses a non-YR module key, leave it. Run `cd supabase && deno task test --filter enableModule` and adjust assertions until green.

- [ ] **Step 3: Repoint `deactivate-staff` to `staff_role_assignments`**

In `supabase/functions/deactivate-staff/handler.ts`, in `targetOrgAffiliations`, replace the `staff_module_roles` query:

```ts
  const { data: moduleRoles } = await supabase
    .from("staff_role_assignments")
    .select("organization_id")
    .eq("staff_id", targetStaffId);
```

- [ ] **Step 4: Update `deactivate-staff/handler.test.ts`**

Replace every `staff_module_roles` insert in this file with a `staff_role_assignments` insert: add `scope_kind: "org_wide", scope_label: "National / All Chapters"` and use a seeded YR role id (query `roles` by `name = 'Auditor'` for that org) instead of a Viewer/Editor role. Where the test calls `seed_system_roles_for_module` for a YR org, change to `seed_youth_republic_system_roles`.

- [ ] **Step 5: Run the affected suites**

Run: `cd supabase && deno task test --filter "deactivateStaff"` and `--filter "enableModule"` → PASS.

- [ ] **Step 6: Full function test sweep**

Run: `cd supabase && deno task test`
Expected: all green. If a still-failing suite references `staff_module_roles`, `create-staff`, `assign-staff-module-role`, `Viewer`, or `Editor` for the YR module, fix it the same way (table swap, function swap, role-name swap). Re-run until clean.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/enable-module/ supabase/functions/deactivate-staff/
git commit -m "fix(fn): repoint enable-module + deactivate-staff to YR system roles and staff_role_assignments"
```

---

## Task 9: YR backend — `list-chapters`

**Files (repo: `youth-republic/backend`):**
- Create: `supabase/functions/list-chapters/index.ts`
- Create: `supabase/functions/list-chapters/handler.ts`
- Create: `supabase/functions/list-chapters/handler.test.ts`

**Interfaces:**
- Consumes: `verifyStaffToken` / `staffHasPermission` from `../_shared/verifyStaffToken.ts`, `getAdminClient` from `../_shared/supabaseAdmin.ts`, `corsPreflightResponse`/`corsHeaders` from `../_shared/cors.ts` (match `create-chapter/index.ts` exactly).
- Produces: `listChapters(supabase, staffClaims, input: { organizationId: string }): Promise<{ chapters: { id: string; name: string; institution: string | null; city: string | null; province: string | null; status: string }[] }>` — requires `chapters:read` on `youth-republic`.

- [ ] **Step 1: Read `create-chapter/index.ts` for the exact wrapper shape**

Run: `cat supabase/functions/create-chapter/index.ts`

- [ ] **Step 2: Write the failing test**

Create `supabase/functions/list-chapters/handler.test.ts`:

```ts
import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { listChapters } from "./handler.ts";
import type { StaffClaims } from "../_shared/verifyStaffToken.ts";

function testClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}
function claims(orgId: string, perms: string[]): StaffClaims {
  return {
    actorType: "staff", staffId: crypto.randomUUID(), platformOwner: false, canVerifyIdentity: false,
    orgRoles: [{ organizationId: orgId }],
    moduleAccess: [{ organizationId: orgId, module: "youth-republic", permissions: perms }],
  };
}

Deno.test("listChapters returns the org's chapters for a permitted caller", async () => {
  const supabase = testClient();
  const { data: org } = await supabase.from("organizations").insert({
    name: "LC Org", slug: `lc-${crypto.randomUUID()}`,
  }).select("id").single();
  await supabase.from("chapters").insert([
    { organization_id: org!.id, name: "Lahore Chapter", city: "Lahore" },
    { organization_id: org!.id, name: "Karachi Chapter", city: "Karachi", status: "inactive" },
  ]);

  const result = await listChapters(supabase, claims(org!.id, ["chapters:read"]), { organizationId: org!.id });
  assertEquals(result.chapters.length, 2);
  assertEquals(new Set(result.chapters.map((c) => c.name)), new Set(["Lahore Chapter", "Karachi Chapter"]));

  await assertRejects(
    () => listChapters(supabase, claims(org!.id, []), { organizationId: org!.id }),
    Error, "forbidden",
  );
});
```

- [ ] **Step 3: Run it — expect fail**

Run: `cd supabase && deno task test --filter listChapters` → FAIL.

- [ ] **Step 4: Implement the handler**

Create `supabase/functions/list-chapters/handler.ts`:

```ts
import { SupabaseClient } from "@supabase/supabase-js";
import { staffHasPermission, type StaffClaims } from "../_shared/verifyStaffToken.ts";

export interface ListChaptersInput {
  organizationId: string;
}

export interface ChapterRow {
  id: string;
  name: string;
  institution: string | null;
  city: string | null;
  province: string | null;
  status: string;
}

export async function listChapters(
  supabase: SupabaseClient,
  staffClaims: StaffClaims,
  input: ListChaptersInput,
): Promise<{ chapters: ChapterRow[] }> {
  if (!staffHasPermission(staffClaims, input.organizationId, "youth-republic", "chapters:read")) {
    throw new Error("forbidden");
  }
  const { data, error } = await supabase
    .from("chapters")
    .select("id, name, institution, city, province, status")
    .eq("organization_id", input.organizationId)
    .order("name");
  if (error) throw error;
  return { chapters: (data ?? []) as ChapterRow[] };
}
```

- [ ] **Step 5: Implement the index wrapper**

Create `supabase/functions/list-chapters/index.ts` — copy `supabase/functions/create-chapter/index.ts` byte-for-byte, then change: the handler import to `listChapters` from `./handler.ts`; the call to `await listChapters(supabase, staffClaims, input)`; response `status: 200`.

- [ ] **Step 6: Run it — expect pass**

Run: `cd supabase && deno task test --filter listChapters` → PASS.

- [ ] **Step 7: Commit (in `youth-republic/backend`)**

```bash
git add supabase/functions/list-chapters/
git commit -m "feat(fn): list-chapters read endpoint for the admin Team & Access screen"
```

---

## Task 10: Deploy + full regression

**Files:** none (deploy + verify).

- [ ] **Step 1: Deploy platform functions**

```bash
cd /path/to/tmp-partner-admin
set -a; source .env; set +a
npx supabase@latest functions deploy invite-staff-member update-staff-access remove-staff-member update-custom-role delete-custom-role create-custom-role mint-staff-token enable-module deactivate-staff --project-ref "$SUPABASE_PROJECT_REF"
```
(There is no `create-staff` / `assign-staff-module-role` to deploy; if the platform ever ran `functions deploy` for all, delete those deployed functions in the Supabase dashboard or via `npx supabase functions delete create-staff assign-staff-module-role`.)

- [ ] **Step 2: Deploy the YR function**

```bash
cd /path/to/youth-republic/backend
set -a; source .env; set +a
npx supabase@latest functions deploy list-chapters --project-ref "$SUPABASE_PROJECT_REF"
```

- [ ] **Step 3: Full DB + function test sweep (platform)**

```bash
cd /path/to/tmp-partner-admin
set -a; source .env; set +a
for f in supabase/tests/database/*.sql; do psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$f"; done
cd supabase && deno task test
```
Expected: pgTAP suites all `ok`, `deno task test` all green.

- [ ] **Step 4: Commit any final test fixes**

```bash
git add -A && git commit -m "test: finalize Team & Access backend regression"
```

---

## Self-Review

**Spec coverage:**

- §3.1 `staff_role_assignments` → Task 1. §3.2 `staff` status → Task 1. §3.3 capability rows + convention → Task 1 (rows) + Task 3 (translation). §3.4 five system roles → Task 1 seed fn + Global Constraints table. §3.5 `staff_invitations` → Task 1. §3.6 `admin_audit_log` → Task 1 + Task 4 (`writeAuditLog`).
- §4.1 `mint-staff-token` `chapters` → Task 2. §4.2 `staffToken.ts` claims field → **frontend plan** (Task 2 there); the token *emission* is Task 2 here. §4.3 effective permissions (UI) → **frontend plan**.
- §5 functions: `invite-staff-member` → Task 4; `update-staff-access` → Task 5; `remove-staff-member` → Task 6; `create-custom-role` extend → Task 7; `update-custom-role` → Task 7; `delete-custom-role` → Task 7; `create-staff` retire → Task 4 Step 7; `assign-staff-module-role` delete → Task 5 Step 6; `mint-staff-token` → Task 2. §5 chapter CRUD: `create-chapter`/`update-chapter` already exist (no task); `list-chapters` → Task 9.
- §5.1 `lib/vmsFunctions.ts` + `NEXT_PUBLIC_VMS_FUNCTIONS_URL` + `platformFunctions.ts` wrappers → **frontend plan** (client-side).
- §8 testing: pgTAP → Task 1 Step 6; handler tests → each function task; component tests → **frontend plan**.
- §9 limitation "`update-chapter` also rewrites `staff_role_assignments.scope_label`" — **not implementable**: `staff_role_assignments` is in the platform project, `update-chapter` runs in the YR project with no access to it. Corrected understanding: the cached `scope_label` goes stale on chapter rename; the frontend re-derives the label from the live chapter list when rendering (frontend plan Task 5/7). Noted here so the executor does not try to add a cross-project write.

**Placeholder scan:** no "TBD"/"handle errors"/"similar to". The activation-email path in Task 4 is an explicit, scoped `console.log` stub with a spec reference, not a placeholder.

**Type consistency:** `RoleAssignmentInput` defined in Task 4 (`invite-staff-member/handler.ts`), imported by Task 5. `CapabilityGrid`/`gridToPermissionKeys`/`permissionKeysToGrid` defined Task 3, used Tasks 7. `writeAuditLog`/`actorName`/`AuditLogEntry` defined Task 4, used Tasks 5–7. `admin_audit_log.action` strings match the Global Constraints list. `seed_youth_republic_system_roles` name identical in Task 1, Task 2 (testSupport), Task 8.

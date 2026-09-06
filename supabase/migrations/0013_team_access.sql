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

-- 11. Repoint the RLS policies that referenced staff_module_roles, then drop it.
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

drop policy organizations_select on organizations;
create policy organizations_select on organizations
  for select using (
    is_platform_owner()
    or exists (select 1 from staff_org_roles sor where sor.staff_id = current_staff_id() and sor.organization_id = organizations.id)
    or exists (select 1 from staff_role_assignments sra where sra.staff_id = current_staff_id() and sra.organization_id = organizations.id)
  );

drop policy staff_module_roles_select on staff_module_roles;
drop table staff_module_roles;

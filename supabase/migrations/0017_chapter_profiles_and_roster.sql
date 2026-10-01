-- 0017_chapter_profiles_and_roster.sql — Chapter Profiles, Roster Management & Partner Inquiries

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

drop policy if exists chapter_team_members_select on chapter_team_members;
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

-- 5. System roles update: seed Org Admin and inquiries permissions
create or replace function seed_youth_republic_system_roles(p_org_id uuid, p_module_id uuid)
returns void as $$
begin
  perform seed_youth_republic_system_role(p_org_id, p_module_id, 'Super Admin',
    'Full platform control and unconstrained administrative privileges across all operational modules.',
    array['opportunities:write','noticeboard:write','applications:update','applications:read','hours:update','hours:read','team:write','inquiries:write','inquiries:read']);
  perform seed_youth_republic_system_role(p_org_id, p_module_id, 'Org Admin',
    'Full operational permissions and organization-wide team governance.',
    array['opportunities:write','noticeboard:write','applications:update','applications:read','hours:update','hours:read','team:write','inquiries:write','inquiries:read']);
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

-- Seed Org Admin into every org that already has youth-republic module enabled
do $$
declare
  v_module_id uuid;
  v_org record;
begin
  select id into v_module_id from modules where key = 'youth-republic';
  for v_org in
    select organization_id from org_modules where module_id = v_module_id
  loop
    if not exists (select 1 from roles where organization_id = v_org.organization_id and module_id = v_module_id and name = 'Org Admin') then
      perform seed_youth_republic_system_role(v_org.organization_id, v_module_id, 'Org Admin',
        'Full operational permissions and organization-wide team governance.',
        array['opportunities:write','noticeboard:write','applications:update','applications:read','hours:update','hours:read','team:write','inquiries:write','inquiries:read']);
    end if;
  end loop;
end $$;

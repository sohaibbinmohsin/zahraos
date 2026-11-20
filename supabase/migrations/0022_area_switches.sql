-- Migration 0022: Align youth-republic system role keys with module area switches

-- 1. Update seed_youth_republic_system_roles for newly enabled modules
create or replace function seed_youth_republic_system_roles(p_org_id uuid, p_module_id uuid)
returns void as $$
begin
  perform seed_youth_republic_system_role(p_org_id, p_module_id, 'Super Admin',
    'Full platform control and unconstrained administrative privileges across all operational modules.',
    array['opportunities:write','opportunities:read','opportunities:update','opportunities:delete','noticeboard:write','noticeboard:read','applications:update','applications:read','applications:write','hours:update','hours:read','hours:write','team:write','members:write','members:read','roles:write','roles:read','inquiries:write','inquiries:read','chapters:write','chapters:read','chapters:update','chapters:delete','volunteers:read','volunteers:update','admin_action_log:read','export:read']);

  perform seed_youth_republic_system_role(p_org_id, p_module_id, 'Org Admin',
    'Full operational permissions and organization-wide team governance.',
    array['opportunities:write','opportunities:read','opportunities:update','noticeboard:write','noticeboard:read','applications:update','applications:read','hours:update','hours:read','team:write','members:write','members:read','roles:read','inquiries:read','chapters:write','chapters:read','volunteers:read','admin_action_log:read']);

  perform seed_youth_republic_system_role(p_org_id, p_module_id, 'Chapter Lead',
    'Oversees local chapter operations, drive execution, applicant selection, hours verification, and chapter roster governance.',
    array['opportunities:read','opportunities:write','opportunities:update','noticeboard:read','noticeboard:write','applications:read','applications:update','hours:read','hours:update']);

  perform seed_youth_republic_system_role(p_org_id, p_module_id, 'City Lead',
    'Oversees multi-chapter regional operations, drive execution, applicant selection, hours verification, and chapter roster governance.',
    array['opportunities:read','opportunities:write','opportunities:update','noticeboard:read','noticeboard:write','applications:read','applications:update','hours:read','hours:update']);

  perform seed_youth_republic_system_role(p_org_id, p_module_id, 'Drive Coordinator',
    'Manages on-ground drive shifts, volunteer gate attendance, and direct shift hours logging.',
    array['opportunities:read','opportunities:write','opportunities:update','applications:read','applications:update','hours:read','hours:update']);

  perform seed_youth_republic_system_role(p_org_id, p_module_id, 'Application Reviewer',
    'Screens and shortlists volunteer applicants, assesses question responses, and assigns candidate statuses.',
    array['applications:read','applications:update']);

  perform seed_youth_republic_system_role(p_org_id, p_module_id, 'Auditor',
    'Read-only compliance officer auditing hours logs, certifications, and operational activity records.',
    array['applications:read','hours:read','admin_action_log:read']);
end;
$$ language plpgsql;

-- 2. Replace role_permissions for the five operational system roles on existing orgs
do $$
declare
  v_module_id uuid;
  v_role record;
  v_keys text[];
begin
  select id into v_module_id from modules where key = 'youth-republic';
  if v_module_id is null then
    return;
  end if;

  delete from role_permissions rp
  using roles r
  where rp.role_id = r.id
    and r.module_id = v_module_id
    and r.is_system
    and r.name in ('Chapter Lead', 'City Lead', 'Drive Coordinator', 'Application Reviewer', 'Auditor');

  for v_role in
    select id, name from roles
    where module_id = v_module_id
      and is_system
      and name in ('Chapter Lead', 'City Lead', 'Drive Coordinator', 'Application Reviewer', 'Auditor')
  loop
  v_keys := case v_role.name
      when 'Chapter Lead' then array[
        'opportunities:read','opportunities:write','opportunities:update','noticeboard:read','noticeboard:write','applications:read','applications:update','hours:read','hours:update'
      ]
      when 'City Lead' then array[
        'opportunities:read','opportunities:write','opportunities:update','noticeboard:read','noticeboard:write','applications:read','applications:update','hours:read','hours:update'
      ]
      when 'Drive Coordinator' then array[
        'opportunities:read','opportunities:write','opportunities:update','applications:read','applications:update','hours:read','hours:update'
      ]
      when 'Application Reviewer' then array['applications:read','applications:update']
      when 'Auditor' then array['applications:read','hours:read','admin_action_log:read']
    end;

    insert into role_permissions (role_id, permission_id)
    select v_role.id, p.id
    from permissions p
    where p.module_id = v_module_id
      and (p.resource || ':' || p.action) = any (v_keys)
    on conflict do nothing;
  end loop;
end $$;

-- 3. City-scoped assignments: one row per city (chapter_id null, city set)
alter table staff_role_assignments add column city text;

alter table staff_role_assignments drop constraint staff_role_assignments_scope_shape;
alter table staff_role_assignments drop constraint staff_role_assignments_scope_kind_check;

alter table staff_role_assignments add constraint staff_role_assignments_scope_kind_check
  check (scope_kind in ('org_wide', 'chapter', 'city'));

alter table staff_role_assignments add constraint staff_role_assignments_scope_shape check (
  (scope_kind = 'org_wide' and chapter_id is null and city is null) or
  (scope_kind = 'chapter' and chapter_id is not null and city is null) or
  (scope_kind = 'city' and chapter_id is null and city is not null)
);
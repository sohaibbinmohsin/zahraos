-- Migration 0018: Replace Operations Lead with Chapter Lead and introduce City Lead

-- 1. Ensure chapters, roles, and members permissions exist for youth-republic module
insert into permissions (module_id, resource, action)
select m.id, r.resource, r.action
from modules m
cross join (values
  ('chapters', 'read'), ('chapters', 'write'),
  ('roles', 'read'), ('roles', 'write'),
  ('members', 'read'), ('members', 'write'),
  ('noticeboard', 'read')
) as r(resource, action)
where m.key = 'youth-republic'
on conflict (module_id, resource, action) do nothing;

-- 2. Update seed_youth_republic_system_roles function
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

    -- Ensure Chapter Lead, Super Admin, and Org Admin have their permissions attached
    for v_role in select id, organization_id, name from roles where module_id = v_module_id and name in ('Chapter Lead', 'Super Admin', 'Org Admin') loop
      if v_role.name = 'Super Admin' then
        insert into role_permissions (role_id, permission_id)
        select v_role.id, p.id from permissions p
        where p.module_id = v_module_id
          and (p.resource || ':' || p.action) in (
            'opportunities:write','opportunities:read','opportunities:update','opportunities:delete',
            'noticeboard:write','noticeboard:read','applications:update','applications:read','applications:write',
            'hours:update','hours:read','hours:write','team:write','members:write','members:read',
            'roles:write','roles:read','inquiries:write','inquiries:read','chapters:write','chapters:read',
            'chapters:update','chapters:delete','volunteers:read','volunteers:update','admin_action_log:read','export:read'
          )
        on conflict do nothing;
      elsif v_role.name = 'Org Admin' then
        -- Remove write permissions on inquiries and roles if previously set
        delete from role_permissions rp
        using permissions p
        where rp.role_id = v_role.id
          and rp.permission_id = p.id
          and p.module_id = v_module_id
          and (p.resource || ':' || p.action) in ('roles:write', 'inquiries:write');

        insert into role_permissions (role_id, permission_id)
        select v_role.id, p.id from permissions p
        where p.module_id = v_module_id
          and (p.resource || ':' || p.action) in (
            'opportunities:write','opportunities:read','opportunities:update','noticeboard:write','noticeboard:read',
            'applications:update','applications:read','hours:update','hours:read','team:write','members:write','members:read',
            'roles:read','inquiries:read','chapters:write','chapters:read','volunteers:read','admin_action_log:read'
          )
        on conflict do nothing;
      else
        insert into role_permissions (role_id, permission_id)
        select v_role.id, p.id
        from permissions p
        where p.module_id = v_module_id
          and (p.resource || ':' || p.action) in ('chapters:write', 'chapters:read')
        on conflict do nothing;
      end if;
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

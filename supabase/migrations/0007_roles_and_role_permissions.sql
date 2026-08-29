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

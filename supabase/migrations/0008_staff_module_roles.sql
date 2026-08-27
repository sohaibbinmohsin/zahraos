create table staff_module_roles (
  staff_id uuid not null references staff(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  module_id uuid not null references modules(id) on delete cascade,
  role_id uuid not null references roles(id) on delete cascade,
  primary key (staff_id, organization_id, module_id)
);

create index staff_module_roles_org_module_idx on staff_module_roles (organization_id, module_id);

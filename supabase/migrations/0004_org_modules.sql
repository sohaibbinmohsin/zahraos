create table org_modules (
  organization_id uuid not null references organizations(id) on delete cascade,
  module_id uuid not null references modules(id) on delete cascade,
  enabled_at timestamptz not null default now(),
  primary key (organization_id, module_id)
);

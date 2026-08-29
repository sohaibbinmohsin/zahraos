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

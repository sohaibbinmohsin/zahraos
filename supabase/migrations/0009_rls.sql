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

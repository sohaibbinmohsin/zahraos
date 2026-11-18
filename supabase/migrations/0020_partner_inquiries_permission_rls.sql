-- 0020_partner_inquiries_permission_rls.sql
--
-- Partner Inquiries must be readable by custom roles that hold inquiries:read
-- (e.g. "Partner Inquiries Reader"), not only by Org Admin / Super Admin.
-- Writes stay gated on inquiries:write (or org admin).

create or replace function staff_has_org_permission(
  p_org_id uuid,
  p_resource text,
  p_action text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    is_org_admin_or_above(p_org_id)
    or exists (
      select 1
      from staff_role_assignments sra
      join role_permissions rp on rp.role_id = sra.role_id
      join permissions p on p.id = rp.permission_id
      join staff s on s.id = sra.staff_id
      where sra.staff_id = current_staff_id()
        and sra.organization_id = p_org_id
        and s.status <> 'deactivated'
        and sra.scope_kind = 'org_wide'
        and p.resource = p_resource
        and p.action = p_action
    );
$$;

drop policy if exists partner_inquiries_select on partner_inquiries;
create policy partner_inquiries_select on partner_inquiries
  for select using (
    staff_has_org_permission(organization_id, 'inquiries', 'read')
    or staff_has_org_permission(organization_id, 'inquiries', 'write')
  );

drop policy if exists partner_inquiries_update on partner_inquiries;
create policy partner_inquiries_update on partner_inquiries
  for update using (
    staff_has_org_permission(organization_id, 'inquiries', 'write')
  );

drop policy if exists partner_inquiries_delete on partner_inquiries;
create policy partner_inquiries_delete on partner_inquiries
  for delete using (
    staff_has_org_permission(organization_id, 'inquiries', 'write')
  );

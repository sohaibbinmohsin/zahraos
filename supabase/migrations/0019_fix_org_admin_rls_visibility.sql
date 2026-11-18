-- 0019_fix_org_admin_rls_visibility.sql
--
-- Bug: Partner Inquiries, Team Members, Roles, and other admin-gated reads all
-- go through is_org_admin_or_above(), which previously only looked at
-- staff_org_roles. Mint-staff-token already treats Super Admin / Org Admin
-- (org_wide) role assignments as national admins even when the tier row is
-- missing — so the shell can show "Super Admin" while RLS returns empty
-- inquiries / "Unknown role" teammates.
--
-- Fix: align is_org_admin_or_above with mint-staff-token, then backfill any
-- missing staff_org_roles rows from existing role assignments.

create or replace function is_org_admin_or_above(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    is_platform_owner()
    or exists (
      select 1
      from staff_org_roles sor
      where sor.staff_id = current_staff_id()
        and sor.organization_id = p_org_id
        and sor.org_tier in ('admin', 'super_admin')
    )
    or exists (
      select 1
      from staff_role_assignments sra
      join roles r on r.id = sra.role_id
      join staff s on s.id = sra.staff_id
      where sra.staff_id = current_staff_id()
        and sra.organization_id = p_org_id
        and s.status <> 'deactivated'
        and (
          r.name = 'Super Admin'
          or (r.name = 'Org Admin' and sra.scope_kind = 'org_wide')
        )
    );
$$;

-- Repair existing accounts that were granted Super Admin / Org Admin via
-- staff_role_assignments but never got a matching staff_org_roles tier row
-- (e.g. invited before invite/update sync existed, or synced incompletely).
insert into staff_org_roles (staff_id, organization_id, org_tier)
select
  sra.staff_id,
  sra.organization_id,
  case
    when bool_or(r.name = 'Super Admin') then 'super_admin'
    else 'admin'
  end as org_tier
from staff_role_assignments sra
join roles r on r.id = sra.role_id
join staff s on s.id = sra.staff_id
where s.status <> 'deactivated'
  and (
    r.name = 'Super Admin'
    or (r.name = 'Org Admin' and sra.scope_kind = 'org_wide')
  )
group by sra.staff_id, sra.organization_id
on conflict (staff_id, organization_id) do update
set org_tier = case
  when staff_org_roles.org_tier = 'super_admin' or excluded.org_tier = 'super_admin'
    then 'super_admin'
  else excluded.org_tier
end;

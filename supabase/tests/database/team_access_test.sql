begin;
select plan(13);

select has_table('public', 'staff_role_assignments', 'staff_role_assignments exists');
select has_table('public', 'staff_invitations', 'staff_invitations exists');
select has_table('public', 'admin_audit_log', 'admin_audit_log exists');
select has_column('public', 'roles', 'description', 'roles has description');
select hasnt_table('public', 'staff_module_roles', 'staff_module_roles is dropped');
select col_has_check('public', 'staff', 'status', 'staff.status still has a check constraint');

insert into organizations (name, slug) values ('TA Test', 'ta-test') returning id as org_id \gset
select id as module_id from modules where key = 'youth-republic' \gset
insert into org_modules (organization_id, module_id) values (:'org_id', :'module_id');

select seed_youth_republic_system_roles(:'org_id', :'module_id');

select is(
  (select count(*) from roles where organization_id = :'org_id' and module_id = :'module_id' and is_system),
  5::bigint, 'seeds five YR system roles');

select is(
  (select count(*) from role_permissions rp
     join roles r on r.id = rp.role_id
     join permissions p on p.id = rp.permission_id
   where r.organization_id = :'org_id' and r.name = 'Super Admin'
     and (p.resource || ':' || p.action) = 'team:write'),
  1::bigint, 'Super Admin holds team:write');

select is(
  (select count(*) from role_permissions rp
     join roles r on r.id = rp.role_id
     join permissions p on p.id = rp.permission_id
   where r.organization_id = :'org_id' and r.name = 'Auditor'
     and p.action in ('write', 'update')),
  0::bigint, 'Auditor holds no write/update permissions');

select is(
  (select count(*) from role_permissions rp
     join roles r on r.id = rp.role_id
     join permissions p on p.id = rp.permission_id
   where r.organization_id = :'org_id' and r.name = 'Application Reviewer'
     and (p.resource || ':' || p.action) in ('applications:update', 'applications:read')),
  2::bigint, 'Application Reviewer holds applications update+read only');

-- scope-shape CHECK
select id as super_admin_role_id from roles where organization_id = :'org_id' and name = 'Super Admin' \gset
with u as (insert into auth.users (id) values (gen_random_uuid()) returning id)
insert into staff (auth_user_id, full_name, email) select id, 'Scope Test', 'scope-test@example.com' from u
returning id as scope_staff_id \gset

select throws_ok(
  $$ insert into staff_role_assignments (staff_id, organization_id, module_id, role_id, scope_kind, chapter_id, scope_label)
     values ( (select id from staff where email = 'scope-test@example.com'),
       '$$ || :'org_id' || $$', '$$ || :'module_id' || $$', '$$ || :'super_admin_role_id' || $$',
       'chapter', null, 'Broken') $$,
  '23514', null, 'scope_kind=chapter requires chapter_id');

select lives_ok(
  $$ insert into staff_role_assignments (staff_id, organization_id, module_id, role_id, scope_kind, scope_label)
     values ( (select id from staff where email = 'scope-test@example.com'),
       '$$ || :'org_id' || $$', '$$ || :'module_id' || $$', '$$ || :'super_admin_role_id' || $$',
       'org_wide', 'National / All Chapters') $$,
  'org_wide assignment with null chapter_id is allowed');

select throws_ok(
  $$ insert into staff_role_assignments (staff_id, organization_id, module_id, role_id, scope_kind, scope_label)
     values ( (select id from staff where email = 'scope-test@example.com'),
       '$$ || :'org_id' || $$', '$$ || :'module_id' || $$', '$$ || :'super_admin_role_id' || $$',
       'org_wide', 'Dup') $$,
  '23505', null, 'duplicate (staff, role, no-chapter) assignment is rejected');

select * from finish();
rollback;

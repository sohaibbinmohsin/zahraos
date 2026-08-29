begin;
select plan(3);

select has_table('public', 'staff_module_roles', 'staff_module_roles exists');

with test_user as (
  insert into auth.users (id) values (gen_random_uuid()) returning id
)
insert into staff (auth_user_id, full_name, email)
select id, 'Grant Test', 'grant-test@example.com' from test_user returning id as staff_id \gset

insert into organizations (name, slug) values ('Rizq', 'rizq') returning id as org_id \gset
select id as module_id from modules where key = 'vms' \gset
select seed_system_roles_for_module(:'org_id', :'module_id');
select id as role_id from roles where organization_id = :'org_id' and name = 'Editor' \gset

insert into staff_module_roles (staff_id, organization_id, module_id, role_id)
values (:'staff_id', :'org_id', :'module_id', :'role_id');

select is((select count(*) from staff_module_roles where staff_id = :'staff_id'), 1::bigint, 'grant created');

select throws_ok(
  format($$ insert into staff_module_roles (staff_id, organization_id, module_id, role_id) values ('%s', '%s', '%s', '%s') $$, :'staff_id', :'org_id', :'module_id', :'role_id'),
  '23505',
  null,
  'duplicate grant for the same staff+org+module is rejected'
);

select * from finish();
rollback;

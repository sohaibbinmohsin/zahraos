begin;
select plan(4);

select has_table('public', 'staff_org_roles', 'staff_org_roles exists');

with test_user as (
  insert into auth.users (id) values (gen_random_uuid()) returning id
)
insert into staff (auth_user_id, full_name, email)
select id, 'Admin Test', 'admin-test@example.com' from test_user returning id as staff_id \gset

insert into organizations (name, slug) values ('Rizq', 'rizq') returning id as org_id \gset

insert into staff_org_roles (staff_id, organization_id, org_tier) values (:'staff_id', :'org_id', 'admin');

select is(staff_org_tier(:'org_id'), null, 'staff_org_tier reads the JWT-authenticated staff, not an arbitrary staff_id — null with no session');

select throws_ok(
  format($$ insert into staff_org_roles (staff_id, organization_id, org_tier) values ('%s', '%s', 'bogus') $$, :'staff_id', :'org_id'),
  '23514',
  null,
  'org_tier is restricted to super_admin|admin'
);

select is((select org_tier from staff_org_roles where staff_id = :'staff_id'), 'admin', 'row stores the assigned tier');

select * from finish();
rollback;

begin;
select plan(5);

select has_table('public', 'roles', 'roles exists');
select has_table('public', 'role_permissions', 'role_permissions exists');

insert into organizations (name, slug) values ('Rizq', 'rizq') returning id as org_id \gset
select id as module_id from modules where key = 'vms' \gset

select seed_system_roles_for_module(:'org_id', :'module_id');

select is((select count(*) from roles where organization_id = :'org_id' and is_system), 2::bigint, 'seeds Viewer and Editor');

select is(
  (select count(*) from role_permissions rp join roles r on r.id = rp.role_id
   where r.organization_id = :'org_id' and r.name = 'Viewer'),
  (select count(*) from permissions p join modules m on m.id = p.module_id where m.key = 'vms' and p.action = 'read'),
  'Viewer gets every read permission for the module'
);

select is(
  (select count(*) from role_permissions rp join roles r on r.id = rp.role_id
   join permissions p on p.id = rp.permission_id
   where r.organization_id = :'org_id' and r.name = 'Editor' and p.action = 'delete'),
  0::bigint,
  'Editor does not get delete permissions'
);

select * from finish();
rollback;

begin;
select plan(3);

select has_table('public', 'permissions', 'permissions exists');

select is(
  (select count(*) from permissions p join modules m on m.id = p.module_id where m.key = 'vms'),
  21::bigint,
  'vms catalog seeded with 21 permissions'
);

select throws_ok(
  $$ insert into permissions (module_id, resource, action) select id, 'opportunities', 'archive' from modules where key = 'vms' $$,
  '23514',
  null,
  'action is restricted to read|write|update|delete'
);

select * from finish();
rollback;

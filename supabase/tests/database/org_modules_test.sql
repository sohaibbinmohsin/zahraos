begin;
select plan(2);

select has_table('public', 'org_modules', 'org_modules exists');

insert into organizations (name, slug) values ('Rizq', 'rizq') returning id as org_id \gset
insert into org_modules (organization_id, module_id)
select :'org_id', id from modules where key = 'vms';

select is((select count(*) from org_modules where organization_id = :'org_id'), 1::bigint, 'vms enabled for the org');

select * from finish();
rollback;

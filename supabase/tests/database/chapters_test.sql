begin;
select plan(10);

select has_table('public', 'chapters', 'chapters table exists');
select has_column('public', 'staff', 'expires_at', 'staff.expires_at exists');
select col_is_fk('public', 'staff_role_assignments', 'chapter_id', 'chapter_id is a FK');

select is(
  (select count(*) from staff_role_assignments sra
   where sra.chapter_id is not null
     and not exists (select 1 from chapters c where c.id = sra.chapter_id)),
  0::bigint,
  'no staff_role_assignments row references a non-existent chapter');

insert into organizations (name, slug) values ('Chap Test', 'chap-test') returning id as org_id \gset

insert into chapters (organization_id, name, city) values (:'org_id', 'Rizq LUMS', 'Lahore')
  returning id as chapter_id \gset
select is((select status from chapters where id = :'chapter_id'), 'active', 'status defaults to active');

select throws_ok(
  $$ insert into chapters (organization_id, name) values ('$$ || :'org_id' || $$', 'Rizq LUMS') $$,
  '23505', null, 'chapter name is unique per org');

select lives_ok(
  $$ insert into chapters (organization_id, name) values ('$$ || :'org_id' || $$', 'Rizq NUST') $$,
  'a second differently-named chapter for the same org is allowed');

-- FK: an assignment can reference a real chapter, and cannot reference a bogus one.
with u as (insert into auth.users (id) values (gen_random_uuid()) returning id)
insert into staff (auth_user_id, full_name, email) select id, 'FK Test', 'chap-fk@example.com' from u
  returning id as staff_id \gset
select id as module_id from modules where key = 'youth-republic' \gset
insert into org_modules (organization_id, module_id) values (:'org_id', :'module_id');
select seed_youth_republic_system_roles(:'org_id', :'module_id');
select id as role_id from roles where organization_id = :'org_id' and name = 'Operations Lead' \gset

select lives_ok(
  $$ insert into staff_role_assignments
       (staff_id, organization_id, module_id, role_id, scope_kind, chapter_id, scope_label)
     values ('$$ || :'staff_id' || $$', '$$ || :'org_id' || $$', '$$ || :'module_id' || $$',
             '$$ || :'role_id' || $$', 'chapter', '$$ || :'chapter_id' || $$', 'Rizq LUMS') $$,
  'assignment referencing a real chapter is allowed');

select throws_ok(
  $$ insert into staff_role_assignments
       (staff_id, organization_id, module_id, role_id, scope_kind, chapter_id, scope_label)
     values ('$$ || :'staff_id' || $$', '$$ || :'org_id' || $$', '$$ || :'module_id' || $$',
             '$$ || :'role_id' || $$', 'chapter', gen_random_uuid(), 'Bogus') $$,
  '23503', null, 'assignment referencing a non-existent chapter is rejected');

select ok(
  (select count(*) from pg_policies where tablename = 'chapters' and cmd = 'SELECT') = 1,
  'chapters has exactly one SELECT policy and no write policy');

select * from finish();
rollback;

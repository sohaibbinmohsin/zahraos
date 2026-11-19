begin;
select plan(8);

select has_table('public', 'staff', 'staff table exists');
select has_column('public', 'staff', 'must_change_password', 'has must_change_password column');
select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'staff_email_active_key'
      and indexdef ilike '%unique%'
      and indexdef ilike '%deactivated%'
  ),
  'non-deactivated staff emails stay unique'
);
select col_is_unique('public', 'staff', 'auth_user_id', 'auth_user_id is unique');
select ok(
  (
    select is_nullable = 'YES'
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'staff'
      and column_name = 'auth_user_id'
  ),
  'auth_user_id is nullable so a removed member can be detached from auth'
);

select lives_ok(
$$
do $do$
begin
  insert into auth.users (id) values ('11111111-1111-4111-8111-111111111111');
  insert into auth.users (id) values ('22222222-2222-4222-8222-222222222222');
  insert into staff (auth_user_id, full_name, email, status, deactivated_at)
  values ('11111111-1111-4111-8111-111111111111', 'Old Member', 'reuse@example.com', 'deactivated', now());
  insert into staff (auth_user_id, full_name, email, status)
  values ('22222222-2222-4222-8222-222222222222', 'New Member', 'reuse@example.com', 'active');
end
$do$;
$$,
'a deactivated staff row keeps its email while a new active account uses it'
);

select throws_ok(
$$
do $do$
begin
  insert into auth.users (id) values ('33333333-3333-4333-8333-333333333333');
  insert into staff (auth_user_id, full_name, email, status)
  values ('33333333-3333-4333-8333-333333333333', 'Duplicate', 'reuse@example.com', 'active');
end
$do$;
$$,
'23505'
);

with test_user as (
  insert into auth.users (id) values (gen_random_uuid()) returning id
)
insert into staff (auth_user_id, full_name, email, platform_owner)
select id, 'Owner Test', 'owner-test@example.com', true from test_user;

select set_config('request.jwt.claims', '{}', true);
select set_config('role', 'authenticated', true);

select is(is_platform_owner(), false, 'is_platform_owner is false with no session');

select * from finish();
rollback;

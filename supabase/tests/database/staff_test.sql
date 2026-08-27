begin;
select plan(5);

select has_table('public', 'staff', 'staff table exists');
select has_column('public', 'staff', 'must_change_password', 'has must_change_password column');
select col_is_unique('public', 'staff', 'email', 'email is unique');
select col_is_unique('public', 'staff', 'auth_user_id', 'auth_user_id is unique');

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

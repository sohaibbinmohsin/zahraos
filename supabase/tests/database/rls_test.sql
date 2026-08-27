begin;
select plan(3);

with test_user as (
  insert into auth.users (id) values (gen_random_uuid()) returning id
)
insert into staff (auth_user_id, full_name, email, platform_owner)
select id, 'RLS Owner', 'rls-owner@example.com', true from test_user
returning auth_user_id as owner_auth_id \gset

select set_config('request.jwt.claims', format('{"sub": "%s"}', :'owner_auth_id'), true);
select set_config('role', 'authenticated', true);

select ok(is_platform_owner(), 'platform_owner sees themself as owner once authenticated');

select set_config('request.jwt.claims', '{}', true);
select is((select count(*) from staff), 0::bigint, 'no session means no visible staff rows');

select set_config('request.jwt.claims', format('{"sub": "%s"}', :'owner_auth_id'), true);
select is((select count(*) from staff) >= 1, true, 'platform_owner can see staff rows once authenticated');

select * from finish();
rollback;

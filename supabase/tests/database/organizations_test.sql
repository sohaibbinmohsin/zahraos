begin;
select plan(3);

select has_table('public', 'organizations', 'organizations exists');
select col_is_unique('public', 'organizations', 'slug', 'slug is unique');

insert into organizations (name, slug) values ('Rizq', 'rizq');
select is((select status from organizations where slug = 'rizq'), 'active', 'defaults to active');

select * from finish();
rollback;

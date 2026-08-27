begin;
select plan(2);

select has_table('public', 'modules', 'modules exists');
select col_is_unique('public', 'modules', 'key', 'key is unique');

select * from finish();
rollback;

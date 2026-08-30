begin;
select plan(5);
select has_column('organizations', 'brand_color', 'orgs.brand_color exists');
select has_column('organizations', 'logo_url', 'orgs.logo_url exists');
select has_column('organizations', 'favicon_url', 'orgs.favicon_url exists');
select has_column('organizations', 'about', 'orgs.about exists');
select has_column('staff', 'can_verify_identity', 'staff.can_verify_identity exists');
select * from finish();
rollback;

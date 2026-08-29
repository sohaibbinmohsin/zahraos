create table modules (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  display_name text not null
);

insert into modules (key, display_name) values ('vms', 'Volunteer Management System');

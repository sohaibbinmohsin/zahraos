create table staff (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  platform_owner boolean not null default false,
  must_change_password boolean not null default true,
  status text not null default 'active' check (status in ('active', 'deactivated')),
  created_at timestamptz not null default now(),
  deactivated_at timestamptz
);

create index staff_status_idx on staff (status);

create or replace function current_staff_id() returns uuid as $$
  select id from staff where auth_user_id = auth.uid();
$$ language sql stable;

create or replace function is_platform_owner() returns boolean as $$
  select coalesce((select platform_owner from staff where auth_user_id = auth.uid()), false);
$$ language sql stable;

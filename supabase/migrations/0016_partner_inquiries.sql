-- 0016_partner_inquiries.sql
-- Multi-tenant partner inquiry submissions

create table if not exists partner_inquiries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  email text not null,
  phone text default '',
  partner_organization text default '',
  category text not null default 'Other',
  message text not null,
  status text not null default 'new' check (status in ('new', 'in_review', 'contacted', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index for filtering inquiries by organization sorted by newest first
create index if not exists partner_inquiries_org_created_idx
  on partner_inquiries (organization_id, created_at desc);

-- Index for status filtering within an organization
create index if not exists partner_inquiries_org_status_idx
  on partner_inquiries (organization_id, status);

-- Enable RLS
alter table partner_inquiries enable row level security;

-- Platform owners and org admins can view inquiries belonging to their organization
create policy partner_inquiries_select on partner_inquiries
  for select using (is_org_admin_or_above(organization_id));

-- Platform owners and org admins can update inquiry status (e.g. new -> in_review -> contacted)
create policy partner_inquiries_update on partner_inquiries
  for update using (is_org_admin_or_above(organization_id));

-- Platform owners and org admins can delete or archive inquiries
create policy partner_inquiries_delete on partner_inquiries
  for delete using (is_org_admin_or_above(organization_id));

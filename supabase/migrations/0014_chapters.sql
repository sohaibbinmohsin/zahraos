-- 0014_chapters.sql — chapters as a platform-owned org sub-division, used to
-- scope admin access. See docs/superpowers/specs/2026-09-06-chapter-scoped-access-design.md.

create table chapters (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  name             text not null,
  city             text,
  status           text not null default 'active' check (status in ('active', 'inactive')),
  created_at       timestamptz not null default now(),
  created_by       uuid references staff(id),
  unique (organization_id, name)
);
create index chapters_org_idx on chapters (organization_id);

alter table chapters enable row level security;
create policy chapters_select on chapters
  for select using (is_platform_owner() or is_org_admin_or_above(organization_id));
-- no insert/update/delete policy: writes go through service-role Edge Functions.

-- Remove dangling chapter-scoped assignments (test-fixture leftovers — the
-- chapter scope model is not yet in use for any real org) so the FK applies.
delete from staff_role_assignments sra
where sra.chapter_id is not null
  and not exists (select 1 from chapters c where c.id = sra.chapter_id);

-- staff_role_assignments.chapter_id was created as a bare uuid in 0013; the
-- repair above clears any orphaned chapter_id so the FK applies cleanly now.
alter table staff_role_assignments
  add constraint staff_role_assignments_chapter_fk
  foreign key (chapter_id) references chapters(id) on delete restrict;

-- Time-boxed staff access. null = permanent (ends only on manual deactivate).
alter table staff add column expires_at timestamptz;

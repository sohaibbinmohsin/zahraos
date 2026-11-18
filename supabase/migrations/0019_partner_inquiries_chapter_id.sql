-- 0019_partner_inquiries_chapter_id.sql
-- Optional chapter tagging for GroRizq (and other chapter-scoped) partner inquiries.
-- GroRizq website previously sent chapter_id against a table that lacked this column,
-- causing every production insert to fail.

alter table partner_inquiries
  add column if not exists chapter_id uuid references chapters(id) on delete set null;

create index if not exists partner_inquiries_org_chapter_created_idx
  on partner_inquiries (organization_id, chapter_id, created_at desc);

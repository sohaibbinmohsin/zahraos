alter table organizations
  add column brand_color text check (brand_color ~ '^#[0-9A-Fa-f]{6}$'),
  add column logo_url text,
  add column favicon_url text,
  add column about text;

alter table staff add column can_verify_identity boolean not null default false;

create table permissions (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references modules(id) on delete cascade,
  resource text not null,
  action text not null check (action in ('read', 'write', 'update', 'delete')),
  unique (module_id, resource, action)
);

insert into permissions (module_id, resource, action)
select m.id, r.resource, r.action
from modules m
cross join (values
  ('volunteers', 'read'), ('volunteers', 'update'),
  ('opportunities', 'read'), ('opportunities', 'write'), ('opportunities', 'update'), ('opportunities', 'delete'),
  ('applications', 'read'), ('applications', 'write'), ('applications', 'update'),
  ('participation', 'read'), ('participation', 'write'), ('participation', 'update'),
  ('hours', 'read'), ('hours', 'write'), ('hours', 'update'),
  ('chapters', 'read'), ('chapters', 'write'), ('chapters', 'update'), ('chapters', 'delete'),
  ('admin_action_log', 'read'),
  ('export', 'read')
) as r(resource, action)
where m.key = 'vms';

-- The VMS module is rebranded as Youth Republic. "vms" was never
-- user-facing outside this key, but it is the identifier every JWT claim
-- and permission check (both here and in vms-backend's handlers) is
-- keyed on, so the rename happens here rather than by inserting a new row.
update modules
set key = 'youth-republic', display_name = 'Youth Republic'
where key = 'vms';

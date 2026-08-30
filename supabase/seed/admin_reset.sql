-- tmp-partner-admin/supabase/seed/admin_reset.sql  — admin platform project
--
-- Run this against the admin platform Supabase project BEFORE running the
-- Youth Republic `seed.ts`.
--
-- Keep: `staff` (super-admin + admin), `roles`, `role_permissions`, `modules`,
-- `org_modules`. Only the org-scoped role grants and the organizations
-- themselves are cleared here.

delete from staff_org_roles;
delete from staff_module_roles;
truncate table organizations restart identity cascade;

-- After this runs, `seed.ts` re-inserts the four seed organizations with fixed
-- UUIDs (rizq / green-crescent / sehat-first / read-foundation) and re-grants
-- `staff_org_roles`: the super-admin staff (platform_owner = true) gets
-- `super_admin` on all four orgs, and the admin staff gets `admin` on Rizq.
--
-- NOTE: `truncate organizations ... cascade` also cascades into `org_modules`,
-- `roles`, `role_permissions` and `staff_module_roles` (all FK
-- `organization_id -> organizations(id) on delete cascade`). `seed.ts` does not
-- rebuild module enablement or system roles, so if the current org rows do not
-- already carry the fixed seed UUIDs, module/role wiring must be re-run
-- afterwards (enable-module + seed_system_roles_for_module per org).

-- Fix for infinite recursion discovered while implementing Task 10's RLS
-- policies: staff-derived RLS policies (0009_rls.sql) call these helper
-- functions, and each function's own body queries staff/staff_org_roles.
-- Left as `security invoker` (the default), evaluating the policy
-- re-invokes the function, which re-queries staff, which re-evaluates the
-- same policy — infinite recursion / "stack depth limit exceeded". `security
-- definer` makes the function's internal queries run as the defining role,
-- bypassing RLS on that inner query and breaking the cycle. `set
-- search_path = public` is pinned to close the standard security-definer
-- search-path hijack vector.
--
-- This is a separate migration (not folded into 0009_rls.sql) because
-- 0009 was already applied to the linked hosted project before this bug
-- was discovered by re-running the full pgTAP suite, and `supabase db push
-- --linked` treats an already-recorded migration version as up to date
-- regardless of local content changes -- editing 0009 in place would never
-- actually reach the remote database without repairing migration history,
-- which this run's operating constraints do not permit doing directly.
alter function current_staff_id() security definer set search_path = public;
alter function is_platform_owner() security definer set search_path = public;
alter function staff_org_tier(uuid) security definer set search_path = public;
alter function is_org_admin_or_above(uuid) security definer set search_path = public;

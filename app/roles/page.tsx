"use client";

import { useCallback, useEffect, useState } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { useSelectedOrg } from "@/components/shell/AppShell";
import { RolesList, type RoleSummary } from "@/components/RolesList";
import { CreateCustomRoleForm, type ModuleOption, type PermissionOption } from "@/components/CreateCustomRoleForm";
import { AssignStaffModuleRoleForm, type StaffOption, type RoleOption } from "@/components/AssignStaffModuleRoleForm";

export default function RolesPage() {
  const organizationId = useSelectedOrg();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [roles, setRoles] = useState<RoleSummary[]>([]);
  const [modules, setModules] = useState<ModuleOption[]>([]);
  const [permissionsByModuleId, setPermissionsByModuleId] = useState<Record<string, PermissionOption[]>>({});
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [roleOptionsByModuleId, setRoleOptionsByModuleId] = useState<Record<string, RoleOption[]>>({});

  const load = useCallback(async () => {
    if (!organizationId) return;
    const supabase = getBrowserSupabaseClient();
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) return;
    setAccessToken(sessionData.session.access_token);

    const { data: orgModuleRows } = await supabase
      .from("org_modules")
      .select("module_id, modules(id, key)")
      .eq("organization_id", organizationId);
    const enabledModules = (orgModuleRows ?? []).map((r) => r.modules as unknown as ModuleOption);
    setModules(enabledModules);

    const { data: roleRows } = await supabase
      .from("roles")
      .select("id, name, is_system, module_id, modules(key)")
      .eq("organization_id", organizationId);
    setRoles(
      (roleRows ?? []).map((r) => ({
        id: r.id,
        name: r.name,
        isSystem: r.is_system,
        moduleKey: (r.modules as unknown as { key: string }).key,
      })),
    );

    const permsByModule: Record<string, PermissionOption[]> = {};
    const rolesByModule: Record<string, RoleOption[]> = {};
    for (const module of enabledModules) {
      const { data: perms } = await supabase.from("permissions").select("id, resource, action").eq("module_id", module.id);
      permsByModule[module.id] = perms ?? [];
      rolesByModule[module.id] = (roleRows ?? [])
        .filter((r) => r.module_id === module.id)
        .map((r) => ({ id: r.id, name: r.name }));
    }
    setPermissionsByModuleId(permsByModule);
    setRoleOptionsByModuleId(rolesByModule);

    const { data: orgTierRows } = await supabase.from("staff_org_roles").select("staff_id").eq("organization_id", organizationId);
    const { data: moduleRoleRows } = await supabase.from("staff_module_roles").select("staff_id").eq("organization_id", organizationId);
    const staffIds = new Set<string>([...(orgTierRows ?? []).map((r) => r.staff_id), ...(moduleRoleRows ?? []).map((r) => r.staff_id)]);
    if (staffIds.size > 0) {
      const { data: staffRows } = await supabase.from("staff").select("id, full_name").in("id", Array.from(staffIds));
      setStaffOptions((staffRows ?? []).map((s) => ({ id: s.id, fullName: s.full_name })));
    } else {
      setStaffOptions([]);
    }
  }, [organizationId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!organizationId) {
    return <p>Select an organization to manage its roles.</p>;
  }

  if (!accessToken) {
    return <p>Loading…</p>;
  }

  if (modules.length === 0) {
    return <p>No modules are enabled for this organization yet — enable one from Organizations first.</p>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="mb-4 text-xl font-semibold">Roles</h1>
        <RolesList roles={roles} />
      </div>
      <div>
        <h2 className="mb-2 text-lg font-medium">Create custom role</h2>
        <CreateCustomRoleForm
          organizationId={organizationId}
          modules={modules}
          permissionsByModuleId={permissionsByModuleId}
          accessToken={accessToken}
          onCreated={load}
        />
      </div>
      <div>
        <h2 className="mb-2 text-lg font-medium">Assign staff a module role</h2>
        {staffOptions.length === 0 ? (
          <p className="text-sm text-gray-600">No staff in this organization yet — create one on the Staff page first.</p>
        ) : (
          <AssignStaffModuleRoleForm
            organizationId={organizationId}
            staffOptions={staffOptions}
            moduleOptions={modules}
            roleOptionsByModuleId={roleOptionsByModuleId}
            accessToken={accessToken}
            onAssigned={load}
          />
        )}
      </div>
    </div>
  );
}

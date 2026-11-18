export type InquiryAccess = "none" | "read" | "write";

export interface InquiryAssignmentRecord {
  scopeKind: string | null;
  roleName: string | null;
  permissions: Array<{ resource: string; action: string }>;
}

type PermRow = { resource?: string | null; action?: string | null };
type RolePermRow = { permissions?: PermRow | PermRow[] | null };
type RoleRow = { id?: string | null; name?: string | null; role_permissions?: RolePermRow | RolePermRow[] | null };

function first<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function permissionsOf(role: RoleRow | null): Array<{ resource: string; action: string }> {
  const raw = role?.role_permissions;
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const out: Array<{ resource: string; action: string }> = [];
  for (const row of list) {
    const perm = first(row?.permissions ?? null);
    if (!perm?.resource || !perm.action) continue;
    out.push({ resource: perm.resource, action: perm.action });
  }
  return out;
}

export function normalizeInquiryAssignments(
  rows: Array<{ scope_kind?: string | null; roles?: RoleRow | RoleRow[] | null }> | null | undefined,
): InquiryAssignmentRecord[] {
  return (rows ?? []).map((row) => {
    const role = first(row.roles ?? null);
    return {
      scopeKind: row.scope_kind ?? null,
      roleName: role?.name ?? null,
      permissions: permissionsOf(role),
    };
  });
}

/**
 * Partner inquiries are organization-wide. Chapter-scoped assignments do not
 * grant the list. Org Admin / Super Admin and inquiries:read|write do.
 */
export function inquiryAccessFromRecords(input: {
  platformOwner: boolean;
  staffStatus: string | null;
  orgTier: string | null;
  assignments: InquiryAssignmentRecord[];
}): InquiryAccess {
  if (!input.staffStatus || input.staffStatus === "deactivated") return "none";
  if (input.platformOwner) return "write";
  if (input.orgTier === "super_admin" || input.orgTier === "admin") return "write";

  let canRead = false;
  for (const assignment of input.assignments) {
    const orgWide = assignment.scopeKind === "org_wide";
    if (assignment.roleName === "Super Admin") return "write";
    if (assignment.roleName === "Org Admin" && orgWide) return "write";
    if (!orgWide) continue;
    for (const perm of assignment.permissions) {
      if (perm.resource === "inquiries" && perm.action === "write") return "write";
      if (perm.resource === "inquiries" && perm.action === "read") canRead = true;
    }
  }
  return canRead ? "read" : "none";
}

export async function resolveInquiryAccess(
  // Service-role client. Loose on purpose: the query builder is chained differently per table.
  supabaseAdmin: { from: (table: string) => any },
  callerStaffId: string,
  organizationId: string,
  platformOwner: boolean,
): Promise<InquiryAccess> {
  const { data: staff, error: staffError } = await supabaseAdmin
    .from("staff")
    .select("status")
    .eq("id", callerStaffId)
    .maybeSingle();
  if (staffError) throw new Error(staffError.message);

  const { data: orgRole, error: orgRoleError } = await supabaseAdmin
    .from("staff_org_roles")
    .select("org_tier")
    .eq("staff_id", callerStaffId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (orgRoleError) throw new Error(orgRoleError.message);

  const { data: assignmentRows, error: assignmentError } = await supabaseAdmin
    .from("staff_role_assignments")
    .select("role_id, scope_kind")
    .eq("staff_id", callerStaffId)
    .eq("organization_id", organizationId);
  if (assignmentError) throw new Error(assignmentError.message);

  const roleIds = [...new Set(
    (assignmentRows ?? [])
      .map((row: { role_id?: string | null }) => row.role_id)
      .filter((id: string | null | undefined): id is string => Boolean(id)),
  )];

  let roles: RoleRow[] = [];
  if (roleIds.length > 0) {
    const { data, error } = await supabaseAdmin
      .from("roles")
      .select("id, name, role_permissions(permissions(resource, action))")
      .in("id", roleIds);
    if (error) throw new Error(error.message);
    roles = data ?? [];
  }

  const rolesById = new Map(roles.map((role) => [role.id, role]));
  const assignments = (assignmentRows ?? []).map((row: { role_id?: string | null; scope_kind?: string | null }) => ({
    scope_kind: row.scope_kind,
    roles: rolesById.get(row.role_id ?? undefined) ?? null,
  }));

  return inquiryAccessFromRecords({
    platformOwner,
    staffStatus: typeof staff?.status === "string" ? staff.status : null,
    orgTier: typeof orgRole?.org_tier === "string" ? orgRole.org_tier : null,
    assignments: normalizeInquiryAssignments(assignments),
  });
}

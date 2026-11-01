import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { decodeStaffTokenClaims } from "@/lib/staffToken";
import { gridToPermissionKeys } from "@/lib/capabilityMap";

async function checkIsOrgAdmin(
  supabaseAdmin: any,
  callerStaffId: string,
  callerPlatformOwner: boolean,
  organizationId: string
): Promise<boolean> {
  if (callerPlatformOwner) return true;

  const { data: orgRole } = await (supabaseAdmin
    .from("staff_org_roles") as any)
    .select("org_tier")
    .eq("staff_id", callerStaffId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (orgRole && ["admin", "super_admin"].includes((orgRole as any).org_tier)) {
    return true;
  }

  const { data: assignments } = await (supabaseAdmin
    .from("staff_role_assignments") as any)
    .select("role_id, scope_kind")
    .eq("staff_id", callerStaffId)
    .eq("organization_id", organizationId);

  if (assignments && assignments.length > 0) {
    const roleIds = [...new Set(assignments.map((a: any) => a.role_id))];
    const { data: roles } = await (supabaseAdmin
      .from("roles") as any)
      .select("id, name, role_permissions(permissions(resource, action))")
      .in("id", roleIds);

    for (const r of (roles ?? []) as any[]) {
      if (["Super Admin", "Org Admin", "Organization Admin"].includes(r.name)) {
        return true;
      }
      const hasRoleWrite = (r.role_permissions ?? []).some(
        (rp: any) => rp.permissions?.resource === "roles" && rp.permissions?.action === "write"
      );
      if (hasRoleWrite) return true;
    }
  }

  return false;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ name: string }> }
) {
  const { name } = await context.params;

  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "missing_authorization" }, { status: 401 });
  }
  const token = authHeader.slice("Bearer ".length).trim();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  let callerStaffId: string | null = null;
  let callerPlatformOwner = false;

  // 1. Try resolving auth user via Supabase Auth
  const {
    data: { user },
  } = await supabaseAdmin.auth.getUser(token);

  if (user) {
    const { data: staff } = await supabaseAdmin
      .from("staff")
      .select("id, platform_owner")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (staff) {
      callerStaffId = staff.id;
      callerPlatformOwner = Boolean(staff.platform_owner);
    }
  }

  // 2. If not a user JWT, try decoding as a minted staff token
  if (!callerStaffId) {
    try {
      const claims = decodeStaffTokenClaims(token);
      if (claims?.staffId) {
        callerStaffId = claims.staffId;
        callerPlatformOwner = Boolean(claims.platformOwner);
      }
    } catch {
      // not a staff token
    }
  }

  if (!callerStaffId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Handle list-chapters
  if (name === "list-chapters") {
    const body = await request.json().catch(() => ({}));
    const organizationId = body.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: "organization_id_required" }, { status: 400 });
    }

    if (!callerPlatformOwner) {
      const { data: orgRole } = await supabaseAdmin
        .from("staff_org_roles")
        .select("org_tier")
        .eq("staff_id", callerStaffId)
        .eq("organization_id", organizationId)
        .maybeSingle();

      const isOrgAdmin = orgRole && ["admin", "super_admin"].includes(orgRole.org_tier);

      if (!isOrgAdmin) {
        const { data: assignments } = await supabaseAdmin
          .from("staff_role_assignments")
          .select("id")
          .eq("staff_id", callerStaffId)
          .eq("organization_id", organizationId)
          .limit(1);

        if (!assignments || assignments.length === 0) {
          return NextResponse.json({ error: "forbidden" }, { status: 403 });
        }
      }
    }

    const { data, error } = await supabaseAdmin
      .from("chapters")
      .select("id, name, city, status, logo_url, about")
      .eq("organization_id", organizationId)
      .order("name");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const chapters = (data ?? []).map((c: any) => ({
      id: c.id,
      name: c.name,
      city: c.city ?? null,
      status: c.status,
      logoUrl: c.logo_url ?? null,
      about: c.about ?? null,
    }));

    return NextResponse.json({ chapters });
  }

  // Handle update-chapter
  if (name === "update-chapter") {
    const body = await request.json().catch(() => ({}));
    const { chapterId, name: chapterName, city, status, logoUrl, about, teamMembers } = body;
    if (!chapterId) {
      return NextResponse.json({ error: "chapter_id_required" }, { status: 400 });
    }

    const { data: chapter, error: fetchError } = await supabaseAdmin
      .from("chapters")
      .select("id, organization_id, name, status")
      .eq("id", chapterId)
      .single();

    if (fetchError || !chapter) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    let callerIsOrgAdminOrAbove = false;

    if (!callerPlatformOwner) {
      const authorizedRoleNames = ["Org Admin", "Chapter Admin", "Chapter Lead", "City Lead"];
      let isAuthorized = false;

      const { data: orgRole } = await supabaseAdmin
        .from("staff_org_roles")
        .select("org_tier")
        .eq("staff_id", callerStaffId)
        .eq("organization_id", chapter.organization_id)
        .maybeSingle();

      if (orgRole && ["admin", "super_admin"].includes(orgRole.org_tier)) {
        isAuthorized = true;
        callerIsOrgAdminOrAbove = true;
      }

      if (!callerIsOrgAdminOrAbove) {
        const { data: assignments } = await supabaseAdmin
          .from("staff_role_assignments")
          .select("role_id, scope_kind, chapter_id")
          .eq("staff_id", callerStaffId)
          .eq("organization_id", chapter.organization_id);

        if (assignments && assignments.length > 0) {
          const roleIds = [...new Set(assignments.map((a: any) => a.role_id))];
          const { data: roles } = await supabaseAdmin
            .from("roles")
            .select("id, name")
            .in("id", roleIds);

          const roleMap = new Map((roles ?? []).map((r: any) => [r.id, r.name]));

          for (const a of assignments) {
            const rName = roleMap.get(a.role_id);
            if (rName === "Super Admin" || (rName === "Org Admin" && a.scope_kind === "org_wide")) {
              isAuthorized = true;
              callerIsOrgAdminOrAbove = true;
              break;
            }
            if (
              authorizedRoleNames.includes(rName || "") &&
              a.scope_kind === "chapter" &&
              a.chapter_id === chapterId
            ) {
              isAuthorized = true;
            }
          }
        }
      }

      if (!isAuthorized) {
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
      }

      if (status !== undefined && status !== chapter.status && !callerIsOrgAdminOrAbove) {
        return NextResponse.json({ error: "forbidden_status_change" }, { status: 403 });
      }
    }

    const updates: Record<string, unknown> = {};
    if (chapterName !== undefined) updates.name = chapterName.trim();
    if (city !== undefined) updates.city = city?.trim() || null;
    if (status !== undefined) updates.status = status;
    if (logoUrl !== undefined) updates.logo_url = logoUrl?.trim() || null;
    if (about !== undefined) updates.about = about?.trim() || null;

    if (Object.keys(updates).length > 0) {
      const { error: updateErr } = await supabaseAdmin
        .from("chapters")
        .update(updates)
        .eq("id", chapterId);

      if (updateErr) {
        if (updateErr.code === "23505") {
          return NextResponse.json({ error: "chapter_name_taken" }, { status: 409 });
        }
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }
    }

    if (teamMembers !== undefined && Array.isArray(teamMembers)) {
      const { data: existingRows, error: fetchMembersError } = await supabaseAdmin
        .from("chapter_team_members")
        .select("id, volunteer_code, term")
        .eq("chapter_id", chapterId);

      if (fetchMembersError) {
        return NextResponse.json({ error: fetchMembersError.message }, { status: 500 });
      }

      const existingList = existingRows ?? [];
      const existingKeyMap = new Map<string, string>();
      for (const row of existingList) {
        const key = `${(row.volunteer_code as string).toUpperCase()}::${row.term ?? ""}`;
        existingKeyMap.set(key, row.id);
      }

      const incomingKeys = new Set<string>();
      const toUpsertMap = new Map<string, Record<string, unknown>>();

      for (const m of teamMembers) {
        const normalizedCode = (m.volunteerCode || "").trim().toUpperCase();
        const term = m.term?.trim() || null;
        const key = `${normalizedCode}::${term ?? ""}`;
        incomingKeys.add(key);

        const existingId = existingKeyMap.get(key);
        toUpsertMap.set(key, {
          id: existingId ?? crypto.randomUUID(),
          chapter_id: chapterId,
          volunteer_code: normalizedCode,
          full_name: (m.fullName || "").trim(),
          email: m.email?.trim() || null,
          avatar_url: m.avatarUrl?.trim() || null,
          designation: (m.designation || "").trim(),
          term,
          status: m.status || "active",
          created_by: callerStaffId,
        });
      }

      const toUpsert = Array.from(toUpsertMap.values());

      const idsToDelete = existingList
        .filter((row) => !incomingKeys.has(`${(row.volunteer_code as string).toUpperCase()}::${row.term ?? ""}`))
        .map((row) => row.id);

      if (idsToDelete.length > 0) {
        const { error: delError } = await supabaseAdmin
          .from("chapter_team_members")
          .delete()
          .in("id", idsToDelete);
        if (delError) {
          return NextResponse.json({ error: delError.message }, { status: 500 });
        }
      }

      if (toUpsert.length > 0) {
        const { error: upsertError } = await supabaseAdmin
          .from("chapter_team_members")
          .upsert(toUpsert);
        if (upsertError) {
          return NextResponse.json({ error: upsertError.message }, { status: 500 });
        }
      }
    }

    return NextResponse.json({ chapterId });
  }

  // Handle list-chapter-team-members
  if (name === "list-chapter-team-members") {
    const body = await request.json().catch(() => ({}));
    const { chapterId } = body;
    if (!chapterId) {
      return NextResponse.json({ error: "chapter_id_required" }, { status: 400 });
    }

    const { data: chapter, error: chapterError } = await supabaseAdmin
      .from("chapters")
      .select("id, organization_id")
      .eq("id", chapterId)
      .single();

    if (chapterError || !chapter) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    if (!callerPlatformOwner) {
      const { data: orgRole } = await supabaseAdmin
        .from("staff_org_roles")
        .select("org_tier")
        .eq("staff_id", callerStaffId)
        .eq("organization_id", chapter.organization_id)
        .maybeSingle();

      if (!orgRole) {
        const { data: assignments } = await supabaseAdmin
          .from("staff_role_assignments")
          .select("id")
          .eq("staff_id", callerStaffId)
          .eq("organization_id", chapter.organization_id)
          .limit(1);

        if (!assignments || assignments.length === 0) {
          return NextResponse.json({ error: "forbidden" }, { status: 403 });
        }
      }
    }

    const { data, error } = await supabaseAdmin
      .from("chapter_team_members")
      .select("id, chapter_id, volunteer_code, full_name, email, avatar_url, designation, term, status, created_at, created_by")
      .eq("chapter_id", chapterId)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const teamMembers = (data ?? []).map((m: any) => ({
      id: m.id,
      chapterId: m.chapter_id,
      volunteerCode: m.volunteer_code,
      fullName: m.full_name,
      email: m.email ?? null,
      avatarUrl: m.avatar_url ?? null,
      designation: m.designation,
      term: m.term ?? null,
      status: m.status,
      createdAt: m.created_at,
      createdBy: m.created_by ?? null,
    }));

    return NextResponse.json({ teamMembers });
  }

  // Handle create-custom-role
  if (name === "create-custom-role") {
    const body = await request.json().catch(() => ({}));
    const { organizationId, moduleId, name: roleName, description, capabilities } = body;
    if (!organizationId || !moduleId || !roleName?.trim()) {
      return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
    }

    const isAuthorized = await checkIsOrgAdmin(supabaseAdmin, callerStaffId, callerPlatformOwner, organizationId);
    if (!isAuthorized) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const { data: orgModule } = await supabaseAdmin
      .from("org_modules")
      .select("module_id")
      .eq("organization_id", organizationId)
      .eq("module_id", moduleId)
      .maybeSingle();

    if (!orgModule) {
      return NextResponse.json({ error: "module_not_enabled" }, { status: 400 });
    }

    const keys = gridToPermissionKeys(capabilities ?? {});
    let permissionIds: string[] = [];
    if (keys.length > 0) {
      const { data: perms } = await supabaseAdmin
        .from("permissions")
        .select("id, resource, action")
        .eq("module_id", moduleId);

      const byKey = new Map((perms ?? []).map((p: any) => [`${p.resource}:${p.action}`, p.id as string]));
      permissionIds = keys.map((k) => byKey.get(k)).filter(Boolean) as string[];
    }

    const { data: role, error: roleError } = await supabaseAdmin
      .from("roles")
      .insert({
        organization_id: organizationId,
        module_id: moduleId,
        name: roleName.trim(),
        description: description || null,
        is_system: false,
      })
      .select("id")
      .single();

    if (roleError) {
      if (roleError.code === "23505") {
        return NextResponse.json({ error: "role_name_taken" }, { status: 400 });
      }
      return NextResponse.json({ error: roleError.message }, { status: 500 });
    }

    if (permissionIds.length > 0) {
      const { error: permError } = await supabaseAdmin
        .from("role_permissions")
        .insert(permissionIds.map((permission_id) => ({ role_id: role.id, permission_id })));

      if (permError) {
        return NextResponse.json({ error: permError.message }, { status: 500 });
      }
    }

    try {
      const { data: actor } = await supabaseAdmin.from("staff").select("full_name").eq("id", callerStaffId).maybeSingle();
      await supabaseAdmin.from("admin_audit_log").insert({
        organization_id: organizationId,
        actor_staff_id: callerStaffId,
        actor_name: actor?.full_name ?? "Admin",
        action: "Role Created",
        entity_type: "role",
        entity_id: role.id,
        summary: `Created custom role '${roleName.trim()}'`,
      });
    } catch {
      // ignore
    }

    return NextResponse.json({ roleId: role.id }, { status: 201 });
  }

  // Handle update-custom-role
  if (name === "update-custom-role") {
    const body = await request.json().catch(() => ({}));
    const { roleId, name: roleName, description, capabilities } = body;
    if (!roleId || !roleName?.trim()) {
      return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
    }

    const { data: role, error: fetchError } = await supabaseAdmin
      .from("roles")
      .select("id, organization_id, module_id, is_system")
      .eq("id", roleId)
      .single();

    if (fetchError || !role) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    if (role.is_system) {
      return NextResponse.json({ error: "system_role_immutable" }, { status: 400 });
    }

    const isAuthorized = await checkIsOrgAdmin(supabaseAdmin, callerStaffId, callerPlatformOwner, role.organization_id);
    if (!isAuthorized) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const keys = gridToPermissionKeys(capabilities ?? {});
    let permissionIds: string[] = [];
    if (keys.length > 0) {
      const { data: perms } = await supabaseAdmin
        .from("permissions")
        .select("id, resource, action")
        .eq("module_id", role.module_id);

      const byKey = new Map((perms ?? []).map((p: any) => [`${p.resource}:${p.action}`, p.id as string]));
      permissionIds = keys.map((k) => byKey.get(k)).filter(Boolean) as string[];
    }

    const { error: updateError } = await supabaseAdmin
      .from("roles")
      .update({
        name: roleName.trim(),
        description: description || null,
      })
      .eq("id", roleId);

    if (updateError) {
      if (updateError.code === "23505") {
        return NextResponse.json({ error: "role_name_taken" }, { status: 400 });
      }
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    await supabaseAdmin.from("role_permissions").delete().eq("role_id", roleId);
    if (permissionIds.length > 0) {
      const { error: permError } = await supabaseAdmin
        .from("role_permissions")
        .insert(permissionIds.map((permission_id) => ({ role_id: roleId, permission_id })));

      if (permError) {
        return NextResponse.json({ error: permError.message }, { status: 500 });
      }
    }

    try {
      const { data: actor } = await supabaseAdmin.from("staff").select("full_name").eq("id", callerStaffId).maybeSingle();
      await supabaseAdmin.from("admin_audit_log").insert({
        organization_id: role.organization_id,
        actor_staff_id: callerStaffId,
        actor_name: actor?.full_name ?? "Admin",
        action: "Role Modified",
        entity_type: "role",
        entity_id: roleId,
        summary: `Updated custom role permissions for '${roleName.trim()}'`,
      });
    } catch {
      // ignore
    }

    return NextResponse.json({ roleId });
  }

  // Handle delete-custom-role
  if (name === "delete-custom-role") {
    const body = await request.json().catch(() => ({}));
    const { roleId } = body;
    if (!roleId) {
      return NextResponse.json({ error: "role_id_required" }, { status: 400 });
    }

    const { data: role, error: fetchError } = await supabaseAdmin
      .from("roles")
      .select("id, organization_id, name, is_system")
      .eq("id", roleId)
      .single();

    if (fetchError || !role) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    if (role.is_system) {
      return NextResponse.json({ error: "system_role_immutable" }, { status: 400 });
    }

    const isAuthorized = await checkIsOrgAdmin(supabaseAdmin, callerStaffId, callerPlatformOwner, role.organization_id);
    if (!isAuthorized) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const { count } = await supabaseAdmin
      .from("staff_role_assignments")
      .select("*", { count: "exact", head: true })
      .eq("role_id", roleId);

    if ((count ?? 0) > 0) {
      return NextResponse.json({ error: "role_in_use" }, { status: 400 });
    }

    await supabaseAdmin.from("role_permissions").delete().eq("role_id", roleId);
    const { error: delError } = await supabaseAdmin.from("roles").delete().eq("id", roleId);
    if (delError) {
      return NextResponse.json({ error: delError.message }, { status: 500 });
    }

    try {
      const { data: actor } = await supabaseAdmin.from("staff").select("full_name").eq("id", callerStaffId).maybeSingle();
      await supabaseAdmin.from("admin_audit_log").insert({
        organization_id: role.organization_id,
        actor_staff_id: callerStaffId,
        actor_name: actor?.full_name ?? "Admin",
        action: "Role Modified",
        entity_type: "role",
        entity_id: roleId,
        summary: `Deleted custom role '${role.name}'`,
      });
    } catch {
      // ignore
    }

    return NextResponse.json({ roleId });
  }

  return NextResponse.json({ error: "not_found" }, { status: 404 });
}

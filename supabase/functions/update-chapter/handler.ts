import { SupabaseClient } from "@supabase/supabase-js";
import { actorName, writeAuditLog } from "../_shared/auditLog.ts";

export interface ChapterTeamMemberInput {
  volunteerCode: string;
  fullName: string;
  email?: string | null;
  avatarUrl?: string | null;
  designation: string;
  term?: string | null;
  status: "active" | "alumni";
}

export interface UpdateChapterInput {
  chapterId: string;
  name?: string;
  city?: string | null;
  status?: "active" | "inactive";
  logoUrl?: string | null;
  about?: string | null;
  teamMembers?: ChapterTeamMemberInput[];
}

export async function updateChapter(
  supabase: SupabaseClient,
  callerStaffId: string,
  callerPlatformOwner: boolean,
  input: UpdateChapterInput,
): Promise<{ chapterId: string }> {
  const { data: chapter, error: fetchError } = await supabase
    .from("chapters")
    .select("id, organization_id, name")
    .eq("id", input.chapterId)
    .single();
  if (fetchError || !chapter) throw new Error("not_found");

  if (!callerPlatformOwner) {
    let isAuthorized = false;

    // 1. Check org-level admin tier (Super Admin or National Org Admin)
    const { data: orgRole } = await supabase
      .from("staff_org_roles")
      .select("org_tier")
      .eq("staff_id", callerStaffId)
      .eq("organization_id", chapter.organization_id)
      .maybeSingle();

    if (orgRole && ["admin", "super_admin"].includes(orgRole.org_tier)) {
      isAuthorized = true;
    }

    // 2. Check role assignments
    if (!isAuthorized) {
      const { data: assignments } = await supabase
        .from("staff_role_assignments")
        .select("role_id, scope_kind, chapter_id")
        .eq("staff_id", callerStaffId)
        .eq("organization_id", chapter.organization_id);

      if (assignments && assignments.length > 0) {
        const roleIds = [...new Set(assignments.map((a) => a.role_id))];
        const { data: roles } = await supabase
          .from("roles")
          .select("id, name")
          .in("id", roleIds);

        const roleMap = new Map((roles ?? []).map((r) => [r.id, r.name]));

        for (const a of assignments) {
          const roleName = roleMap.get(a.role_id);
          // Super Admin is always org-wide
          if (roleName === "Super Admin") {
            isAuthorized = true;
            break;
          }
          // Org Admin with org_wide scope (National Org Admin)
          if (roleName === "Org Admin" && a.scope_kind === "org_wide") {
            isAuthorized = true;
            break;
          }
          // Chapter Admin whose assigned chapter matches input.chapterId
          if (
            (roleName === "Org Admin" || roleName === "Chapter Admin") &&
            a.scope_kind === "chapter" &&
            a.chapter_id === input.chapterId
          ) {
            isAuthorized = true;
            break;
          }
        }
      }
    }

    if (!isAuthorized) throw new Error("forbidden");
  }

  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.city !== undefined) patch.city = input.city?.trim() || null;
  if (input.status !== undefined) patch.status = input.status;
  if (input.logoUrl !== undefined) patch.logo_url = input.logoUrl?.trim() || null;
  if (input.about !== undefined) patch.about = input.about?.trim() || null;

  if (Object.keys(patch).length === 0 && input.teamMembers === undefined) {
    return { chapterId: input.chapterId };
  }

  if (Object.keys(patch).length > 0) {
    const { error } = await supabase.from("chapters").update(patch).eq("id", input.chapterId);
    if (error) {
      if (error.code === "23505") throw new Error("chapter_name_taken");
      throw error;
    }
  }

  if (patch.name && patch.name !== chapter.name) {
    await supabase
      .from("staff_role_assignments")
      .update({ scope_label: patch.name })
      .eq("chapter_id", input.chapterId);
  }

  // Atomically synchronize chapter_team_members if teamMembers is provided
  if (input.teamMembers !== undefined) {
    const { data: existingRows, error: fetchMembersError } = await supabase
      .from("chapter_team_members")
      .select("id, volunteer_code, term")
      .eq("chapter_id", input.chapterId);

    if (fetchMembersError) throw fetchMembersError;

    const existingList = existingRows ?? [];
    const existingKeyMap = new Map<string, string>();
    for (const row of existingList) {
      const key = `${(row.volunteer_code as string).toUpperCase()}::${row.term ?? ""}`;
      existingKeyMap.set(key, row.id);
    }

    const incomingKeys = new Set<string>();
    const toUpsert: Array<Record<string, unknown>> = [];

    for (const m of input.teamMembers) {
      const normalizedCode = m.volunteerCode.trim().toUpperCase();
      const term = m.term?.trim() || null;
      const key = `${normalizedCode}::${term ?? ""}`;
      incomingKeys.add(key);

      const existingId = existingKeyMap.get(key);
      toUpsert.push({
        ...(existingId ? { id: existingId } : {}),
        chapter_id: input.chapterId,
        volunteer_code: normalizedCode,
        full_name: m.fullName.trim(),
        email: m.email?.trim() || null,
        avatar_url: m.avatarUrl?.trim() || null,
        designation: m.designation.trim(),
        term,
        status: m.status,
        created_by: callerStaffId,
      });
    }

    const idsToDelete = existingList
      .filter((row) => !incomingKeys.has(`${(row.volunteer_code as string).toUpperCase()}::${row.term ?? ""}`))
      .map((row) => row.id);

    if (idsToDelete.length > 0) {
      const { error: delError } = await supabase
        .from("chapter_team_members")
        .delete()
        .in("id", idsToDelete);
      if (delError) throw delError;
    }

    if (toUpsert.length > 0) {
      const { error: upsertError } = await supabase
        .from("chapter_team_members")
        .upsert(toUpsert);
      if (upsertError) throw upsertError;
    }
  }

  await writeAuditLog(supabase, {
    organizationId: chapter.organization_id,
    actorStaffId: callerStaffId,
    actorName: await actorName(supabase, callerStaffId),
    action: "Chapter Updated",
    entityType: "chapter",
    entityId: input.chapterId,
    summary: `Updated chapter '${(patch.name as string) ?? chapter.name}'`,
  });

  return { chapterId: input.chapterId };
}

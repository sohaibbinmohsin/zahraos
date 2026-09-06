import { SupabaseClient } from "@supabase/supabase-js";
import { actorName, writeAuditLog } from "../_shared/auditLog.ts";

export interface UpdateChapterInput {
  chapterId: string;
  name?: string;
  city?: string | null;
  status?: "active" | "inactive";
}

export async function updateChapter(
  supabase: SupabaseClient,
  callerStaffId: string,
  callerPlatformOwner: boolean,
  input: UpdateChapterInput,
): Promise<{ chapterId: string }> {
  const { data: chapter, error: fetchError } = await supabase.from("chapters")
    .select("id, organization_id, name").eq("id", input.chapterId).single();
  if (fetchError || !chapter) throw new Error("not_found");

  if (!callerPlatformOwner) {
    const { data } = await supabase.from("staff_org_roles").select("org_tier")
      .eq("staff_id", callerStaffId).eq("organization_id", chapter.organization_id).single();
    if (!data || !["admin", "super_admin"].includes(data.org_tier)) throw new Error("forbidden");
  }

  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.city !== undefined) patch.city = input.city?.trim() || null;
  if (input.status !== undefined) patch.status = input.status;
  if (Object.keys(patch).length === 0) return { chapterId: input.chapterId };

  const { error } = await supabase.from("chapters").update(patch).eq("id", input.chapterId);
  if (error) {
    if (error.code === "23505") throw new Error("chapter_name_taken");
    throw error;
  }

  if (patch.name && patch.name !== chapter.name) {
    await supabase.from("staff_role_assignments").update({ scope_label: patch.name })
      .eq("chapter_id", input.chapterId);
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

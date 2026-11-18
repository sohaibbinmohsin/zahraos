import { SupabaseClient } from "@supabase/supabase-js";
import { actorName, writeAuditLog } from "../_shared/auditLog.ts";
import { assertCallerIsOrgAdminOrAbove } from "../_shared/orgAdminAuthz.ts";

export interface CreateChapterInput {
  organizationId: string;
  name: string;
  city?: string | null;
}

export async function createChapter(
  supabase: SupabaseClient,
  callerStaffId: string,
  callerPlatformOwner: boolean,
  input: CreateChapterInput,
): Promise<{ chapterId: string }> {
  await assertCallerIsOrgAdminOrAbove(supabase, callerStaffId, callerPlatformOwner, input.organizationId);
  if (!input.name?.trim()) throw new Error("missing_name");

  const { data: chapter, error } = await supabase.from("chapters").insert({
    organization_id: input.organizationId,
    name: input.name.trim(),
    city: input.city?.trim() || null,
    created_by: callerStaffId,
  }).select("id").single();
  if (error) {
    if (error.code === "23505") throw new Error("chapter_name_taken");
    throw error;
  }

  await writeAuditLog(supabase, {
    organizationId: input.organizationId,
    actorStaffId: callerStaffId,
    actorName: await actorName(supabase, callerStaffId),
    action: "Chapter Created",
    entityType: "chapter",
    entityId: chapter.id,
    summary: `Created chapter '${input.name.trim()}'`,
  });

  return { chapterId: chapter.id };
}

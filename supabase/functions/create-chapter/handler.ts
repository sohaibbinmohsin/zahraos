import { SupabaseClient } from "@supabase/supabase-js";
import { actorName, writeAuditLog } from "../_shared/auditLog.ts";

export interface CreateChapterInput {
  organizationId: string;
  name: string;
  city?: string | null;
}

async function assertCallerIsOrgAdmin(
  supabase: SupabaseClient, callerStaffId: string, callerPlatformOwner: boolean, organizationId: string,
): Promise<void> {
  if (callerPlatformOwner) return;
  const { data } = await supabase.from("staff_org_roles").select("org_tier")
    .eq("staff_id", callerStaffId).eq("organization_id", organizationId).single();
  if (!data || !["admin", "super_admin"].includes(data.org_tier)) throw new Error("forbidden");
}

export async function createChapter(
  supabase: SupabaseClient,
  callerStaffId: string,
  callerPlatformOwner: boolean,
  input: CreateChapterInput,
): Promise<{ chapterId: string }> {
  await assertCallerIsOrgAdmin(supabase, callerStaffId, callerPlatformOwner, input.organizationId);
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

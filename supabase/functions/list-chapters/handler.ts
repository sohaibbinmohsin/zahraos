import { SupabaseClient } from "@supabase/supabase-js";
import { assertCallerIsOrgAdminOrAbove } from "../_shared/orgAdminAuthz.ts";

export interface ListChaptersInput {
  organizationId: string;
}
export interface ChapterRow {
  id: string;
  name: string;
  city: string | null;
  status: string;
}

export async function listChapters(
  supabase: SupabaseClient,
  callerStaffId: string,
  callerPlatformOwner: boolean,
  input: ListChaptersInput,
): Promise<{ chapters: ChapterRow[] }> {
  await assertCallerIsOrgAdminOrAbove(supabase, callerStaffId, callerPlatformOwner, input.organizationId);
  const { data, error } = await supabase.from("chapters")
    .select("id, name, city, status")
    .eq("organization_id", input.organizationId)
    .order("name");
  if (error) throw error;
  return { chapters: (data ?? []) as ChapterRow[] };
}

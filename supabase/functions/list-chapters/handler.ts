import { SupabaseClient } from "@supabase/supabase-js";

export interface ListChaptersInput {
  organizationId: string;
}
export interface ChapterRow {
  id: string;
  name: string;
  city: string | null;
  status: string;
}

async function assertCallerIsOrgAdmin(
  supabase: SupabaseClient, callerStaffId: string, callerPlatformOwner: boolean, organizationId: string,
): Promise<void> {
  if (callerPlatformOwner) return;
  const { data } = await supabase.from("staff_org_roles").select("org_tier")
    .eq("staff_id", callerStaffId).eq("organization_id", organizationId).single();
  if (!data || !["admin", "super_admin"].includes(data.org_tier)) throw new Error("forbidden");
}

export async function listChapters(
  supabase: SupabaseClient,
  callerStaffId: string,
  callerPlatformOwner: boolean,
  input: ListChaptersInput,
): Promise<{ chapters: ChapterRow[] }> {
  await assertCallerIsOrgAdmin(supabase, callerStaffId, callerPlatformOwner, input.organizationId);
  const { data, error } = await supabase.from("chapters")
    .select("id, name, city, status")
    .eq("organization_id", input.organizationId)
    .order("name");
  if (error) throw error;
  return { chapters: (data ?? []) as ChapterRow[] };
}

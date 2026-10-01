import { SupabaseClient } from "@supabase/supabase-js";

export interface ListChapterTeamMembersInput {
  chapterId: string;
}

export interface ChapterTeamMemberRow {
  id: string;
  chapterId: string;
  volunteerCode: string;
  fullName: string;
  email: string | null;
  avatarUrl: string | null;
  designation: string;
  term: string | null;
  status: "active" | "alumni";
  createdAt: string;
  createdBy?: string | null;
}

export async function listChapterTeamMembers(
  supabase: SupabaseClient,
  callerStaffId: string,
  callerPlatformOwner: boolean,
  input: ListChapterTeamMembersInput,
): Promise<{ teamMembers: ChapterTeamMemberRow[] }> {
  const { data: chapter, error: chapterError } = await supabase
    .from("chapters")
    .select("id, organization_id")
    .eq("id", input.chapterId)
    .single();

  if (chapterError || !chapter) throw new Error("not_found");

  if (!callerPlatformOwner) {
    const { data: orgRole } = await supabase
      .from("staff_org_roles")
      .select("org_tier")
      .eq("staff_id", callerStaffId)
      .eq("organization_id", chapter.organization_id)
      .maybeSingle();

    if (!orgRole) {
      const { data: assignments } = await supabase
        .from("staff_role_assignments")
        .select("id")
        .eq("staff_id", callerStaffId)
        .eq("organization_id", chapter.organization_id)
        .limit(1);

      if (!assignments || assignments.length === 0) {
        throw new Error("forbidden");
      }
    }
  }

  const { data, error } = await supabase
    .from("chapter_team_members")
    .select("id, chapter_id, volunteer_code, full_name, email, avatar_url, designation, term, status, created_at, created_by")
    .eq("chapter_id", input.chapterId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const teamMembers: ChapterTeamMemberRow[] = (data ?? []).map((row) => ({
    id: row.id,
    chapterId: row.chapter_id,
    volunteerCode: row.volunteer_code,
    fullName: row.full_name,
    email: row.email,
    avatarUrl: row.avatar_url,
    designation: row.designation,
    term: row.term,
    status: row.status,
    createdAt: row.created_at,
    createdBy: row.created_by,
  }));

  return { teamMembers };
}

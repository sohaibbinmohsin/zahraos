import { SupabaseClient } from "@supabase/supabase-js";

export interface LookupYouthRepublicMemberInput {
  organizationId: string;
  youthRepublicId: string;
}

export interface YouthRepublicMemberResult {
  volunteerCode: string;
  fullName: string;
  email: string | null;
  avatarUrl: string | null;
}

export async function lookupYouthRepublicMember(
  supabase: SupabaseClient,
  callerStaffId: string,
  callerPlatformOwner: boolean,
  input: LookupYouthRepublicMemberInput,
): Promise<YouthRepublicMemberResult> {
  if (!input.organizationId || !input.youthRepublicId?.trim()) {
    throw new Error("volunteer_not_found");
  }

  // Caller permission: must be platform owner or associated with the organization
  if (!callerPlatformOwner) {
    const { data: orgRole } = await supabase
      .from("staff_org_roles")
      .select("org_tier")
      .eq("staff_id", callerStaffId)
      .eq("organization_id", input.organizationId)
      .maybeSingle();

    if (!orgRole) {
      const { data: assignments } = await supabase
        .from("staff_role_assignments")
        .select("id")
        .eq("staff_id", callerStaffId)
        .eq("organization_id", input.organizationId)
        .limit(1);

      if (!assignments || assignments.length === 0) {
        throw new Error("forbidden");
      }
    }
  }

  const queryCode = input.youthRepublicId.trim();

  // Query Youth Republic volunteers table case-insensitively
  const { data: volunteer, error } = await supabase
    .from("volunteers")
    .select("volunteer_code, full_name, email, profile_picture_url")
    .ilike("volunteer_code", queryCode)
    .maybeSingle();

  if (error || !volunteer) {
    throw new Error("volunteer_not_found");
  }

  return {
    volunteerCode: volunteer.volunteer_code,
    fullName: volunteer.full_name,
    email: volunteer.email ?? null,
    avatarUrl: volunteer.profile_picture_url ?? (volunteer as Record<string, unknown>).avatar_url as string ?? null,
  };
}

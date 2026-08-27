import { SupabaseClient } from "@supabase/supabase-js";

export async function verifyPlatformStaffSession(
  supabase: SupabaseClient,
  authHeader: string | null,
): Promise<{ staffId: string; platformOwner: boolean }> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("unauthorized");
  }
  const token = authHeader.slice("Bearer ".length);
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) {
    throw new Error("unauthorized");
  }

  const { data: staff, error: staffError } = await supabase
    .from("staff")
    .select("id, platform_owner")
    .eq("auth_user_id", userData.user.id)
    .single();
  if (staffError || !staff) {
    throw new Error("unauthorized");
  }

  return { staffId: staff.id, platformOwner: staff.platform_owner };
}

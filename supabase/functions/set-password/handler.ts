import { SupabaseClient } from "@supabase/supabase-js";

export async function setPassword(
  supabase: SupabaseClient,
  staffId: string,
  authUserId: string,
  newPassword: string,
): Promise<{ staffId: string }> {
  const { error: authError } = await supabase.auth.admin.updateUserById(authUserId, { password: newPassword });
  if (authError) throw authError;

  const { error: staffError } = await supabase
    .from("staff")
    .update({ must_change_password: false })
    .eq("id", staffId);
  if (staffError) throw staffError;

  return { staffId };
}

import { SupabaseClient } from "@supabase/supabase-js";

// Same sentence GoTrue returns for createUser on a live email, and the text
// the Add Team Member drawer toasts when that error reaches the client.
export const EMAIL_ALREADY_REGISTERED =
  "A user with this email address has already been registered";

export function isEmailAlreadyRegistered(error: { message?: string; code?: string }): boolean {
  const code = error.code ?? "";
  const message = error.message ?? "";
  return code === "email_exists" ||
    /already been registered|already registered|email address has already/i.test(message);
}

// PostgREST ilike patterns treat % and _ as wildcards. Escape them so an
// email lookup is an exact, case-insensitive match.
export function ilikeExactPattern(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

function blocksNewAccount(row: { status?: string; platform_owner?: boolean }): boolean {
  return row.platform_owner === true || row.status !== "deactivated";
}

function isMissingAuthUser(error: { message?: string; status?: number; code?: string }): boolean {
  const message = (error.message ?? "").toLowerCase();
  return error.status === 404 ||
    error.code === "user_not_found" ||
    message.includes("not found");
}

// A removed member stays as a deactivated staff row (audit history). Their
// Supabase Auth user and the unique email must not stay reserved, or Add
// Team Member reports that this user already existed and inserts nothing.
// Active and invited rows, and platform owners, keep the email.
export async function prepareEmailForNewStaffAccount(
  supabase: SupabaseClient,
  rawEmail: string,
): Promise<void> {
  const email = rawEmail.trim();
  const { data: byEmail, error: emailError } = await supabase
    .from("staff")
    .select("id, status, auth_user_id, platform_owner")
    .ilike("email", ilikeExactPattern(email));
  if (emailError) throw emailError;
  if ((byEmail ?? []).some(blocksNewAccount)) throw new Error(EMAIL_ALREADY_REGISTERED);

  const { data: authUserId, error: lookupError } = await supabase
    .rpc("auth_user_id_by_email", { p_email: email });
  if (lookupError) throw lookupError;

  const authIds = new Set<string>();
  if (typeof authUserId === "string" && authUserId) authIds.add(authUserId);
  for (const row of byEmail ?? []) {
    if (row.auth_user_id) authIds.add(row.auth_user_id as string);
  }

  for (const id of authIds) {
    const { data: linked, error: linkedError } = await supabase
      .from("staff")
      .select("id, status, platform_owner")
      .eq("auth_user_id", id);
    if (linkedError) throw linkedError;
    if ((linked ?? []).some(blocksNewAccount)) throw new Error(EMAIL_ALREADY_REGISTERED);

    for (const row of linked ?? []) {
      const { error: detachError } = await supabase
        .from("staff")
        .update({ auth_user_id: null })
        .eq("id", row.id as string);
      if (detachError) throw detachError;
    }

    const { error: deleteError } = await supabase.auth.admin.deleteUser(id);
    if (deleteError && !isMissingAuthUser(deleteError)) throw deleteError;
  }
}

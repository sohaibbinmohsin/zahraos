import { SupabaseClient } from "@supabase/supabase-js";
import { callerMayDeactivate } from "../_shared/staffAuthz.ts";

export async function deactivateStaff(
  supabase: SupabaseClient,
  callerStaffId: string,
  callerPlatformOwner: boolean,
  targetStaffId: string,
): Promise<{ staffId: string }> {
  // Unconditional, no-exceptions guard: nobody may deactivate themselves,
  // not even a platform_owner (who otherwise bypasses every check below) or
  // a super_admin (who otherwise short-circuits callerMayDeactivate's loop
  // as soon as they hold super_admin in a shared org — which trivially
  // includes an org they share with themselves). Self-deactivation by the
  // only platform_owner, or the only super_admin in an org, would lock that
  // account/org out with no one left to reverse it. This must run before
  // the callerPlatformOwner bypass, not inside callerMayDeactivate.
  if (callerStaffId === targetStaffId) {
    throw new Error("forbidden");
  }

  if (!callerPlatformOwner) {
    const authorized = await callerMayDeactivate(supabase, callerStaffId, targetStaffId);
    if (!authorized) {
      throw new Error("forbidden");
    }
  }

  const { error } = await supabase
    .from("staff")
    .update({ status: "deactivated", deactivated_at: new Date().toISOString() })
    .eq("id", targetStaffId);
  if (error) throw error;

  // Kill the target's current Supabase Auth session immediately, rather than
  // letting it ride out its natural expiry/refresh window (the "no session
  // revocation on staff deactivation" finding). admin.signOut() only accepts
  // a live session's own access-token JWT, which we don't have here — we're
  // acting on the target, not authenticating as them — so a ban is the
  // mechanism that actually works by auth_user_id: it invalidates any
  // already-issued access token immediately (confirmed live: getUser() on a
  // still-unexpired token flips to "User is banned" with no delay) and it
  // also blocks the refresh token and any future login, both desirable for a
  // deactivated account.
  //
  // *** REACTIVATION LANDMINE — READ BEFORE ADDING reactivate-staff ***
  // There is no reactivate-staff function in this codebase yet. Whoever adds
  // one MUST also call
  //     supabase.auth.admin.updateUserById(authUserId, { ban_duration: "none" })
  // as part of it, or a reactivated staff member (status flipped back to
  // "active" in the DB) will stay permanently locked out of Supabase Auth
  // forever, unable to sign in at all, with nothing in the `staff` row
  // hinting at why.
  const { data: targetAuth, error: targetAuthError } = await supabase
    .from("staff")
    .select("auth_user_id")
    .eq("id", targetStaffId)
    .single();
  if (targetAuthError || !targetAuth?.auth_user_id) {
    // The staff row is already deactivated at this point — don't roll that
    // back or throw past the caller over a failure to also kill the auth
    // session. Report and move on; the residual is the auth session staying
    // valid until it naturally expires, same as if this call itself failed.
    console.error(
      `deactivateStaff: failed to look up auth_user_id for staff ${targetStaffId} to revoke their session`,
      targetAuthError,
    );
  } else {
    const { error: banError } = await supabase.auth.admin.updateUserById(
      targetAuth.auth_user_id as string,
      { ban_duration: "876000h" },
    );
    if (banError) {
      console.error(
        `deactivateStaff: staff ${targetStaffId} was deactivated but revoking their Supabase Auth session failed`,
        banError,
      );
    }
  }

  return { staffId: targetStaffId };
}

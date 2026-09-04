import { SupabaseClient } from "@supabase/supabase-js";

// Every organization the target staff member is affiliated with, mapped to
// their org_tier there (null if the only affiliation is a module-role grant,
// not a staff_org_roles row). This is deliberately the union of both tables —
// a regular staff member created via createStaff (Task 13) but never granted
// an org_tier row is still "affiliated" with an org once they hold a module
// role in it, and must remain deactivatable by that org's admin.
async function targetOrgAffiliations(
  supabase: SupabaseClient,
  targetStaffId: string,
): Promise<Map<string, string | null>> {
  const affiliations = new Map<string, string | null>();

  const { data: orgRoles } = await supabase
    .from("staff_org_roles")
    .select("organization_id, org_tier")
    .eq("staff_id", targetStaffId);
  for (const row of orgRoles ?? []) {
    affiliations.set(row.organization_id as string, row.org_tier as string);
  }

  const { data: moduleRoles } = await supabase
    .from("staff_role_assignments")
    .select("organization_id")
    .eq("staff_id", targetStaffId);
  for (const row of moduleRoles ?? []) {
    if (!affiliations.has(row.organization_id as string)) {
      affiliations.set(row.organization_id as string, null);
    }
  }

  return affiliations;
}

async function callerMayDeactivate(
  supabase: SupabaseClient,
  callerStaffId: string,
  targetStaffId: string,
): Promise<boolean> {
  const { data: targetStaff } = await supabase
    .from("staff")
    .select("platform_owner")
    .eq("id", targetStaffId)
    .single();
  if (!targetStaff) throw new Error("not_found");
  // org_tier is a platform-internal concept unrelated to the platform_owner
  // flag (spec §3) — no amount of org authority reaches a platform-owner
  // account. Only another platform_owner (the callerPlatformOwner bypass
  // above) may deactivate one.
  if (targetStaff.platform_owner) {
    return false;
  }

  const targetAffiliations = await targetOrgAffiliations(supabase, targetStaffId);

  const { data: callerOrgRoles } = await supabase
    .from("staff_org_roles")
    .select("organization_id, org_tier")
    .eq("staff_id", callerStaffId)
    .in("org_tier", ["admin", "super_admin"]);

  for (const callerRole of callerOrgRoles ?? []) {
    const organizationId = callerRole.organization_id as string;
    // The caller's admin/super_admin authority in *some* org is never
    // sufficient on its own — the target must actually be affiliated with
    // that same org, or this is a cross-org authorization bypass.
    if (!targetAffiliations.has(organizationId)) continue;

    const targetTierHere = targetAffiliations.get(organizationId);
    const targetIsAdminOrAbove = targetTierHere === "admin" || targetTierHere === "super_admin";

    if (callerRole.org_tier === "super_admin") return true;
    if (callerRole.org_tier === "admin" && !targetIsAdminOrAbove) return true;
  }

  return false;
}

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

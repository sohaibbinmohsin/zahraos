import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { decodeStaffTokenClaims } from "@/lib/staffToken";

export interface PlatformCaller {
  staffId: string;
  platformOwner: boolean;
}

export async function resolvePlatformCaller(
  supabaseAdmin: SupabaseClient,
  token: string,
): Promise<PlatformCaller | null> {
  let callerStaffId: string | null = null;
  let callerPlatformOwner = false;

  const {
    data: { user },
  } = await supabaseAdmin.auth.getUser(token);

  if (user) {
    const { data: staff } = await supabaseAdmin
      .from("staff")
      .select("id, platform_owner")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (staff) {
      callerStaffId = staff.id;
      callerPlatformOwner = Boolean(staff.platform_owner);
    }
  }

  if (!callerStaffId) {
    try {
      const claims = decodeStaffTokenClaims(token);
      if (claims?.staffId) {
        callerStaffId = claims.staffId;
        callerPlatformOwner = Boolean(claims.platformOwner);
      }
    } catch {
      // not a staff token
    }
  }

  if (!callerStaffId) {
    return null;
  }

  return { staffId: callerStaffId, platformOwner: callerPlatformOwner };
}

export function createPlatformAdminClient(): SupabaseClient | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }
  return createClient(supabaseUrl, serviceRoleKey);
}
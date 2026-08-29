import { SupabaseClient } from "@supabase/supabase-js";

export interface CreateStaffInput {
  fullName: string;
  email: string;
  organizationId: string;
}

export interface CreateStaffResult {
  staffId: string;
  temporaryPassword: string;
}

function generateTemporaryPassword(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
}

export async function createStaff(
  supabase: SupabaseClient,
  callerStaffId: string,
  callerPlatformOwner: boolean,
  input: CreateStaffInput,
): Promise<CreateStaffResult> {
  if (!callerPlatformOwner) {
    const { data: callerRole } = await supabase
      .from("staff_org_roles")
      .select("org_tier")
      .eq("staff_id", callerStaffId)
      .eq("organization_id", input.organizationId)
      .single();
    if (!callerRole || !["admin", "super_admin"].includes(callerRole.org_tier)) {
      throw new Error("forbidden");
    }
  }

  const temporaryPassword = generateTemporaryPassword();

  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: input.email,
    password: temporaryPassword,
    email_confirm: true,
  });
  if (authError || !authUser.user) throw authError ?? new Error("failed_to_create_auth_user");

  const { data: staff, error: staffError } = await supabase
    .from("staff")
    .insert({
      auth_user_id: authUser.user.id,
      full_name: input.fullName,
      email: input.email,
      must_change_password: true,
    })
    .select("id")
    .single();
  if (staffError) throw staffError;

  return { staffId: staff.id, temporaryPassword };
}

import { SupabaseClient } from "@supabase/supabase-js";

export interface UpdateOrganizationInput {
  organizationId: string;
  name: string;
  brandColor?: string | null;
  logoUrl?: string | null;
  faviconUrl?: string | null;
  about?: string | null;
}

export async function updateOrganization(
  supabase: SupabaseClient,
  callerStaffId: string,
  callerPlatformOwner: boolean,
  input: UpdateOrganizationInput,
): Promise<{ enabledModuleKeys: string[] }> {
  if (!callerPlatformOwner) {
    const { data } = await supabase.from("staff_org_roles").select("org_tier")
      .eq("staff_id", callerStaffId).eq("organization_id", input.organizationId).single();
    if (!data || !["admin", "super_admin"].includes(data.org_tier)) throw new Error("forbidden");
  }

  const patch: Record<string, unknown> = { name: input.name };
  if (input.brandColor !== undefined) patch.brand_color = input.brandColor;
  if (input.logoUrl !== undefined) patch.logo_url = input.logoUrl;
  if (input.faviconUrl !== undefined) patch.favicon_url = input.faviconUrl;
  if (input.about !== undefined) patch.about = input.about;

  const { error } = await supabase.from("organizations").update(patch).eq("id", input.organizationId);
  if (error) throw error;

  const { data: enabledModules } = await supabase
    .from("org_modules").select("modules(key)").eq("organization_id", input.organizationId);
  const enabledModuleKeys = (enabledModules ?? []).map((row) => (row.modules as unknown as { key: string }).key);
  return { enabledModuleKeys };
}

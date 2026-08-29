import { SupabaseClient } from "@supabase/supabase-js";

export interface UpdateOrganizationInput {
  organizationId: string;
  name: string;
}

export async function updateOrganization(
  supabase: SupabaseClient,
  callerPlatformOwner: boolean,
  input: UpdateOrganizationInput,
): Promise<{ enabledModuleKeys: string[] }> {
  if (!callerPlatformOwner) throw new Error("forbidden");

  const { error } = await supabase.from("organizations").update({ name: input.name }).eq("id", input.organizationId);
  if (error) throw error;

  const { data: enabledModules } = await supabase
    .from("org_modules")
    .select("modules(key)")
    .eq("organization_id", input.organizationId);

  const enabledModuleKeys = (enabledModules ?? []).map((row) => (row.modules as unknown as { key: string }).key);

  return { enabledModuleKeys };
}

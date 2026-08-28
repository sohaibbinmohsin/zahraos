import { SupabaseClient } from "@supabase/supabase-js";

export interface EnableModuleInput {
  organizationId: string;
  moduleKey: string;
}

export async function enableModule(
  supabase: SupabaseClient,
  callerPlatformOwner: boolean,
  input: EnableModuleInput,
): Promise<{ moduleKey: string }> {
  if (!callerPlatformOwner) throw new Error("forbidden");

  const { data: moduleRow, error: moduleError } = await supabase
    .from("modules")
    .select("id")
    .eq("key", input.moduleKey)
    .single();
  if (moduleError || !moduleRow) throw new Error("unknown_module");

  const { error: orgModuleError } = await supabase
    .from("org_modules")
    .insert({ organization_id: input.organizationId, module_id: moduleRow.id });
  if (orgModuleError) throw orgModuleError;

  const { error: seedError } = await supabase.rpc("seed_system_roles_for_module", {
    p_org_id: input.organizationId,
    p_module_id: moduleRow.id,
  });
  if (seedError) throw seedError;

  return { moduleKey: input.moduleKey };
}

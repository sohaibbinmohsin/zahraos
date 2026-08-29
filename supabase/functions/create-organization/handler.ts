import { SupabaseClient } from "@supabase/supabase-js";

export interface CreateOrganizationInput {
  name: string;
  slug: string;
}

export async function createOrganization(
  supabase: SupabaseClient,
  callerPlatformOwner: boolean,
  input: CreateOrganizationInput,
): Promise<{ organizationId: string }> {
  if (!callerPlatformOwner) throw new Error("forbidden");

  const { data, error } = await supabase
    .from("organizations")
    .insert({ name: input.name, slug: input.slug })
    .select("id")
    .single();
  if (error) throw error;

  return { organizationId: data.id };
}

import { getAdminClient } from "../_shared/supabaseAdmin.ts";
import { verifyPlatformStaffSession } from "../_shared/verifyPlatformStaffSession.ts";
import { corsHeaders, corsPreflightResponse } from "../_shared/cors.ts";
import { pushOrganizationSync } from "../_shared/moduleBackends.ts";
import { mintStaffToken } from "../mint-staff-token/handler.ts";
import { updateOrganization } from "./handler.ts";

export async function handleRequest(req: Request): Promise<Response> {
  const preflight = corsPreflightResponse(req);
  if (preflight) return preflight;

  try {
    const supabase = getAdminClient();
    const { staffId, platformOwner } = await verifyPlatformStaffSession(supabase, req.headers.get("Authorization"));
    const input = await req.json();
    const result = await updateOrganization(supabase, platformOwner, input);

    const { data: org } = await supabase.from("organizations").select("id, name, slug, deactivated_at").eq(
      "id",
      input.organizationId,
    ).single();
    const syncToken = await mintStaffToken(supabase, staffId, true);
    for (const moduleKey of result.enabledModuleKeys) {
      await pushOrganizationSync(moduleKey, syncToken, {
        id: org!.id,
        name: org!.name,
        slug: org!.slug,
        deactivatedAt: org!.deactivated_at,
      });
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    const status = message === "unauthorized" ? 401 : message === "forbidden" ? 403 : 400;
    return new Response(JSON.stringify({ error: message }), { status, headers: corsHeaders });
  }
}

if (import.meta.main) Deno.serve(handleRequest);

import { getAdminClient } from "../_shared/supabaseAdmin.ts";
import { verifyPlatformStaffSession } from "../_shared/verifyPlatformStaffSession.ts";
import { corsHeaders, corsPreflightResponse } from "../_shared/cors.ts";
import { mintStaffToken } from "./handler.ts";

export async function handleRequest(req: Request): Promise<Response> {
  const preflight = corsPreflightResponse(req);
  if (preflight) return preflight;

  try {
    const supabase = getAdminClient();
    const { staffId, platformOwner } = await verifyPlatformStaffSession(supabase, req.headers.get("Authorization"));
    const token = await mintStaffToken(supabase, staffId, platformOwner);
    return new Response(JSON.stringify({ token }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    const status = message === "unauthorized" ? 401 : 400;
    return new Response(JSON.stringify({ error: message }), { status, headers: corsHeaders });
  }
}

if (import.meta.main) Deno.serve(handleRequest);

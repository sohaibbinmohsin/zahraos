import { getAdminClient } from "../_shared/supabaseAdmin.ts";
import { verifyPlatformStaffSession } from "../_shared/verifyPlatformStaffSession.ts";
import { corsHeaders, corsPreflightResponse } from "../_shared/cors.ts";
import { updateStaffAccess } from "./handler.ts";

export async function handleRequest(req: Request): Promise<Response> {
  const preflight = corsPreflightResponse(req);
  if (preflight) return preflight;

  try {
    const supabase = getAdminClient();
    const { staffId, platformOwner } = await verifyPlatformStaffSession(supabase, req.headers.get("Authorization"));
    const input = await req.json();
    const result = await updateStaffAccess(supabase, staffId, platformOwner, input);
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

import { getAdminClient } from "../_shared/supabaseAdmin.ts";
import { verifyPlatformStaffSession } from "../_shared/verifyPlatformStaffSession.ts";
import { corsHeaders, corsPreflightResponse } from "../_shared/cors.ts";
import { setPassword } from "./handler.ts";

export async function handleRequest(req: Request): Promise<Response> {
  const preflight = corsPreflightResponse(req);
  if (preflight) return preflight;

  try {
    const supabase = getAdminClient();
    const authHeader = req.headers.get("Authorization");
    const { staffId } = await verifyPlatformStaffSession(supabase, authHeader);
    const token = authHeader!.slice("Bearer ".length);
    const { data: userData } = await supabase.auth.getUser(token);
    const { newPassword } = await req.json();
    const result = await setPassword(supabase, staffId, userData.user!.id, newPassword);
    return new Response(JSON.stringify(result), {
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

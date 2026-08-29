// Closes the "no CORS handling" finding from the platform-backend post-build
// review (shared with vms-backend, fixed separately there): every function's
// index.ts did a bare Deno.serve with no OPTIONS handling and no
// Access-Control-* headers on any response, so a browser calling these from
// the platform frontend's origin would fail the CORS preflight before the
// request ever reached this code.
//
// Access-Control-Allow-Origin is "*". There is no existing env var or
// convention anywhere in this repo (.env.example, README.md, or any module)
// for the deployed platform frontend's origin to restrict this to instead.
// "*" is an acceptable default here because every one of these functions
// authenticates via a Bearer token in the Authorization header, not cookies
// — a wildcard origin doesn't let another site ride the caller's ambient
// credentials, since there are none to ride; a malicious page still can't
// forge the Authorization header a legitimate signed-in client would send.
// If a fixed frontend origin becomes known later, this is the one place to
// tighten it.
export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// None of this repo's functions branch on req.method — every one treats
// every request the same way — so a cross-origin browser will still send an
// OPTIONS preflight ahead of any real POST. This must be checked before
// anything else touches the request (auth header, JSON body): a preflight
// carries neither.
export function corsPreflightResponse(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  return null;
}

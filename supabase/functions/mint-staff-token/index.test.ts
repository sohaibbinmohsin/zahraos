import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { handleRequest } from "./index.ts";
import { adminTestClient, createStaffSession, jsonRequest, optionsRequest } from "../_shared/testSupport.ts";

// Regression tests for the "no CORS handling" finding. mint-staff-token
// mints a brand new cross-project VMS staff JWT, exactly the call the
// session-revocation fix was concerned with a deactivated staff member
// re-invoking — it's just as reachable from a browser as any other function
// here, so it needs the same CORS treatment.
Deno.test("mint-staff-token index handles an OPTIONS preflight with CORS headers before touching auth", async () => {
  const res = await handleRequest(optionsRequest());
  assertEquals(res.status, 204);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
});

Deno.test("mint-staff-token index carries CORS headers on a successful response", async () => {
  const supabase = adminTestClient();
  const staff = await createStaffSession(supabase);

  const res = await handleRequest(jsonRequest({}, staff.accessToken));

  assertEquals(res.status, 200);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
});

Deno.test("mint-staff-token index carries CORS headers on an error response", async () => {
  const res = await handleRequest(jsonRequest({}));
  assertEquals(res.status, 401);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
});

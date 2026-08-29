import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { handleRequest } from "./index.ts";
import { adminTestClient, createOrg, createStaffSession, jsonRequest, optionsRequest } from "../_shared/testSupport.ts";

// Regression tests for the "no CORS handling" finding.
Deno.test("update-organization index handles an OPTIONS preflight with CORS headers before touching auth", async () => {
  const res = await handleRequest(optionsRequest());
  assertEquals(res.status, 204);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
});

Deno.test("update-organization index carries CORS headers on a successful response", async () => {
  const supabase = adminTestClient();
  const orgId = await createOrg(supabase);
  const owner = await createStaffSession(supabase, { platformOwner: true });

  // No modules are enabled for this fresh org, so the re-sync loop this
  // handler runs afterward has nothing to push (see moduleBackends.ts) —
  // no real cross-project network call happens in this test.
  const res = await handleRequest(jsonRequest({ organizationId: orgId, name: "Renamed CORS Org" }, owner.accessToken));

  assertEquals(res.status, 200);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
});

Deno.test("update-organization index carries CORS headers on an error response", async () => {
  const res = await handleRequest(jsonRequest({ organizationId: "x", name: "y" }));
  assertEquals(res.status, 401);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
});

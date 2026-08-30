import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { handleRequest } from "./index.ts";
import { adminTestClient, createOrg, createStaffSession, jsonRequest, optionsRequest } from "../_shared/testSupport.ts";

// Regression tests for the "no CORS handling" finding.
Deno.test("enable-module index handles an OPTIONS preflight with CORS headers before touching auth", async () => {
  const res = await handleRequest(optionsRequest());
  assertEquals(res.status, 204);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
});

Deno.test("enable-module index carries CORS headers on a successful response", async () => {
  const supabase = adminTestClient();
  const orgId = await createOrg(supabase);
  const owner = await createStaffSession(supabase, { platformOwner: true });

  // YOUTH_REPUBLIC_BACKEND_FUNCTIONS_URL is unset in this test environment, so the
  // org-sync push this handler makes afterward no-ops rather than making a
  // real cross-project network call (see moduleBackends.ts).
  const res = await handleRequest(jsonRequest({ organizationId: orgId, moduleKey: "youth-republic" }, owner.accessToken));

  assertEquals(res.status, 200);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
});

Deno.test("enable-module index carries CORS headers on an error response", async () => {
  const res = await handleRequest(jsonRequest({ organizationId: "x", moduleKey: "youth-republic" }));
  assertEquals(res.status, 401);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
});

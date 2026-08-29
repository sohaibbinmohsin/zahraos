import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { handleRequest } from "./index.ts";
import { adminTestClient, createOrg, createStaffSession, grantOrgTier, jsonRequest, optionsRequest } from "../_shared/testSupport.ts";

// Regression tests for the "no CORS handling" finding.
Deno.test("create-staff index handles an OPTIONS preflight with CORS headers before touching auth", async () => {
  const res = await handleRequest(optionsRequest());
  assertEquals(res.status, 204);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
});

Deno.test("create-staff index carries CORS headers on a successful response", async () => {
  const supabase = adminTestClient();
  const orgId = await createOrg(supabase);
  const admin = await createStaffSession(supabase);
  await grantOrgTier(supabase, admin.staffId, orgId, "admin");

  const res = await handleRequest(
    jsonRequest(
      { fullName: "New Staff", email: `new-staff-${crypto.randomUUID()}@example.com`, organizationId: orgId },
      admin.accessToken,
    ),
  );

  assertEquals(res.status, 201);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
});

Deno.test("create-staff index carries CORS headers on an error response", async () => {
  const res = await handleRequest(jsonRequest({ fullName: "x", email: "x@example.com", organizationId: "not-a-real-org" }));
  assertEquals(res.status, 401);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
});

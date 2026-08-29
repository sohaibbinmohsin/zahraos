import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { handleRequest } from "./index.ts";
import {
  adminTestClient,
  createOrg,
  createStaffSession,
  grantModuleAffiliation,
  grantOrgTier,
  jsonRequest,
  optionsRequest,
} from "../_shared/testSupport.ts";

// Regression tests for the "no CORS handling" finding.
Deno.test("deactivate-staff index handles an OPTIONS preflight with CORS headers before touching auth", async () => {
  const res = await handleRequest(optionsRequest());
  assertEquals(res.status, 204);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
});

Deno.test("deactivate-staff index carries CORS headers on a successful response", async () => {
  const supabase = adminTestClient();
  const orgId = await createOrg(supabase);
  const admin = await createStaffSession(supabase);
  await grantOrgTier(supabase, admin.staffId, orgId, "admin");
  const target = await createStaffSession(supabase);
  await grantModuleAffiliation(supabase, target.staffId, orgId);

  const res = await handleRequest(jsonRequest({ targetStaffId: target.staffId }, admin.accessToken));

  assertEquals(res.status, 200);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
});

Deno.test("deactivate-staff index carries CORS headers on an error response", async () => {
  const res = await handleRequest(jsonRequest({ targetStaffId: "not-a-real-staff" }));
  assertEquals(res.status, 401);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
});

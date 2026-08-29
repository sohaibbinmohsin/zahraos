import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { handleRequest } from "./index.ts";
import {
  adminTestClient,
  createOrg,
  createStaffSession,
  jsonRequest,
  optionsRequest,
} from "../_shared/testSupport.ts";

Deno.test("assign-staff-org-role index handles an OPTIONS preflight with CORS headers before touching auth", async () => {
  const res = await handleRequest(optionsRequest());
  assertEquals(res.status, 204);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
});

Deno.test("assign-staff-org-role index carries CORS headers on a successful response", async () => {
  const supabase = adminTestClient();
  const orgId = await createOrg(supabase);
  const owner = await createStaffSession(supabase, { platformOwner: true });
  const target = await createStaffSession(supabase);

  const res = await handleRequest(
    jsonRequest({ staffId: target.staffId, organizationId: orgId, orgTier: "super_admin" }, owner.accessToken),
  );

  assertEquals(res.status, 200);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
});

Deno.test("assign-staff-org-role index carries CORS headers on an error response", async () => {
  const res = await handleRequest(
    jsonRequest({ staffId: "x", organizationId: "y", orgTier: "admin" }),
  );
  assertEquals(res.status, 401);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
});

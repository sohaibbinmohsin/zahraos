import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { handleRequest } from "./index.ts";
import {
  adminTestClient,
  createOrg,
  createStaffSession,
  enableVmsModule,
  grantOrgTier,
  jsonRequest,
  optionsRequest,
} from "../_shared/testSupport.ts";

// Regression tests for the "no CORS handling" finding.
Deno.test("assign-staff-module-role index handles an OPTIONS preflight with CORS headers before touching auth", async () => {
  const res = await handleRequest(optionsRequest());
  assertEquals(res.status, 204);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
});

Deno.test("assign-staff-module-role index carries CORS headers on a successful response", async () => {
  const supabase = adminTestClient();
  const orgId = await createOrg(supabase);
  const admin = await createStaffSession(supabase);
  await grantOrgTier(supabase, admin.staffId, orgId, "admin");
  const moduleId = await enableVmsModule(supabase, orgId);
  const { data: viewerRole } = await supabase.from("roles").select("id").eq("organization_id", orgId).eq("name", "Viewer")
    .single();
  const target = await createStaffSession(supabase);

  const res = await handleRequest(
    jsonRequest(
      { staffId: target.staffId, organizationId: orgId, moduleId, roleId: viewerRole!.id },
      admin.accessToken,
    ),
  );

  assertEquals(res.status, 200);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
});

Deno.test("assign-staff-module-role index carries CORS headers on an error response", async () => {
  const res = await handleRequest(
    jsonRequest({ staffId: "x", organizationId: "y", moduleId: "z", roleId: "w" }),
  );
  assertEquals(res.status, 401);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
});

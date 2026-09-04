import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { handleRequest } from "./index.ts";
import {
  adminTestClient,
  createOrg,
  createStaffSession,
  enableYouthRepublicModule,
  grantOrgTier,
  jsonRequest,
  optionsRequest,
} from "../_shared/testSupport.ts";

// Regression tests for the "no CORS handling" finding.
Deno.test("create-custom-role index handles an OPTIONS preflight with CORS headers before touching auth", async () => {
  const res = await handleRequest(optionsRequest());
  assertEquals(res.status, 204);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
});

Deno.test("create-custom-role index carries CORS headers on a successful response", async () => {
  const supabase = adminTestClient();
  const orgId = await createOrg(supabase);
  const admin = await createStaffSession(supabase);
  await grantOrgTier(supabase, admin.staffId, orgId, "admin");
  const moduleId = await enableYouthRepublicModule(supabase, orgId);

  const res = await handleRequest(
    jsonRequest(
      {
        organizationId: orgId,
        moduleId,
        name: "CORS Custom Role",
        description: "",
        capabilities: {
          drive: "restricted",
          publish: "restricted",
          triage: "restricted",
          hours: "restricted",
          team: "restricted",
        },
      },
      admin.accessToken,
    ),
  );

  assertEquals(res.status, 201);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
});

Deno.test("create-custom-role index carries CORS headers on an error response", async () => {
  const res = await handleRequest(
    jsonRequest({
      organizationId: "x",
      moduleId: "y",
      name: "z",
      description: "",
      capabilities: {
        drive: "restricted",
        publish: "restricted",
        triage: "restricted",
        hours: "restricted",
        team: "restricted",
      },
    }),
  );
  assertEquals(res.status, 401);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
});

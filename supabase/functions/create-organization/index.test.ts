import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { handleRequest } from "./index.ts";
import { adminTestClient, createStaffSession, jsonRequest, optionsRequest } from "../_shared/testSupport.ts";

// Regression tests for the "no CORS handling" finding: this wrapper used to
// be a bare, unexported Deno.serve callback with no OPTIONS handling and no
// Access-Control-* headers on any response, which would fail a browser's
// CORS preflight before the request ever reached this code.
Deno.test("create-organization index handles an OPTIONS preflight with CORS headers before touching auth", async () => {
  const res = await handleRequest(optionsRequest());
  assertEquals(res.status, 204);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
});

Deno.test("create-organization index carries CORS headers on a successful response", async () => {
  const supabase = adminTestClient();
  const owner = await createStaffSession(supabase, { platformOwner: true });

  const res = await handleRequest(
    jsonRequest({ name: "CORS Org", slug: `cors-org-${crypto.randomUUID()}` }, owner.accessToken),
  );

  assertEquals(res.status, 201);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
});

Deno.test("create-organization index carries CORS headers on an error response", async () => {
  const res = await handleRequest(jsonRequest({ name: "x", slug: "y" }));
  assertEquals(res.status, 401);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
});

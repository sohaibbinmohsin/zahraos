import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { handleRequest } from "./index.ts";
import { adminTestClient, createStaffSession, jsonRequest, optionsRequest } from "../_shared/testSupport.ts";

// Regression tests for the "no CORS handling" finding.
Deno.test("set-password index handles an OPTIONS preflight with CORS headers before touching auth", async () => {
  const res = await handleRequest(optionsRequest());
  assertEquals(res.status, 204);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
});

Deno.test("set-password index carries CORS headers on a successful response", async () => {
  const supabase = adminTestClient();
  const staff = await createStaffSession(supabase);

  const res = await handleRequest(jsonRequest({ newPassword: "New-Cors-Password-1!" }, staff.accessToken));

  assertEquals(res.status, 200);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
});

Deno.test("set-password index carries CORS headers on an error response", async () => {
  const res = await handleRequest(jsonRequest({ newPassword: "x" }));
  assertEquals(res.status, 401);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
});

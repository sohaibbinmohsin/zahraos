import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { corsHeaders, corsPreflightResponse } from "./cors.ts";

Deno.test("corsHeaders allows the headers and methods this repo's functions actually need", () => {
  assertEquals(corsHeaders["Access-Control-Allow-Origin"], "*");
  assertEquals(corsHeaders["Access-Control-Allow-Headers"].includes("authorization"), true);
  assertEquals(corsHeaders["Access-Control-Allow-Headers"].includes("content-type"), true);
  assertEquals(corsHeaders["Access-Control-Allow-Methods"].includes("POST"), true);
  assertEquals(corsHeaders["Access-Control-Allow-Methods"].includes("OPTIONS"), true);
});

Deno.test("corsPreflightResponse short-circuits an OPTIONS request with CORS headers", () => {
  const req = new Request("https://example.com/fn", { method: "OPTIONS" });
  const res = corsPreflightResponse(req);
  assertEquals(res !== null, true);
  assertEquals(res!.status, 204);
  assertEquals(res!.headers.get("Access-Control-Allow-Origin"), "*");
  assertEquals(res!.headers.get("Access-Control-Allow-Headers"), corsHeaders["Access-Control-Allow-Headers"]);
});

Deno.test("corsPreflightResponse returns null for a non-OPTIONS request, leaving it to the caller", () => {
  const req = new Request("https://example.com/fn", { method: "POST" });
  assertEquals(corsPreflightResponse(req), null);
});

import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { verifyPlatformStaffSession } from "./verifyPlatformStaffSession.ts";

function fakeSupabase(
  options: { user?: { id: string } | null; staff?: { id: string; platform_owner: boolean; status: string } | null },
) {
  return {
    auth: {
      async getUser(_token: string) {
        return options.user
          ? { data: { user: options.user }, error: null }
          : { data: { user: null }, error: new Error("invalid token") };
      },
    },
    from(_table: string) {
      return {
        select(_columns: string) {
          return {
            eq(_column: string, _value: string) {
              return {
                async single() {
                  return options.staff
                    ? { data: options.staff, error: null }
                    : { data: null, error: new Error("not found") };
                },
              };
            },
          };
        },
      };
    },
  };
}

Deno.test("verifyPlatformStaffSession resolves staffId and platformOwner for a valid session", async () => {
  const supabase = fakeSupabase({ user: { id: "auth-1" }, staff: { id: "staff-1", platform_owner: true, status: "active" } });
  const result = await verifyPlatformStaffSession(supabase as never, "Bearer good-token");
  assertEquals(result.staffId, "staff-1");
  assertEquals(result.platformOwner, true);
});

Deno.test("verifyPlatformStaffSession rejects a missing header", async () => {
  const supabase = fakeSupabase({ user: null });
  await assertRejects(() => verifyPlatformStaffSession(supabase as never, null), Error, "unauthorized");
});

Deno.test("verifyPlatformStaffSession rejects a session with no staff row", async () => {
  const supabase = fakeSupabase({ user: { id: "auth-1" }, staff: null });
  await assertRejects(() => verifyPlatformStaffSession(supabase as never, "Bearer good-token"), Error, "unauthorized");
});

// Regression test for the "no session revocation on staff deactivation"
// finding: deactivateStaff only ever flipped staff.status to "deactivated" —
// nothing checked that flag again, so a deactivated staff member's still-valid
// Supabase Auth session kept working against every platform Edge Function,
// including minting a brand new VMS staff JWT.
Deno.test("verifyPlatformStaffSession rejects a deactivated staff member", async () => {
  const supabase = fakeSupabase({
    user: { id: "auth-1" },
    staff: { id: "staff-1", platform_owner: false, status: "deactivated" },
  });
  await assertRejects(() => verifyPlatformStaffSession(supabase as never, "Bearer good-token"), Error, "unauthorized");
});

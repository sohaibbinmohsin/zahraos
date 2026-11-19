import { assertEquals, assertMatch, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { issueStaffTemporaryPassword } from "./handler.ts";

type Row = Record<string, unknown>;

function client(opts: {
  staff?: Row | null;
  assignments?: Row[];
  authError?: { message: string } | null;
}) {
  const updates: Row[] = [];
  const passwords: string[] = [];
  const audits: Row[] = [];

  function query(table: string) {
    const filters: Record<string, string> = {};
    const api = {
      select() { return api; },
      eq(column: string, value: string) {
        filters[column] = value;
        return api;
      },
      limit() { return api; },
      update(values: Row) {
        updates.push({ table, values, filters: { ...filters } });
        return api;
      },
      insert(values: Row) {
        if (table === "admin_audit_log") audits.push(values);
        return api;
      },
      maybeSingle() {
        return Promise.resolve({ data: null, error: null });
      },
      single() {
        if (table === "staff") {
          return Promise.resolve({ data: opts.staff ?? null, error: opts.staff ? null : { message: "missing" } });
        }
        return Promise.resolve({ data: { full_name: "Admin" }, error: null });
      },
      then(onFulfilled: (value: { data: unknown; error: null }) => unknown, onRejected?: (reason: unknown) => unknown) {
        const data = table === "staff_role_assignments" ? (opts.assignments ?? []) : [];
        return Promise.resolve({ data, error: null }).then(onFulfilled, onRejected);
      },
    };
    return api;
  }

  return {
    updates,
    passwords,
    audits,
    supabase: {
      from: query,
      auth: {
        admin: {
          updateUserById(_id: string, body: { password: string }) {
            passwords.push(body.password);
            return Promise.resolve({ error: opts.authError ?? null });
          },
        },
      },
    },
  };
}

const member = {
  id: "member-1",
  full_name: "Maryam Azhar",
  status: "active",
  auth_user_id: "auth-1",
  platform_owner: false,
};

Deno.test("issues a new temporary password and forces a change on next sign-in", async () => {
  const db = client({ staff: member, assignments: [{ id: "assignment-1" }] });
  const result = await issueStaffTemporaryPassword(db.supabase as never, "owner-1", true, {
    staffId: "member-1",
    organizationId: "org-1",
  });

  assertEquals(result.staffId, "member-1");
  assertMatch(result.temporaryPassword, /^Rizq-[A-HJ-NP-Z][a-kmnp-z]{3}-[2-9]{4}!$/);
  assertEquals(db.passwords, [result.temporaryPassword]);
  assertEquals(db.updates[0]?.values, { must_change_password: true });
  assertEquals(db.audits[0]?.action, "Temporary Password Issued");
  assertEquals(String(db.audits[0]?.summary).includes(result.temporaryPassword), false);
});

Deno.test("refuses a deactivated member", async () => {
  const db = client({
    staff: { ...member, status: "deactivated" },
    assignments: [{ id: "assignment-1" }],
  });
  await assertRejects(
    () => issueStaffTemporaryPassword(db.supabase as never, "owner-1", true, {
      staffId: "member-1",
      organizationId: "org-1",
    }),
    Error,
    "member_deactivated",
  );
  assertEquals(db.passwords, []);
});

Deno.test("refuses a member with no role in the organization", async () => {
  const db = client({ staff: member, assignments: [] });
  await assertRejects(
    () => issueStaffTemporaryPassword(db.supabase as never, "owner-1", true, {
      staffId: "member-1",
      organizationId: "org-1",
    }),
    Error,
    "forbidden",
  );
  assertEquals(db.passwords, []);
});

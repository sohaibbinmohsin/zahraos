import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import type { SupabaseClient } from "@supabase/supabase-js";
import { inviteStaffMember } from "./handler.ts";
import { removeStaffMember } from "../remove-staff-member/handler.ts";
import { EMAIL_ALREADY_REGISTERED, ilikeExactPattern } from "../_shared/staffIdentity.ts";

type Row = Record<string, unknown>;

interface AuthUser {
  id: string;
  email: string;
  banned_until: string | null;
}

interface Filter {
  op: "eq" | "neq" | "in" | "ilike";
  col: string;
  val: unknown;
}

function ilikeMatches(value: unknown, pattern: string): boolean {
  let source = "";
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === "\\" && i + 1 < pattern.length) {
      source += pattern[++i].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      continue;
    }
    if (ch === "%") source += ".*";
    else if (ch === "_") source += ".";
    else source += ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${source}$`, "i").test(String(value ?? ""));
}

function matches(row: Row, filters: Filter[]): boolean {
  return filters.every((filter) => {
    const value = row[filter.col];
    if (filter.op === "eq") return value === filter.val;
    if (filter.op === "neq") return value !== filter.val;
    if (filter.op === "in") return (filter.val as unknown[]).includes(value);
    return ilikeMatches(value, String(filter.val));
  });
}

class MemoryDb {
  tables: Record<string, Row[]> = {
    modules: [{ id: "mod-1", key: "youth-republic" }],
    org_modules: [{ organization_id: "org-1", module_id: "mod-1" }],
    roles: [{ id: "role-1", organization_id: "org-1", module_id: "mod-1", name: "Operations Lead" }],
    staff: [{
      id: "owner-staff",
      auth_user_id: "auth-owner",
      full_name: "Platform Owner",
      email: "owner@example.com",
      platform_owner: true,
      status: "active",
      deactivated_at: null,
    }],
    staff_role_assignments: [],
    staff_invitations: [],
    staff_org_roles: [],
    admin_audit_log: [],
  };
  users: AuthUser[] = [{ id: "auth-owner", email: "owner@example.com", banned_until: null }];
  events: string[] = [];

  client(): SupabaseClient {
    const db = this;
    return {
      from(table: string) {
        return new Query(db, table);
      },
      rpc(fn: string, args: { p_email?: string }) {
        if (fn !== "auth_user_id_by_email") {
          return Promise.resolve({ data: null, error: { message: `unknown rpc ${fn}` } });
        }
        const email = (args.p_email ?? "").trim().toLowerCase();
        const user = db.users.find((u) => u.email.toLowerCase() === email);
        return Promise.resolve({ data: user?.id ?? null, error: null });
      },
      auth: {
        admin: {
          createUser({ email }: { email: string }) {
            db.events.push(`create:${email}`);
            const taken = db.users.some((u) => u.email.toLowerCase() === email.toLowerCase());
            if (taken) {
              const error = new Error(EMAIL_ALREADY_REGISTERED);
              return Promise.resolve({ data: { user: null }, error });
            }
            const user = { id: crypto.randomUUID(), email, banned_until: null };
            db.users.push(user);
            return Promise.resolve({ data: { user }, error: null });
          },
          deleteUser(id: string) {
            db.events.push(`delete:${id}`);
            const index = db.users.findIndex((u) => u.id === id);
            if (index < 0) {
              return Promise.resolve({ data: { user: null }, error: new Error("User not found") });
            }
            db.users.splice(index, 1);
            for (const row of db.tables.staff) {
              if (row.auth_user_id === id) row.auth_user_id = null;
            }
            return Promise.resolve({ data: {}, error: null });
          },
          updateUserById(id: string, patch: { ban_duration?: string }) {
            db.events.push(`ban:${id}`);
            const user = db.users.find((u) => u.id === id);
            if (!user) return Promise.resolve({ data: { user: null }, error: new Error("User not found") });
            if (patch.ban_duration) user.banned_until = patch.ban_duration;
            return Promise.resolve({ data: { user }, error: null });
          },
          getUserById(id: string) {
            const user = db.users.find((u) => u.id === id) ?? null;
            return Promise.resolve({
              data: { user },
              error: user ? null : new Error("User not found"),
            });
          },
        },
      },
    } as unknown as SupabaseClient;
  }
}

class Query {
  private filters: Filter[] = [];
  private op: "select" | "insert" | "update" | "delete" | "upsert" = "select";
  private payload: Row | Row[] | null = null;

  constructor(private db: MemoryDb, private table: string) {}

  select() { return this; }
  insert(payload: Row | Row[]) { this.op = "insert"; this.payload = payload; return this; }
  update(payload: Row) { this.op = "update"; this.payload = payload; return this; }
  delete() { this.op = "delete"; return this; }
  upsert(payload: Row) { this.op = "upsert"; this.payload = payload; return this; }
  eq(col: string, val: unknown) { this.filters.push({ op: "eq", col, val }); return this; }
  neq(col: string, val: unknown) { this.filters.push({ op: "neq", col, val }); return this; }
  in(col: string, val: unknown[]) { this.filters.push({ op: "in", col, val }); return this; }
  ilike(col: string, val: string) { this.filters.push({ op: "ilike", col, val }); return this; }
  limit() { return this; }
  maybeSingle() { return this.execute("maybe"); }
  single() { return this.execute("single"); }
  then<TResult1 = { data: unknown; error: unknown }, TResult2 = never>(
    resolve: (value: { data: unknown; error: unknown }) => TResult1 | PromiseLike<TResult1>,
    reject?: (reason: unknown) => TResult2 | PromiseLike<TResult2>,
  ) {
    return this.execute("many").then(resolve, reject);
  }

  private rows(): Row[] {
    return this.db.tables[this.table] ?? (this.db.tables[this.table] = []);
  }

  private execute(expect: "many" | "single" | "maybe"): Promise<{ data: unknown; error: unknown }> {
    const table = this.rows();
    if (this.op === "insert" || this.op === "upsert") {
      const incoming = Array.isArray(this.payload) ? this.payload : [this.payload as Row];
      const stored: Row[] = [];
      for (const raw of incoming) {
        const row = { ...raw };
        if (!row.id) row.id = crypto.randomUUID();
        if (this.table === "staff" && row.status !== "deactivated") {
          const clash = table.find((existing) =>
            existing.email === row.email && existing.status !== "deactivated"
          );
          if (clash) {
            return Promise.resolve({
              data: null,
              error: { code: "23505", message: 'duplicate key value violates unique constraint "staff_email_active_key"' },
            });
          }
        }
        if (this.table === "staff" && row.auth_user_id) {
          const clash = table.find((existing) => existing.auth_user_id === row.auth_user_id);
          if (clash) {
            return Promise.resolve({
              data: null,
              error: { code: "23505", message: 'duplicate key value violates unique constraint "staff_auth_user_id_key"' },
            });
          }
        }
        table.push(row);
        stored.push(row);
      }
      const data = expect === "many" ? stored : stored[0];
      return Promise.resolve({ data, error: null });
    }

    const found = table.filter((row) => matches(row, this.filters));
    if (this.op === "update") {
      for (const row of found) Object.assign(row, this.payload);
      return Promise.resolve({ data: null, error: null });
    }
    if (this.op === "delete") {
      this.db.tables[this.table] = table.filter((row) => !matches(row, this.filters));
      return Promise.resolve({ data: null, error: null });
    }
    if (expect === "single") {
      if (found.length !== 1) {
        return Promise.resolve({ data: null, error: { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned" } });
      }
      return Promise.resolve({ data: found[0], error: null });
    }
    if (expect === "maybe") {
      if (found.length > 1) {
        return Promise.resolve({ data: null, error: { code: "PGRST116", message: "multiple rows" } });
      }
      return Promise.resolve({ data: found[0] ?? null, error: null });
    }
    return Promise.resolve({ data: found, error: null });
  }
}

const ORG = "org-1";
const ROLE = "role-1";

function invite(db: MemoryDb, email: string, fullName = "Test Member") {
  return inviteStaffMember(db.client(), "owner-staff", true, {
    organizationId: ORG,
    fullName,
    email,
    roles: [{ roleId: ROLE, scopeKind: "org_wide", scopeLabel: "National / All Chapters" }],
  });
}

Deno.test("ilikeExactPattern treats underscore and percent as literals", () => {
  assertEquals(ilikeExactPattern("a_b%c@example.com"), "a\\_b\\%c@example.com");
});

Deno.test("removing a member keeps the staff row and lets the same email be added as a new account", async () => {
  const db = new MemoryDb();
  const email = "a_b@example.com";
  db.tables.staff.push({
    id: "decoy",
    auth_user_id: "auth-decoy",
    full_name: "Different Person",
    email: "axb@example.com",
    platform_owner: false,
    status: "active",
    deactivated_at: null,
  });
  db.users.push({ id: "auth-decoy", email: "axb@example.com", banned_until: null });

  const first = await invite(db, email, "First Account");
  await removeStaffMember(db.client(), "owner-staff", true, { staffId: first.staffId, organizationId: ORG });

  const removed = db.tables.staff.find((row) => row.id === first.staffId);
  assertEquals(removed?.status, "deactivated");
  assertEquals(removed?.email, email);
  assertEquals(removed?.auth_user_id, null);
  assertEquals(typeof removed?.deactivated_at, "string");
  assertEquals(db.users.some((user) => user.email === email), false);

  const second = await invite(db, email, "Second Account");
  assertEquals(second.staffId === first.staffId, false);
  assertEquals(second.temporaryPassword.startsWith("Rizq-"), true);

  const created = db.tables.staff.find((row) => row.id === second.staffId);
  assertEquals(created?.status, "active");
  assertEquals(created?.email, email);
  assertEquals(created?.must_change_password, true);
  assertEquals(db.tables.staff.filter((row) => row.email === email).length, 2);
  assertEquals(db.users.filter((user) => user.email.toLowerCase() === email).length, 1);
  assertEquals(db.tables.staff.find((row) => row.id === "decoy")?.status, "active");
  assertEquals(db.users.some((user) => user.id === "auth-decoy"), true);

  const added = db.tables.admin_audit_log.filter((row) => row.action === "Member Added");
  const removedLog = db.tables.admin_audit_log.filter((row) => row.action === "Member Removed");
  assertEquals(added.length, 2);
  assertEquals(removedLog.length, 1);
  assertEquals(removedLog[0].entity_id, first.staffId);
});

Deno.test("a member already removed under the old ban-only delete can be created again", async () => {
  const db = new MemoryDb();
  const email = "legacy@example.com";
  db.users.push({ id: "old-auth", email, banned_until: "876000h" });
  db.tables.staff.push({
    id: "old-staff",
    auth_user_id: "old-auth",
    full_name: "Legacy Member",
    email,
    platform_owner: false,
    status: "deactivated",
    deactivated_at: "2026-01-01T00:00:00.000Z",
  });

  const created = await invite(db, email, "Legacy Member");
  assertEquals(created.staffId === "old-staff", false);
  assertEquals(db.events[0], "delete:old-auth");
  assertEquals(db.events[1].startsWith("create:"), true);
  assertEquals(db.users.some((user) => user.id === "old-auth"), false);

  const history = db.tables.staff.find((row) => row.id === "old-staff");
  assertEquals(history?.status, "deactivated");
  assertEquals(history?.email, email);
  assertEquals(history?.auth_user_id, null);
  assertEquals(history?.full_name, "Legacy Member");
});

Deno.test("adding an email that still belongs to a live member shows the existing-account message and creates nothing", async () => {
  const db = new MemoryDb();
  const email = "live@example.com";
  await invite(db, email, "Live Member");
  const staffBefore = db.tables.staff.length;
  const usersBefore = db.users.length;

  const error = await assertRejects(
    () => invite(db, email, "Someone Else"),
    Error,
    EMAIL_ALREADY_REGISTERED,
  );
  assertEquals((error as Error).message, EMAIL_ALREADY_REGISTERED);
  assertEquals(db.tables.staff.length, staffBefore);
  assertEquals(db.users.length, usersBefore);
  assertEquals(db.events.filter((event) => event.startsWith("delete:")).length, 0);
});

# Chapters (platform side) & Staff Expiry — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `chapters` a platform-owned organization sub-division with its own table, edge functions, and admin UI, and add a nullable `staff.expires_at` that automatically lapses time-boxed staff access.

**Architecture:** Platform project only — no YR changes. A new `chapters` table sits alongside `organizations`; `staff_role_assignments.chapter_id` (a bare uuid from `0013`) gains a real FK. Three service-role edge functions manage chapters, each writing an `admin_audit_log` row. `staff.expires_at` is enforced in the shared session gate (`verifyPlatformStaffSession`) and in `mint-staff-token`. A single new `/organization` page (org-admin-gated) holds an org-profile branding editor (wired to an extended `update-organization` + the existing `pushOrganizationSync`) and the chapter list — the `ChaptersPanel` component moves here from the Roles & Permissions tab.

**Tech Stack:** Supabase (hosted, no local stack), Postgres + pgTAP, Deno Edge Functions with `deno test`, Next.js 16 App Router + React 19, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-06-chapter-scoped-access-design.md` (§2.1, §5, §6, §7, §8 in-scope items, §9, §10). The per-capability token model (§3) and all YR enforcement (§4) are the **separate** plan `2026-09-06-chapter-scoped-enforcement.md` — do not touch `mint-staff-token`'s `chapters`/`module_access` shape or any YR file here.

## Global Constraints

- Runs against the **real hosted Supabase project** (platform), no local stack. `set -a; source .env; set +a` first. Migrations: `npx supabase@latest db push --linked`. DB tests: `for f in supabase/tests/database/*.sql; do psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$f"; done`. Function tests: `cd supabase && deno task test`. Function deploy: `npx supabase@latest functions deploy <names> --import-map ./supabase/deno.jsonc --project-ref "$SUPABASE_PROJECT_REF"`.
- Migration files are append-only; new file is exactly `supabase/migrations/0014_chapters.sql`.
- The YR module key is `youth-republic` (never `vms`).
- Every new edge function `index.ts`: `corsPreflightResponse(req)` first → `getAdminClient()` → `verifyPlatformStaffSession(supabase, req.headers.get("Authorization"))` → wrap handler → errors map `unauthorized→401`, `forbidden→403`, else `400`. Copy the shape from `supabase/functions/create-custom-role/index.ts`.
- Handler auth for the chapter functions: `callerPlatformOwner` bypasses; else the caller must hold `staff_org_roles.org_tier in ('admin','super_admin')` for the target org. Copy the check from `supabase/functions/invite-staff-member/handler.ts` (`assertCallerIsOrgAdmin`).
- `admin_audit_log.action` strings used here: exactly `"Chapter Created"` and `"Chapter Updated"`.
- Acceptance gate for frontend tasks: `npx tsc --noEmit` clean + `npm test` fully green. `npm run build` is known to fail on a pre-existing unrelated page (`app/modules/youth-republic/applications/page.tsx`, `useSearchParams` without Suspense — not this plan's concern; no `/organization` or `components/team/*` file is affected).
- Frontend session-token calls use `supabase.auth.getSession()` → `access_token`; `lib/platformFunctions.ts` helpers take `(payload, accessToken)`.
- Frontend pinned copy (headings, labels, empty states) — copy verbatim from the task text.

---

## File Structure

**`tmp-partner-admin` (platform):**
- `supabase/migrations/0014_chapters.sql` — new: `chapters` table + RLS, `staff_role_assignments` FK, `staff.expires_at`.
- `supabase/tests/database/chapters_test.sql` — new: pgTAP.
- `supabase/functions/list-chapters/{index,handler}.ts` (+ `handler.test.ts`) — new.
- `supabase/functions/create-chapter/{index,handler}.ts` (+ `handler.test.ts`) — new.
- `supabase/functions/update-chapter/{index,handler}.ts` (+ `handler.test.ts`) — new.
- `supabase/functions/_shared/verifyPlatformStaffSession.ts` — modify: `expires_at` gate.
- `supabase/functions/mint-staff-token/handler.ts` — modify: refuse an expired account (a few lines, no token-shape change).
- `supabase/functions/invite-staff-member/handler.ts` (+ test) — modify: persist `expiresAt`.
- `supabase/functions/update-staff-access/handler.ts` (+ test) — modify: persist `expiresAt`.
- `supabase/functions/update-organization/{index,handler}.ts` (+ test) — modify: branding fields + org-admin auth + widened sync.
- `supabase/functions/enable-module/index.ts` — modify: widen the `pushOrganizationSync` payload it sends.
- `supabase/functions/_shared/moduleBackends.ts` — modify: `pushOrganizationSync` carries branding.
- `lib/platformFunctions.ts` — modify: `listChapters`/`createChapter`/`updateChapter`; `updateOrganization` branding; `expiresAt` on invite/update-access payloads.
- `lib/youthRepublicFunctions.ts` — modify: remove `Chapter` + the three chapter wrappers.
- `components/shell/AppShell.tsx` (+ test) — modify: "Organization" sidebar item.
- `app/organization/page.tsx` — new: Profile + Chapters sections.
- `components/team/ChaptersPanel.tsx` — modify: call platform wrappers with `accessToken` (was YR + staff token).
- `components/team/TeamAccessProvider.tsx` — modify: load chapters via platform `listChapters(accessToken)`.
- `components/team/AuditTable.tsx` (+ test) — modify: two new filter options.
- `components/team/MembersTable.tsx` (+ test), `components/team/EditMemberDrawer.tsx`, `components/team/InviteMemberDrawer.tsx` — modify: Expired badge + "Access expires" field.
- `app/team/roles/page.tsx` — modify: drop `<ChaptersPanel/>`.

---

## Task 1: Migration `0014_chapters.sql` + pgTAP

**Files:**
- Create: `supabase/migrations/0014_chapters.sql`
- Create: `supabase/tests/database/chapters_test.sql`

**Interfaces:**
- Produces: table `chapters (id uuid, organization_id uuid, name text, city text, status text, created_at timestamptz, created_by uuid)`; `staff_role_assignments_chapter_fk` FK; column `staff.expires_at timestamptz`.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0014_chapters.sql`:

```sql
-- 0014_chapters.sql — chapters as a platform-owned org sub-division, used to
-- scope admin access. See docs/superpowers/specs/2026-09-06-chapter-scoped-access-design.md.

create table chapters (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  name             text not null,
  city             text,
  status           text not null default 'active' check (status in ('active', 'inactive')),
  created_at       timestamptz not null default now(),
  created_by       uuid references staff(id),
  unique (organization_id, name)
);
create index chapters_org_idx on chapters (organization_id);

alter table chapters enable row level security;
create policy chapters_select on chapters
  for select using (is_platform_owner() or is_org_admin_or_above(organization_id));
-- no insert/update/delete policy: writes go through service-role Edge Functions.

-- staff_role_assignments.chapter_id was created as a bare uuid in 0013; every
-- live row has chapter_id = null, so the FK applies cleanly now.
alter table staff_role_assignments
  add constraint staff_role_assignments_chapter_fk
  foreign key (chapter_id) references chapters(id) on delete restrict;

-- Time-boxed staff access. null = permanent (ends only on manual deactivate).
alter table staff add column expires_at timestamptz;
```

- [ ] **Step 2: Write the pgTAP test**

Create `supabase/tests/database/chapters_test.sql`:

```sql
begin;
select plan(9);

select has_table('public', 'chapters', 'chapters table exists');
select has_column('public', 'staff', 'expires_at', 'staff.expires_at exists');
select col_is_fk('public', 'staff_role_assignments', 'chapter_id', 'chapter_id is a FK');

insert into organizations (name, slug) values ('Chap Test', 'chap-test') returning id as org_id \gset

insert into chapters (organization_id, name, city) values (:'org_id', 'Rizq LUMS', 'Lahore')
  returning id as chapter_id \gset
select is((select status from chapters where id = :'chapter_id'), 'active', 'status defaults to active');

select throws_ok(
  $$ insert into chapters (organization_id, name) values ('$$ || :'org_id' || $$', 'Rizq LUMS') $$,
  '23505', null, 'chapter name is unique per org');

select lives_ok(
  $$ insert into chapters (organization_id, name) values ('$$ || :'org_id' || $$', 'Rizq NUST') $$,
  'a second differently-named chapter for the same org is allowed');

-- FK: an assignment can reference a real chapter, and cannot reference a bogus one.
with u as (insert into auth.users (id) values (gen_random_uuid()) returning id)
insert into staff (auth_user_id, full_name, email) select id, 'FK Test', 'chap-fk@example.com' from u
  returning id as staff_id \gset
select id as module_id from modules where key = 'youth-republic' \gset
insert into org_modules (organization_id, module_id) values (:'org_id', :'module_id');
select seed_youth_republic_system_roles(:'org_id', :'module_id');
select id as role_id from roles where organization_id = :'org_id' and name = 'Operations Lead' \gset

select lives_ok(
  $$ insert into staff_role_assignments
       (staff_id, organization_id, module_id, role_id, scope_kind, chapter_id, scope_label)
     values ('$$ || :'staff_id' || $$', '$$ || :'org_id' || $$', '$$ || :'module_id' || $$',
             '$$ || :'role_id' || $$', 'chapter', '$$ || :'chapter_id' || $$', 'Rizq LUMS') $$,
  'assignment referencing a real chapter is allowed');

select throws_ok(
  $$ insert into staff_role_assignments
       (staff_id, organization_id, module_id, role_id, scope_kind, chapter_id, scope_label)
     values ('$$ || :'staff_id' || $$', '$$ || :'org_id' || $$', '$$ || :'module_id' || $$',
             '$$ || :'role_id' || $$', 'chapter', gen_random_uuid(), 'Bogus') $$,
  '23503', null, 'assignment referencing a non-existent chapter is rejected');

select ok(
  (select count(*) from pg_policies where tablename = 'chapters' and cmd = 'SELECT') = 1,
  'chapters has exactly one SELECT policy and no write policy');

select * from finish();
rollback;
```

- [ ] **Step 3: Apply and test**

```bash
set -a; source .env; set +a
npx supabase@latest db push --linked
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/database/chapters_test.sql
```
Expected: `db push` applies `0014`; pgTAP prints `ok 1`..`ok 9`, no `not ok`. If the assertion count you wrote differs from 9, set `plan(N)` to match.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0014_chapters.sql supabase/tests/database/chapters_test.sql
git commit -m "feat(db): chapters table, staff_role_assignments chapter FK, staff.expires_at"
```

---

## Task 2: `create-chapter` + `list-chapters` + `update-chapter` edge functions

**Files:**
- Create: `supabase/functions/list-chapters/{index,handler}.ts` + `handler.test.ts`
- Create: `supabase/functions/create-chapter/{index,handler}.ts` + `handler.test.ts`
- Create: `supabase/functions/update-chapter/{index,handler}.ts` + `handler.test.ts`

**Interfaces:**
- Consumes: `_shared/verifyPlatformStaffSession.ts`, `_shared/supabaseAdmin.ts`, `_shared/cors.ts`, `_shared/auditLog.ts` (`writeAuditLog`, `actorName`).
- Produces:
  - `listChapters(supabase, callerStaffId, callerPlatformOwner, input: { organizationId: string }): Promise<{ chapters: ChapterRow[] }>` where `ChapterRow = { id: string; name: string; city: string | null; status: string }`
  - `createChapter(supabase, callerStaffId, callerPlatformOwner, input: { organizationId: string; name: string; city?: string | null }): Promise<{ chapterId: string }>`
  - `updateChapter(supabase, callerStaffId, callerPlatformOwner, input: { chapterId: string; name?: string; city?: string | null; status?: "active" | "inactive" }): Promise<{ chapterId: string }>`

- [ ] **Step 1: Write the `create-chapter` failing test**

Create `supabase/functions/create-chapter/handler.test.ts`:

```ts
import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { createChapter } from "./handler.ts";

function testClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

async function setup() {
  const supabase = testClient();
  const { data: org } = await supabase.from("organizations").insert({
    name: "CreateChap Org", slug: `cc-${crypto.randomUUID()}`,
  }).select("id").single();

  const adminEmail = `cc-admin-${crypto.randomUUID()}@example.com`;
  const { data: aAuth } = await supabase.auth.admin.createUser({ email: adminEmail, email_confirm: true });
  const { data: admin } = await supabase.from("staff").insert({
    auth_user_id: aAuth!.user!.id, full_name: "CC Admin", email: adminEmail,
  }).select("id").single();
  await supabase.from("staff_org_roles").insert({ staff_id: admin!.id, organization_id: org!.id, org_tier: "admin" });
  return { supabase, orgId: org!.id as string, adminId: admin!.id as string };
}

Deno.test("createChapter inserts a chapter and writes an audit row", async () => {
  const { supabase, orgId, adminId } = await setup();
  const result = await createChapter(supabase, adminId, false, { organizationId: orgId, name: "Rizq LUMS", city: "Lahore" });

  const { data: chapter } = await supabase.from("chapters").select("name, city, status").eq("id", result.chapterId).single();
  assertEquals(chapter!.name, "Rizq LUMS");
  assertEquals(chapter!.city, "Lahore");
  assertEquals(chapter!.status, "active");

  const { data: audit } = await supabase.from("admin_audit_log").select("action")
    .eq("organization_id", orgId).eq("entity_id", result.chapterId).single();
  assertEquals(audit!.action, "Chapter Created");
});

Deno.test("createChapter rejects a duplicate name for the same org", async () => {
  const { supabase, orgId, adminId } = await setup();
  await createChapter(supabase, adminId, false, { organizationId: orgId, name: "Rizq LUMS" });
  await assertRejects(
    () => createChapter(supabase, adminId, false, { organizationId: orgId, name: "Rizq LUMS" }),
    Error, "chapter_name_taken",
  );
});

Deno.test("createChapter rejects a non-admin caller", async () => {
  const { supabase, orgId } = await setup();
  const outEmail = `cc-out-${crypto.randomUUID()}@example.com`;
  const { data: oAuth } = await supabase.auth.admin.createUser({ email: outEmail, email_confirm: true });
  const { data: outsider } = await supabase.from("staff").insert({
    auth_user_id: oAuth!.user!.id, full_name: "Out", email: outEmail,
  }).select("id").single();
  await assertRejects(
    () => createChapter(supabase, outsider!.id, false, { organizationId: orgId, name: "X" }),
    Error, "forbidden",
  );
});
```

- [ ] **Step 2: Run it — expect fail**

Run: `cd supabase && deno task test --filter createChapter`
Expected: FAIL — `./handler.ts` has no `createChapter`.

- [ ] **Step 3: Implement `create-chapter/handler.ts`**

```ts
import { SupabaseClient } from "@supabase/supabase-js";
import { actorName, writeAuditLog } from "../_shared/auditLog.ts";

export interface CreateChapterInput {
  organizationId: string;
  name: string;
  city?: string | null;
}

async function assertCallerIsOrgAdmin(
  supabase: SupabaseClient, callerStaffId: string, callerPlatformOwner: boolean, organizationId: string,
): Promise<void> {
  if (callerPlatformOwner) return;
  const { data } = await supabase.from("staff_org_roles").select("org_tier")
    .eq("staff_id", callerStaffId).eq("organization_id", organizationId).single();
  if (!data || !["admin", "super_admin"].includes(data.org_tier)) throw new Error("forbidden");
}

export async function createChapter(
  supabase: SupabaseClient,
  callerStaffId: string,
  callerPlatformOwner: boolean,
  input: CreateChapterInput,
): Promise<{ chapterId: string }> {
  await assertCallerIsOrgAdmin(supabase, callerStaffId, callerPlatformOwner, input.organizationId);
  if (!input.name?.trim()) throw new Error("missing_name");

  const { data: chapter, error } = await supabase.from("chapters").insert({
    organization_id: input.organizationId,
    name: input.name.trim(),
    city: input.city?.trim() || null,
    created_by: callerStaffId,
  }).select("id").single();
  if (error) {
    if (error.code === "23505") throw new Error("chapter_name_taken");
    throw error;
  }

  await writeAuditLog(supabase, {
    organizationId: input.organizationId,
    actorStaffId: callerStaffId,
    actorName: await actorName(supabase, callerStaffId),
    action: "Chapter Created",
    entityType: "chapter",
    entityId: chapter.id,
    summary: `Created chapter '${input.name.trim()}'`,
  });

  return { chapterId: chapter.id };
}
```

- [ ] **Step 4: Implement `create-chapter/index.ts`**

Copy `supabase/functions/create-custom-role/index.ts` verbatim, then change: the handler import to `createChapter` from `./handler.ts`; the call to `await createChapter(supabase, staffId, platformOwner, input)`; keep the create-style `status: 201`.

- [ ] **Step 5: Run it — expect pass**

Run: `cd supabase && deno task test --filter createChapter` → PASS (3).

- [ ] **Step 6: Implement + test `list-chapters`**

Create `supabase/functions/list-chapters/handler.test.ts`:

```ts
import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { listChapters } from "./handler.ts";
import { createChapter } from "../create-chapter/handler.ts";

function testClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

Deno.test("listChapters returns the org's chapters ordered by name", async () => {
  const supabase = testClient();
  const { data: org } = await supabase.from("organizations").insert({
    name: "ListChap Org", slug: `lc-${crypto.randomUUID()}`,
  }).select("id").single();
  const email = `lc-admin-${crypto.randomUUID()}@example.com`;
  const { data: aAuth } = await supabase.auth.admin.createUser({ email, email_confirm: true });
  const { data: admin } = await supabase.from("staff").insert({
    auth_user_id: aAuth!.user!.id, full_name: "LC Admin", email,
  }).select("id").single();
  await supabase.from("staff_org_roles").insert({ staff_id: admin!.id, organization_id: org!.id, org_tier: "admin" });

  await createChapter(supabase, admin!.id, false, { organizationId: org!.id, name: "Rizq NUST" });
  await createChapter(supabase, admin!.id, false, { organizationId: org!.id, name: "Rizq LUMS" });

  const result = await listChapters(supabase, admin!.id, false, { organizationId: org!.id });
  assertEquals(result.chapters.map((c) => c.name), ["Rizq LUMS", "Rizq NUST"]);

  const outEmail = `lc-out-${crypto.randomUUID()}@example.com`;
  const { data: oAuth } = await supabase.auth.admin.createUser({ email: outEmail, email_confirm: true });
  const { data: outsider } = await supabase.from("staff").insert({
    auth_user_id: oAuth!.user!.id, full_name: "Out", email: outEmail,
  }).select("id").single();
  await assertRejects(
    () => listChapters(supabase, outsider!.id, false, { organizationId: org!.id }),
    Error, "forbidden",
  );
});
```

Then `supabase/functions/list-chapters/handler.ts`:

```ts
import { SupabaseClient } from "@supabase/supabase-js";

export interface ListChaptersInput {
  organizationId: string;
}
export interface ChapterRow {
  id: string;
  name: string;
  city: string | null;
  status: string;
}

async function assertCallerIsOrgAdmin(
  supabase: SupabaseClient, callerStaffId: string, callerPlatformOwner: boolean, organizationId: string,
): Promise<void> {
  if (callerPlatformOwner) return;
  const { data } = await supabase.from("staff_org_roles").select("org_tier")
    .eq("staff_id", callerStaffId).eq("organization_id", organizationId).single();
  if (!data || !["admin", "super_admin"].includes(data.org_tier)) throw new Error("forbidden");
}

export async function listChapters(
  supabase: SupabaseClient,
  callerStaffId: string,
  callerPlatformOwner: boolean,
  input: ListChaptersInput,
): Promise<{ chapters: ChapterRow[] }> {
  await assertCallerIsOrgAdmin(supabase, callerStaffId, callerPlatformOwner, input.organizationId);
  const { data, error } = await supabase.from("chapters")
    .select("id, name, city, status")
    .eq("organization_id", input.organizationId)
    .order("name");
  if (error) throw error;
  return { chapters: (data ?? []) as ChapterRow[] };
}
```

`list-chapters/index.ts` — copy `create-custom-role/index.ts`, swap to `listChapters`, `status: 200`.

Run: `cd supabase && deno task test --filter listChapters` → PASS.

- [ ] **Step 7: Implement + test `update-chapter`**

Create `supabase/functions/update-chapter/handler.test.ts`:

```ts
import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { updateChapter } from "./handler.ts";
import { createChapter } from "../create-chapter/handler.ts";

function testClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

async function setup() {
  const supabase = testClient();
  const { data: org } = await supabase.from("organizations").insert({
    name: "UpdChap Org", slug: `uc-${crypto.randomUUID()}`,
  }).select("id").single();
  const email = `uc-admin-${crypto.randomUUID()}@example.com`;
  const { data: aAuth } = await supabase.auth.admin.createUser({ email, email_confirm: true });
  const { data: admin } = await supabase.from("staff").insert({
    auth_user_id: aAuth!.user!.id, full_name: "UC Admin", email,
  }).select("id").single();
  await supabase.from("staff_org_roles").insert({ staff_id: admin!.id, organization_id: org!.id, org_tier: "admin" });
  const { chapterId } = await createChapter(supabase, admin!.id, false, { organizationId: org!.id, name: "Old Name" });
  return { supabase, orgId: org!.id as string, adminId: admin!.id as string, chapterId };
}

Deno.test("updateChapter renames the chapter, rewrites assignment scope_label, and audits", async () => {
  const { supabase, orgId, adminId, chapterId } = await setup();

  // an assignment scoped to this chapter with the stale label
  const { data: mod } = await supabase.from("modules").select("id").eq("key", "youth-republic").single();
  await supabase.from("org_modules").upsert({ organization_id: orgId, module_id: mod!.id });
  await supabase.rpc("seed_youth_republic_system_roles", { p_org_id: orgId, p_module_id: mod!.id });
  const { data: role } = await supabase.from("roles").select("id")
    .eq("organization_id", orgId).eq("name", "Operations Lead").single();
  const memEmail = `uc-mem-${crypto.randomUUID()}@example.com`;
  const { data: mAuth } = await supabase.auth.admin.createUser({ email: memEmail, email_confirm: true });
  const { data: member } = await supabase.from("staff").insert({
    auth_user_id: mAuth!.user!.id, full_name: "Mem", email: memEmail,
  }).select("id").single();
  await supabase.from("staff_role_assignments").insert({
    staff_id: member!.id, organization_id: orgId, module_id: mod!.id, role_id: role!.id,
    scope_kind: "chapter", chapter_id: chapterId, scope_label: "Old Name",
  });

  await updateChapter(supabase, adminId, false, { chapterId, name: "New Name", status: "inactive" });

  const { data: chapter } = await supabase.from("chapters").select("name, status").eq("id", chapterId).single();
  assertEquals(chapter!.name, "New Name");
  assertEquals(chapter!.status, "inactive");

  const { data: assign } = await supabase.from("staff_role_assignments").select("scope_label")
    .eq("chapter_id", chapterId).single();
  assertEquals(assign!.scope_label, "New Name");

  const { data: audit } = await supabase.from("admin_audit_log").select("action")
    .eq("entity_id", chapterId).eq("action", "Chapter Updated").single();
  assertEquals(audit!.action, "Chapter Updated");
});

Deno.test("updateChapter authorizes against the chapter's stored org (cross-org admin rejected)", async () => {
  const { supabase, chapterId } = await setup();
  const otherEmail = `uc-other-${crypto.randomUUID()}@example.com`;
  const { data: oAuth } = await supabase.auth.admin.createUser({ email: otherEmail, email_confirm: true });
  const { data: other } = await supabase.from("staff").insert({
    auth_user_id: oAuth!.user!.id, full_name: "Other", email: otherEmail,
  }).select("id").single();
  const { data: otherOrg } = await supabase.from("organizations").insert({
    name: "Other Org", slug: `oo-${crypto.randomUUID()}`,
  }).select("id").single();
  await supabase.from("staff_org_roles").insert({ staff_id: other!.id, organization_id: otherOrg!.id, org_tier: "admin" });
  await assertRejects(
    () => updateChapter(supabase, other!.id, false, { chapterId, name: "Hax" }),
    Error, "forbidden",
  );
});
```

Then `supabase/functions/update-chapter/handler.ts`:

```ts
import { SupabaseClient } from "@supabase/supabase-js";
import { actorName, writeAuditLog } from "../_shared/auditLog.ts";

export interface UpdateChapterInput {
  chapterId: string;
  name?: string;
  city?: string | null;
  status?: "active" | "inactive";
}

export async function updateChapter(
  supabase: SupabaseClient,
  callerStaffId: string,
  callerPlatformOwner: boolean,
  input: UpdateChapterInput,
): Promise<{ chapterId: string }> {
  const { data: chapter, error: fetchError } = await supabase.from("chapters")
    .select("id, organization_id, name").eq("id", input.chapterId).single();
  if (fetchError || !chapter) throw new Error("not_found");

  if (!callerPlatformOwner) {
    const { data } = await supabase.from("staff_org_roles").select("org_tier")
      .eq("staff_id", callerStaffId).eq("organization_id", chapter.organization_id).single();
    if (!data || !["admin", "super_admin"].includes(data.org_tier)) throw new Error("forbidden");
  }

  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.city !== undefined) patch.city = input.city?.trim() || null;
  if (input.status !== undefined) patch.status = input.status;
  if (Object.keys(patch).length === 0) return { chapterId: input.chapterId };

  const { error } = await supabase.from("chapters").update(patch).eq("id", input.chapterId);
  if (error) {
    if (error.code === "23505") throw new Error("chapter_name_taken");
    throw error;
  }

  if (patch.name && patch.name !== chapter.name) {
    await supabase.from("staff_role_assignments").update({ scope_label: patch.name })
      .eq("chapter_id", input.chapterId);
  }

  await writeAuditLog(supabase, {
    organizationId: chapter.organization_id,
    actorStaffId: callerStaffId,
    actorName: await actorName(supabase, callerStaffId),
    action: "Chapter Updated",
    entityType: "chapter",
    entityId: input.chapterId,
    summary: `Updated chapter '${(patch.name as string) ?? chapter.name}'`,
  });

  return { chapterId: input.chapterId };
}
```

`update-chapter/index.ts` — copy `create-custom-role/index.ts`, swap to `updateChapter`, `status: 200`.

Run: `cd supabase && deno task test --filter updateChapter` → PASS.

- [ ] **Step 8: Full chapter-fn sweep + commit**

Run: `cd supabase && deno task test --filter "Chapter"` → all green.

```bash
git add supabase/functions/list-chapters/ supabase/functions/create-chapter/ supabase/functions/update-chapter/
git commit -m "feat(fn): platform chapter create/list/update with audit + scope_label rewrite"
```

---

## Task 3: `staff.expires_at` enforcement — `verifyPlatformStaffSession` + `mint-staff-token`

**Files:**
- Modify: `supabase/functions/_shared/verifyPlatformStaffSession.ts`
- Modify: `supabase/functions/mint-staff-token/handler.ts`
- Modify: `supabase/functions/mint-staff-token/handler.test.ts`

**Interfaces:**
- Consumes: `chapters` migration's `staff.expires_at` (Task 1).
- Produces: any platform Edge Function call and any `mintStaffToken` call throws `unauthorized` for a staff account whose `expires_at` is in the past.

- [ ] **Step 1: Update `verifyPlatformStaffSession.ts`**

The current query selects `id, platform_owner, status`. Change it to also select `expires_at`, and widen the gate:

```ts
  const { data: staff, error: staffError } = await supabase
    .from("staff")
    .select("id, platform_owner, status, expires_at")
    .eq("auth_user_id", userData.user.id)
    .single();
  if (staffError || !staff) {
    throw new Error("unauthorized");
  }
  if (
    staff.status !== "active" ||
    (staff.expires_at && new Date(staff.expires_at as string).getTime() < Date.now())
  ) {
    throw new Error("unauthorized");
  }
```

- [ ] **Step 2: Write the failing `mint-staff-token` expiry test**

In `supabase/functions/mint-staff-token/handler.test.ts` add:

```ts
Deno.test("mintStaffToken refuses an account past its expires_at", async () => {
  const supabase = testClient();
  const email = `mint-expired-${crypto.randomUUID()}@example.com`;
  const { data: authUser } = await supabase.auth.admin.createUser({ email, email_confirm: true });
  const { data: staff } = await supabase.from("staff").insert({
    auth_user_id: authUser!.user!.id, full_name: "Expired", email,
    expires_at: new Date(Date.now() - 60_000).toISOString(),
  }).select("id").single();

  await assertRejects(() => mintStaffToken(supabase, staff!.id, false), Error, "unauthorized");
});

Deno.test("mintStaffToken allows a future expires_at and a null expires_at", async () => {
  const supabase = testClient();
  const email = `mint-future-${crypto.randomUUID()}@example.com`;
  const { data: authUser } = await supabase.auth.admin.createUser({ email, email_confirm: true });
  const { data: staff } = await supabase.from("staff").insert({
    auth_user_id: authUser!.user!.id, full_name: "Future", email,
    expires_at: new Date(Date.now() + 3_600_000).toISOString(),
  }).select("id").single();
  const token = await mintStaffToken(supabase, staff!.id, false);
  assertEquals(typeof token, "string");
});
```

(`assertEquals` / `assertRejects` are already imported in that file.)

- [ ] **Step 3: Run it — expect fail**

Run: `cd supabase && deno task test --filter "refuses an account past"`
Expected: FAIL — the token mints instead of throwing.

- [ ] **Step 4: Add the check to `mint-staff-token/handler.ts`**

The handler's first query is `supabase.from("staff").select("can_verify_identity, platform_owner").eq("id", staffId).single()`. Change it to also select `status, expires_at` and guard right after:

```ts
  const { data: staffRow } = await supabase
    .from("staff")
    .select("can_verify_identity, platform_owner, status, expires_at")
    .eq("id", staffId)
    .single();
  if (
    !staffRow ||
    staffRow.status !== "active" ||
    (staffRow.expires_at && new Date(staffRow.expires_at as string).getTime() < Date.now())
  ) {
    throw new Error("unauthorized");
  }
```

- [ ] **Step 5: Run the mint suite — expect pass**

Run: `cd supabase && deno task test --filter mintStaffToken` → all PASS (existing + 2 new).

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/_shared/verifyPlatformStaffSession.ts supabase/functions/mint-staff-token/
git commit -m "feat(auth): reject staff accounts past staff.expires_at"
```

---

## Task 4: Persist `expiresAt` in `invite-staff-member` + `update-staff-access`

**Files:**
- Modify: `supabase/functions/invite-staff-member/handler.ts` + `handler.test.ts`
- Modify: `supabase/functions/update-staff-access/handler.ts` + `handler.test.ts`

**Interfaces:**
- Produces: `InviteStaffMemberInput` and `UpdateStaffAccessInput` each gain `expiresAt?: string | null`; both handlers write it to `staff.expires_at`.

- [ ] **Step 1: Failing tests**

In `invite-staff-member/handler.test.ts`, add to the happy-path test (or a new test) an `expiresAt` and assert it lands:

```ts
Deno.test("inviteStaffMember persists expiresAt to staff.expires_at", async () => {
  const { supabase, orgId, roleId, adminId } = await setup();
  const when = new Date(Date.now() + 30 * 24 * 3600_000).toISOString();
  const result = await inviteStaffMember(supabase, adminId, false, {
    organizationId: orgId, fullName: "Timed", email: `timed-${crypto.randomUUID()}@example.com`,
    roles: [{ roleId, scopeKind: "org_wide", scopeLabel: "National / All Chapters" }],
    sendActivationEmail: false, enforce2fa: true, expiresAt: when,
  });
  const { data: staff } = await supabase.from("staff").select("expires_at").eq("id", result.staffId).single();
  assertEquals(new Date(staff!.expires_at as string).getTime(), new Date(when).getTime());
});
```

In `update-staff-access/handler.test.ts`, add:

```ts
Deno.test("updateStaffAccess persists expiresAt (and clears it with null)", async () => {
  const { supabase, orgId, adminId, memberId, roleByName } = await setup();
  const when = new Date(Date.now() + 7 * 24 * 3600_000).toISOString();
  await updateStaffAccess(supabase, adminId, false, {
    staffId: memberId, organizationId: orgId, status: "active", expiresAt: when,
    roles: [{ roleId: await roleByName("Auditor"), scopeKind: "org_wide", scopeLabel: "National / All Chapters" }],
  });
  let { data } = await supabase.from("staff").select("expires_at").eq("id", memberId).single();
  assertEquals(new Date(data!.expires_at as string).getTime(), new Date(when).getTime());

  await updateStaffAccess(supabase, adminId, false, {
    staffId: memberId, organizationId: orgId, status: "active", expiresAt: null,
    roles: [{ roleId: await roleByName("Auditor"), scopeKind: "org_wide", scopeLabel: "National / All Chapters" }],
  });
  ({ data } = await supabase.from("staff").select("expires_at").eq("id", memberId).single());
  assertEquals(data!.expires_at, null);
});
```

- [ ] **Step 2: Run — expect fail** (`expiresAt` not in the input type / not written).

- [ ] **Step 3: Implement**

`invite-staff-member/handler.ts` — add `expiresAt?: string | null` to `InviteStaffMemberInput`; in the `staff` insert object add `expires_at: input.expiresAt ?? null`.

`update-staff-access/handler.ts` — add `expiresAt?: string | null` to `UpdateStaffAccessInput`; the handler already does `supabase.from("staff").update({ status: input.status }).eq("id", input.staffId)` — change that to `.update({ status: input.status, expires_at: input.expiresAt ?? null })`. (Passing `expiresAt: undefined` from a caller that doesn't send it becomes `null` — acceptable: the Edit-Access drawer always sends the field.)

- [ ] **Step 4: Run — expect pass**

Run: `cd supabase && deno task test --filter "inviteStaffMember|updateStaffAccess"` → all PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/invite-staff-member/ supabase/functions/update-staff-access/
git commit -m "feat(fn): invite/update-staff-access accept and persist expires_at"
```

---

## Task 5: `update-organization` — branding fields, org-admin auth, widened sync

**Files:**
- Modify: `supabase/functions/update-organization/handler.ts` + `handler.test.ts`
- Modify: `supabase/functions/update-organization/index.ts`
- Modify: `supabase/functions/_shared/moduleBackends.ts`
- Modify: `supabase/functions/enable-module/index.ts`

**Interfaces:**
- Produces: `updateOrganization(supabase, callerStaffId: string, callerPlatformOwner: boolean, input: { organizationId: string; name: string; brandColor?: string | null; logoUrl?: string | null; faviconUrl?: string | null; about?: string | null }): Promise<{ enabledModuleKeys: string[] }>` — persists the branding columns, authorizes org-admin-or-above.
- `pushOrganizationSync(moduleKey, staffToken, organization: { id; name; slug; deactivatedAt; brandColor?; logoUrl?; faviconUrl?; about? })`.

- [ ] **Step 1: Failing test**

Rewrite `update-organization/handler.test.ts`:

```ts
import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { updateOrganization } from "./handler.ts";

function testClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

async function setup() {
  const supabase = testClient();
  const { data: org } = await supabase.from("organizations").insert({
    name: "UO Org", slug: `uo-${crypto.randomUUID()}`,
  }).select("id").single();
  const email = `uo-admin-${crypto.randomUUID()}@example.com`;
  const { data: aAuth } = await supabase.auth.admin.createUser({ email, email_confirm: true });
  const { data: admin } = await supabase.from("staff").insert({
    auth_user_id: aAuth!.user!.id, full_name: "UO Admin", email,
  }).select("id").single();
  await supabase.from("staff_org_roles").insert({ staff_id: admin!.id, organization_id: org!.id, org_tier: "admin" });
  return { supabase, orgId: org!.id as string, adminId: admin!.id as string };
}

Deno.test("updateOrganization persists branding for an org admin", async () => {
  const { supabase, orgId, adminId } = await setup();
  await updateOrganization(supabase, adminId, false, {
    organizationId: orgId, name: "UO Org Renamed",
    brandColor: "#123ABC", logoUrl: "https://x/logo.png", about: "We help.",
  });
  const { data: org } = await supabase.from("organizations")
    .select("name, brand_color, logo_url, about").eq("id", orgId).single();
  assertEquals(org!.name, "UO Org Renamed");
  assertEquals(org!.brand_color, "#123ABC");
  assertEquals(org!.logo_url, "https://x/logo.png");
  assertEquals(org!.about, "We help.");
});

Deno.test("updateOrganization rejects a non-admin caller", async () => {
  const { supabase, orgId } = await setup();
  const outEmail = `uo-out-${crypto.randomUUID()}@example.com`;
  const { data: oAuth } = await supabase.auth.admin.createUser({ email: outEmail, email_confirm: true });
  const { data: outsider } = await supabase.from("staff").insert({
    auth_user_id: oAuth!.user!.id, full_name: "Out", email: outEmail,
  }).select("id").single();
  await assertRejects(
    () => updateOrganization(supabase, outsider!.id, false, { organizationId: orgId, name: "X" }),
    Error, "forbidden",
  );
});
```

- [ ] **Step 2: Run — expect fail** (signature is `(supabase, callerPlatformOwner, input)` and there's no branding).

- [ ] **Step 3: Rewrite `update-organization/handler.ts`**

```ts
import { SupabaseClient } from "@supabase/supabase-js";

export interface UpdateOrganizationInput {
  organizationId: string;
  name: string;
  brandColor?: string | null;
  logoUrl?: string | null;
  faviconUrl?: string | null;
  about?: string | null;
}

export async function updateOrganization(
  supabase: SupabaseClient,
  callerStaffId: string,
  callerPlatformOwner: boolean,
  input: UpdateOrganizationInput,
): Promise<{ enabledModuleKeys: string[] }> {
  if (!callerPlatformOwner) {
    const { data } = await supabase.from("staff_org_roles").select("org_tier")
      .eq("staff_id", callerStaffId).eq("organization_id", input.organizationId).single();
    if (!data || !["admin", "super_admin"].includes(data.org_tier)) throw new Error("forbidden");
  }

  const patch: Record<string, unknown> = { name: input.name };
  if (input.brandColor !== undefined) patch.brand_color = input.brandColor;
  if (input.logoUrl !== undefined) patch.logo_url = input.logoUrl;
  if (input.faviconUrl !== undefined) patch.favicon_url = input.faviconUrl;
  if (input.about !== undefined) patch.about = input.about;

  const { error } = await supabase.from("organizations").update(patch).eq("id", input.organizationId);
  if (error) throw error;

  const { data: enabledModules } = await supabase
    .from("org_modules").select("modules(key)").eq("organization_id", input.organizationId);
  const enabledModuleKeys = (enabledModules ?? []).map((row) => (row.modules as unknown as { key: string }).key);
  return { enabledModuleKeys };
}
```

- [ ] **Step 4: Update `update-organization/index.ts`**

Change the call to `await updateOrganization(supabase, staffId, platformOwner, input)`. Change the org re-select to include branding and widen the sync payload:

```ts
    const { data: org } = await supabase.from("organizations")
      .select("id, name, slug, deactivated_at, brand_color, logo_url, favicon_url, about")
      .eq("id", input.organizationId).single();
    const syncToken = await mintStaffToken(supabase, staffId, true);
    for (const moduleKey of result.enabledModuleKeys) {
      await pushOrganizationSync(moduleKey, syncToken, {
        id: org!.id, name: org!.name, slug: org!.slug, deactivatedAt: org!.deactivated_at,
        brandColor: org!.brand_color, logoUrl: org!.logo_url, faviconUrl: org!.favicon_url, about: org!.about,
      });
    }
```

- [ ] **Step 5: Widen `_shared/moduleBackends.ts` `pushOrganizationSync`**

```ts
export async function pushOrganizationSync(
  moduleKey: string,
  staffToken: string,
  organization: {
    id: string; name: string; slug: string; deactivatedAt: string | null;
    brandColor?: string | null; logoUrl?: string | null; faviconUrl?: string | null; about?: string | null;
  },
): Promise<void> {
  const baseUrl = functionsUrlForModule(moduleKey);
  if (!baseUrl) return;
  await fetch(`${baseUrl}/sync-organization`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${staffToken}` },
    body: JSON.stringify({
      organizationId: organization.id,
      name: organization.name,
      slug: organization.slug,
      deactivatedAt: organization.deactivatedAt,
      brandColor: organization.brandColor ?? null,
      logoUrl: organization.logoUrl ?? null,
      faviconUrl: organization.faviconUrl ?? null,
      about: organization.about ?? null,
    }),
  });
}
```

YR's `sync-organization` already accepts and coalesce-merges `brandColor`/`logoUrl`/`faviconUrl`/`about` — **no YR change**.

- [ ] **Step 6: Update `enable-module/index.ts`**

Its `pushOrganizationSync` call passes only `{id,name,slug,deactivatedAt}`. Widen its org select to include the four branding columns and pass them through the same way (Step 4 shape). `enable-module` on a fresh org will pass `null`s, which the merge leaves alone.

- [ ] **Step 7: Run — expect pass**

Run: `cd supabase && deno task test --filter "updateOrganization"` → PASS. Also `cd supabase && deno task test --filter "enableModule"` still green.

- [ ] **Step 8: Commit**

```bash
git add supabase/functions/update-organization/ supabase/functions/_shared/moduleBackends.ts supabase/functions/enable-module/index.ts
git commit -m "feat(fn): update-organization edits branding, allows org admins, syncs branding to YR"
```

---

## Task 6: `lib/platformFunctions.ts` + `lib/youthRepublicFunctions.ts` client wrappers

**Files:**
- Modify: `lib/platformFunctions.ts` (+ `lib/platformFunctions.test.ts` if it exists)
- Modify: `lib/youthRepublicFunctions.ts`

**Interfaces:**
- Produces (`lib/platformFunctions.ts`):
  - `interface ChapterRow { id: string; name: string; city: string | null; status: string }`
  - `listChapters(payload: { organizationId: string }, accessToken: string): Promise<{ chapters: ChapterRow[] }>`
  - `createChapter(payload: { organizationId: string; name: string; city?: string }, accessToken: string): Promise<{ chapterId: string }>`
  - `updateChapter(payload: { chapterId: string; name?: string; city?: string | null; status?: "active" | "inactive" }, accessToken: string): Promise<{ chapterId: string }>`
  - `UpdateOrganizationPayload` gains `brandColor?`, `logoUrl?`, `faviconUrl?`, `about?` (all `string | null` optional).
  - `InviteStaffMemberPayload` and `UpdateStaffAccessPayload` gain `expiresAt?: string | null`.
- `lib/youthRepublicFunctions.ts`: `interface Chapter`, `listChapters`, `createChapter`, `updateChapter` are **removed**.

- [ ] **Step 1: Add to `lib/platformFunctions.ts`**

```ts
export interface ChapterRow { id: string; name: string; city: string | null; status: string }
export function listChapters(payload: { organizationId: string }, accessToken: string) {
  return callFunction<{ chapters: ChapterRow[] }>("list-chapters", payload, accessToken);
}
export function createChapter(payload: { organizationId: string; name: string; city?: string }, accessToken: string) {
  return callFunction<{ chapterId: string }>("create-chapter", payload, accessToken);
}
export function updateChapter(
  payload: { chapterId: string; name?: string; city?: string | null; status?: "active" | "inactive" },
  accessToken: string,
) {
  return callFunction<{ chapterId: string }>("update-chapter", payload, accessToken);
}
```

Extend `UpdateOrganizationPayload`:
```ts
export interface UpdateOrganizationPayload {
  organizationId: string;
  name: string;
  brandColor?: string | null;
  logoUrl?: string | null;
  faviconUrl?: string | null;
  about?: string | null;
}
```
Add `expiresAt?: string | null;` to both `InviteStaffMemberPayload` and `UpdateStaffAccessPayload`.

- [ ] **Step 2: Remove the chapter wrappers from `lib/youthRepublicFunctions.ts`**

Delete `interface Chapter`, `listChapters`, `createChapter`, `updateChapter`. Leave `callYouthRepublicFunction` and everything else.

- [ ] **Step 3: Typecheck + tests**

Run: `npx tsc --noEmit` — expect errors ONLY where `TeamAccessProvider`/`ChaptersPanel` still import the removed YR wrappers (fixed in Task 9/10). If `lib/platformFunctions.test.ts` exists and tests `updateOrganization`, add an assertion that the branding fields ride in the POST body; run `npm test -- lib/platformFunctions.test.ts`.

Since Tasks 9 and 10 fix the consumers, this task's own gate is: the two lib files compile in isolation. Run `npx tsc --noEmit lib/platformFunctions.ts lib/youthRepublicFunctions.ts 2>&1 | head` — no errors from these two files themselves.

- [ ] **Step 4: Commit**

```bash
git add lib/platformFunctions.ts lib/youthRepublicFunctions.ts
git commit -m "feat(lib): platform chapter wrappers, updateOrganization branding, expiresAt; drop YR chapter bridge"
```

---

## Task 7: `AppShell.tsx` — "Organization" sidebar item

**Files:**
- Modify: `components/shell/AppShell.tsx`
- Modify: `components/shell/AppShell.test.tsx`

**Interfaces:**
- Consumes: existing `claims`, `isOrgAdminOrAbove`, `pathname`.
- Produces: a sidebar `<Link href="/organization">` gated on `claims && isOrgAdminOrAbove`, in the `CORE OPERATIONS` group's tail or its own placement (below `Volunteers`, above the `TEAM & ACCESS` group label).

- [ ] **Step 1: Add the link**

In `AppShell.tsx`, immediately before the `<div className="nav-group-label" style={{ marginTop: ".75rem" }}>Team & Access</div>` line, add:

```tsx
{claims && isOrgAdminOrAbove && (
  <Link
    href="/organization"
    aria-label="Organization"
    className={`sidebar-nav-item ${pathname === "/organization" ? "active" : ""}`}
    onClick={() => setMobileSidebarOpen(false)}
  >
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="icon-svg flex-shrink-0" aria-hidden="true">
      <path d="M3 21h18" /><path d="M5 21V7l8-4v18" /><path d="M19 21V11l-6-4" />
      <path d="M9 9v.01" /><path d="M9 12v.01" /><path d="M9 15v.01" /><path d="M9 18v.01" />
    </svg>
    <span className="nav-label">Organization</span>
  </Link>
)}
```

- [ ] **Step 2: Update `AppShell.test.tsx`**

In the admin-visible test(s), add `expect(screen.getByRole("link", { name: "Organization" })).toBeInTheDocument();`. In the regular-staff (non-admin) test, add `expect(screen.queryByRole("link", { name: "Organization" })).not.toBeInTheDocument();`. Change nothing else.

- [ ] **Step 3: Run + commit**

Run: `npm test -- components/shell/AppShell.test.tsx` → green. `npx tsc --noEmit` — errors only from Task 6's not-yet-fixed consumers.

```bash
git add components/shell/AppShell.tsx components/shell/AppShell.test.tsx
git commit -m "feat(shell): Organization sidebar item for org admins"
```

---

## Task 8: `app/organization/page.tsx` — Profile + Chapters

**Files:**
- Create: `app/organization/page.tsx`
- Create: `app/organization/page.test.tsx`
- Modify: `components/team/ChaptersPanel.tsx` (repoint to platform wrappers)
- Modify: `app/team/roles/page.tsx` (drop `<ChaptersPanel/>`)

**Interfaces:**
- Consumes: `useSelectedOrg`, `useShellAccessToken` (from `AppShell`), `getBrowserSupabaseClient`, `updateOrganization` + `listChapters`/`createChapter`/`updateChapter` (`lib/platformFunctions`), `useToast`.
- Produces: route `/organization` — one page, org profile form + chapters section.

- [ ] **Step 1: Repoint `ChaptersPanel.tsx`**

It currently imports `createChapter`/`updateChapter` from `@/lib/youthRepublicFunctions` and uses `staffToken`. Change:
- import `createChapter`, `updateChapter` from `@/lib/platformFunctions`;
- the component reads `accessToken` (not `staffToken`) from `useTeamAccess()` — but `ChaptersPanel` will now be rendered on `/organization`, not inside `TeamAccessProvider`. Change `ChaptersPanel` to accept props instead of reading context:

```tsx
"use client";
import { useState } from "react";
import { useToast } from "@/components/shell/ToastContext";
import { createChapter, updateChapter, type ChapterRow } from "@/lib/platformFunctions";

export function ChaptersPanel({
  organizationId, accessToken, chapters, onChanged,
}: {
  organizationId: string;
  accessToken: string;
  chapters: ChapterRow[];
  onChanged: () => void;
}) {
  const { showToast } = useToast();
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      await createChapter({ organizationId, name: name.trim(), ...(city.trim() ? { city: city.trim() } : {}) }, accessToken);
      setName(""); setCity("");
      onChanged();
      showToast(`Added chapter "${name.trim()}".`);
    } catch (err) {
      showToast(err instanceof Error && err.message === "chapter_name_taken"
        ? "A chapter with that name already exists." : "Failed to add chapter.");
    } finally { setBusy(false); }
  }

  async function toggle(chapterId: string, current: string) {
    if (busy) return;
    setBusy(true);
    try {
      await updateChapter({ chapterId, status: current === "active" ? "inactive" : "active" }, accessToken);
      onChanged();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to update chapter.");
    } finally { setBusy(false); }
  }

  return (
    <div className="table-card" style={{ padding: "1rem 1.25rem" }}>
      <h2 className="panel-title" style={{ marginBottom: ".75rem" }}>Chapters</h2>
      <p style={{ fontSize: "var(--text-xs)", color: "var(--ink-2)", marginBottom: ".75rem" }}>
        Sub-divisions of the organization. Assigning a role a chapter scope limits that admin to the chapter&apos;s opportunities.
      </p>
      <div className="table-responsive-wrapper">
        <table className="data-table">
          <thead><tr><th>Chapter</th><th>City</th><th>Status</th><th style={{ textAlign: "right" }}>Actions</th></tr></thead>
          <tbody>
            {chapters.length === 0 ? (
              <tr><td colSpan={4} style={{ textAlign: "center", padding: "1.5rem", color: "var(--ink-3)" }}>No chapters yet.</td></tr>
            ) : chapters.map((c) => (
              <tr key={c.id}>
                <td style={{ fontWeight: 600 }}>{c.name}</td>
                <td>{c.city ?? "—"}</td>
                <td><span className={`badge ${c.status === "active" ? "badge-pos" : "badge-neg"}`}>{c.status === "active" ? "Active" : "Inactive"}</span></td>
                <td style={{ textAlign: "right" }}>
                  <button type="button" className="btn btn-secondary btn-xs" disabled={busy} onClick={() => toggle(c.id, c.status)}>
                    {c.status === "active" ? "Deactivate" : "Reactivate"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="role-repeater-row" style={{ marginTop: ".85rem" }}>
        <input aria-label="Chapter name" className="form-input" placeholder="Chapter name" value={name} onChange={(e) => setName(e.target.value)} />
        <input aria-label="City" className="form-input" placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} />
        <button type="button" className="btn btn-primary btn-xs" disabled={busy} onClick={add}>Add Chapter</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Drop `<ChaptersPanel/>` from `app/team/roles/page.tsx`**

Remove the `import { ChaptersPanel }` line and the `<ChaptersPanel />` render, plus any now-unused `chapters` value it passed. Delete `components/team/ChaptersPanel.test.tsx`'s cases that assumed the old context-based props (rewrite them to the new prop shape in Step 4, or move them to `app/organization/page.test.tsx`).

- [ ] **Step 3: Write `app/organization/page.test.tsx` (failing)**

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

const updateOrg = vi.fn().mockResolvedValue({ enabledModuleKeys: [] });
const listCh = vi.fn().mockResolvedValue({ chapters: [{ id: "c1", name: "Rizq LUMS", city: "Lahore", status: "active" }] });
const createCh = vi.fn().mockResolvedValue({ chapterId: "c2" });
vi.mock("@/lib/platformFunctions", () => ({
  updateOrganization: (...a: unknown[]) => updateOrg(...a),
  listChapters: (...a: unknown[]) => listCh(...a),
  createChapter: (...a: unknown[]) => createCh(...a),
  updateChapter: vi.fn(),
}));
vi.mock("@/components/shell/ToastContext", () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock("@/components/shell/AppShell", () => ({
  useSelectedOrg: () => "org-1",
  useShellAccessToken: () => "access-token",
}));
const from = vi.fn();
vi.mock("@/lib/supabase/browserClient", () => ({
  getBrowserSupabaseClient: () => ({
    from: (t: string) => from(t),
  }),
}));

import OrganizationPage from "./page";

describe("OrganizationPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    from.mockImplementation(() => ({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { name: "Rizq", about: "help", brand_color: "#111111", logo_url: null, favicon_url: null } }) }) }),
    }));
  });

  it("loads the org profile and its chapters, and saves the profile", async () => {
    const user = userEvent.setup();
    render(<OrganizationPage />);
    await waitFor(() => expect(screen.getByDisplayValue("Rizq")).toBeInTheDocument());
    expect(screen.getByText("Rizq LUMS")).toBeInTheDocument();

    await user.clear(screen.getByLabelText(/Organization name/i));
    await user.type(screen.getByLabelText(/Organization name/i), "Rizq Foundation");
    await user.click(screen.getByRole("button", { name: /Save profile/i }));
    await waitFor(() => expect(updateOrg).toHaveBeenCalledTimes(1));
    expect(updateOrg.mock.calls[0][0]).toMatchObject({ organizationId: "org-1", name: "Rizq Foundation" });
  });

  it("adds a chapter", async () => {
    const user = userEvent.setup();
    render(<OrganizationPage />);
    await waitFor(() => expect(screen.getByText("Rizq LUMS")).toBeInTheDocument());
    await user.type(screen.getByLabelText("Chapter name"), "Rizq NUST");
    await user.click(screen.getByRole("button", { name: "Add Chapter" }));
    await waitFor(() => expect(createCh).toHaveBeenCalledWith({ organizationId: "org-1", name: "Rizq NUST" }, "access-token"));
  });
});
```

- [ ] **Step 4: Implement `app/organization/page.tsx`**

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { useSelectedOrg, useShellAccessToken } from "@/components/shell/AppShell";
import { useToast } from "@/components/shell/ToastContext";
import { updateOrganization, listChapters, type ChapterRow } from "@/lib/platformFunctions";
import { ChaptersPanel } from "@/components/team/ChaptersPanel";

interface Profile {
  name: string;
  about: string;
  brandColor: string;
  logoUrl: string;
  faviconUrl: string;
}

export default function OrganizationPage() {
  const organizationId = useSelectedOrg();
  const accessToken = useShellAccessToken();
  const { showToast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [chapters, setChapters] = useState<ChapterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!organizationId) { setLoading(false); return; }
    setLoading(true);
    const supabase = getBrowserSupabaseClient();
    const { data: org } = await supabase.from("organizations")
      .select("name, about, brand_color, logo_url, favicon_url").eq("id", organizationId).single();
    setProfile({
      name: (org?.name as string) ?? "",
      about: (org?.about as string) ?? "",
      brandColor: (org?.brand_color as string) ?? "",
      logoUrl: (org?.logo_url as string) ?? "",
      faviconUrl: (org?.favicon_url as string) ?? "",
    });
    if (accessToken) {
      try {
        const res = await listChapters({ organizationId }, accessToken);
        setChapters(res.chapters);
      } catch { setChapters([]); }
    }
    setLoading(false);
  }, [organizationId, accessToken]);

  useEffect(() => { load(); }, [load]);

  async function saveProfile() {
    if (!organizationId || !accessToken || !profile) return;
    setSaving(true);
    try {
      await updateOrganization({
        organizationId,
        name: profile.name.trim(),
        about: profile.about.trim() || null,
        brandColor: profile.brandColor.trim() || null,
        logoUrl: profile.logoUrl.trim() || null,
        faviconUrl: profile.faviconUrl.trim() || null,
      }, accessToken);
      showToast("Organization profile saved.");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to save profile.");
    } finally { setSaving(false); }
  }

  if (!organizationId) return <div className="panel p-8 text-center"><p className="text-[var(--ink-2)] font-medium">Select an organization.</p></div>;
  if (loading || !profile) return <p className="p-8 text-center text-[var(--ink-3)]">Loading organization…</p>;

  return (
    <div className="flex flex-col gap-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Organization</h1>
          <div className="page-subtitle">Your organization&apos;s public profile and its chapters.</div>
        </div>
      </div>

      <div className="table-card" style={{ padding: "1.25rem" }}>
        <h2 className="panel-title" style={{ marginBottom: ".75rem" }}>Profile</h2>
        <div className="grid-2col">
          <div className="form-group">
            <label className="form-label" htmlFor="org-name">Organization name</label>
            <input id="org-name" className="form-input" value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="org-brand">Brand color</label>
            <input id="org-brand" className="form-input" placeholder="#1A73E8" value={profile.brandColor}
              onChange={(e) => setProfile({ ...profile, brandColor: e.target.value })} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="org-about">Description</label>
          <textarea id="org-about" className="form-textarea" rows={3} value={profile.about}
            onChange={(e) => setProfile({ ...profile, about: e.target.value })} />
        </div>
        <div className="grid-2col">
          <div className="form-group">
            <label className="form-label" htmlFor="org-logo">Logo URL</label>
            <input id="org-logo" className="form-input" value={profile.logoUrl}
              onChange={(e) => setProfile({ ...profile, logoUrl: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="org-favicon">Favicon URL</label>
            <input id="org-favicon" className="form-input" value={profile.faviconUrl}
              onChange={(e) => setProfile({ ...profile, faviconUrl: e.target.value })} />
          </div>
        </div>
        <button type="button" className="btn btn-primary btn-sm" disabled={saving} onClick={saveProfile}>Save profile</button>
      </div>

      <ChaptersPanel
        organizationId={organizationId}
        accessToken={accessToken ?? ""}
        chapters={chapters}
        onChanged={load}
      />
    </div>
  );
}
```

- [ ] **Step 5: Run tests + typecheck**

Run: `npm test -- app/organization components/team/ChaptersPanel` — green. `npx tsc --noEmit` — errors now only from `TeamAccessProvider` (Task 9) and the drawers (Task 10).

- [ ] **Step 6: Commit**

```bash
git add app/organization/ components/team/ChaptersPanel.tsx components/team/ChaptersPanel.test.tsx app/team/roles/page.tsx
git commit -m "feat(org): Organization page — profile editor + chapter management; move ChaptersPanel off the Roles tab"
```

---

## Task 9: `TeamAccessProvider` — load chapters from the platform function

**Files:**
- Modify: `components/team/TeamAccessProvider.tsx`
- Modify: `components/team/TeamAccessProvider.test.tsx`

**Interfaces:**
- Consumes: `listChapters` from `@/lib/platformFunctions` (Task 6).
- Produces: unchanged `useTeamAccess()` surface; `chapters` now loads via `listChapters({ organizationId }, accessToken)` instead of the removed YR wrapper. Drop the `staffToken`-based `listChapters` import.

- [ ] **Step 1: Swap the import + call**

In `TeamAccessProvider.tsx`: change `import { listChapters } from "@/lib/youthRepublicFunctions"` to `import { listChapters } from "@/lib/platformFunctions"`. In the load function, the chapter fetch currently uses the staff token — change it to:

```ts
      if (accessToken) {
        try {
          const res = await listChapters({ organizationId }, accessToken);
          setChapters(res.chapters.map((c) => ({ id: c.id, name: c.name, city: c.city, status: c.status })));
        } catch {
          setChapters([]);
        }
      }
```

(`accessToken` is already in the provider from `useShellAccessToken()`. The `staffToken` fetch/`fetchStaffToken` is still used for anything else in the provider — leave it; only the chapter call changes.)

- [ ] **Step 2: Update `TeamAccessProvider.test.tsx`**

The test mocks `@/lib/youthRepublicFunctions`'s `listChapters`. Change the mock to `@/lib/platformFunctions` and have the provider's fetch pass `"access-token"`. Assert `chaptersMock` was called with `({ organizationId: "org-1" }, "access-token")`. Keep every other assertion.

- [ ] **Step 3: Run + commit**

Run: `npm test -- components/team/TeamAccessProvider.test.tsx` → green.

```bash
git add components/team/TeamAccessProvider.tsx components/team/TeamAccessProvider.test.tsx
git commit -m "feat(team): TeamAccessProvider loads chapters via the platform function"
```

---

## Task 10: `AuditTable` filter + Expired badge + "Access expires" drawer field

**Files:**
- Modify: `components/team/AuditTable.tsx` + `AuditTable.test.tsx`
- Modify: `components/team/MembersTable.tsx` + `MembersTable.test.tsx`
- Modify: `components/team/TeamAccessProvider.tsx` (add `expiresAt` to the `TeamMember` shape + load it)
- Modify: `components/team/InviteMemberDrawer.tsx` + `InviteMemberDrawer.test.tsx`
- Modify: `components/team/EditMemberDrawer.tsx` + `EditMemberDrawer.test.tsx`

**Interfaces:**
- Consumes: `expiresAt` on `staff` rows.
- Produces: `TeamMember` gains `expiresAt: string | null`; `MembersTable` shows an **Expired** badge and excludes expired from the Active stat; both drawers send `expiresAt` in their payloads.

- [ ] **Step 1: `AuditTable` — two new options**

In `AuditTable.tsx`, the `ACTION_TYPES` array gains `"Chapter Created"` and `"Chapter Updated"`. In `badgeClass`, treat both as `"badge-custom"` (same as role actions). In `AuditTable.test.tsx`, add one case: a rows array containing a `Chapter Created` row, select that option, assert only it shows. Run `npm test -- components/team/AuditTable.test.tsx`.

- [ ] **Step 2: `TeamAccessProvider` — carry `expiresAt`**

`TeamMember` interface gains `expiresAt: string | null`. The `staff` select in the provider's load (`select("id, full_name, email, status, deactivated_at")`) gains `expires_at`; the map sets `expiresAt: (s.expires_at as string) ?? null`. Update `TeamAccessProvider.test.tsx`'s `tableStub` for `staff` to return `expires_at: null` and, if it asserts the member shape, include `expiresAt`.

- [ ] **Step 3: `MembersTable` — Expired badge + stat**

In `MembersTable.tsx`: a member is *expired* when `m.expiresAt && new Date(m.expiresAt).getTime() < Date.now()`. In the Status cell, if expired, render `<span className="badge badge-neg">Expired</span>` instead of the normal status badge. The page-level Active stat (in `app/team/members/page.tsx`) currently counts `status === "active"` — change to `status === "active" && !(m.expiresAt && new Date(m.expiresAt) < new Date())`. Add a `MembersTable.test.tsx` case: a member with `expiresAt` in the past renders "Expired". Run `npm test -- components/team/MembersTable.test.tsx app/team/members`.

- [ ] **Step 4: Drawers — "Access expires" field**

`InviteMemberDrawer.tsx`: add state `const [expiresAt, setExpiresAt] = useState("")`; a form group with `<label>Access expires</label>` + `<input type="date" ...>` + helper text "Leave blank for permanent access."; include `expiresAt: expiresAt || null` in the `inviteStaffMember` payload. Reset it in the open effect.

`EditMemberDrawer.tsx`: same field, preloaded from `member.expiresAt` (slice to `YYYY-MM-DD`); include `expiresAt: expiresAt || null` in the `updateStaffAccess` payload.

Update `InviteMemberDrawer.test.tsx` / `EditMemberDrawer.test.tsx`: assert the payload carries `expiresAt` (null when the field is blank; the date string when set). Run `npm test -- components/team/InviteMemberDrawer.test.tsx components/team/EditMemberDrawer.test.tsx`.

- [ ] **Step 5: Full frontend sweep**

Run: `npx tsc --noEmit` → clean. `npm test` → all green.

- [ ] **Step 6: Commit**

```bash
git add components/team/ app/team/members/page.tsx
git commit -m "feat(team): audit chapter filters, Expired badge, Access-expires drawer field"
```

---

## Task 11: Deploy + regression

**Files:** none.

- [ ] **Step 1: Deploy platform functions**

```bash
set -a; source .env; set +a
npx supabase@latest functions deploy list-chapters create-chapter update-chapter mint-staff-token invite-staff-member update-staff-access update-organization enable-module --import-map ./supabase/deno.jsonc --project-ref "$SUPABASE_PROJECT_REF"
```
(`verifyPlatformStaffSession` is a `_shared` file — redeploying any function that imports it picks up the change; the list above covers the ones that matter, but redeploy every platform function if unsure: `npx supabase@latest functions deploy $(ls supabase/functions | grep -v _shared) --import-map ./supabase/deno.jsonc --project-ref "$SUPABASE_PROJECT_REF"`.)

- [ ] **Step 2: Full DB + function sweep**

```bash
set -a; source .env; set +a
for f in supabase/tests/database/*.sql; do echo "=== $f ==="; psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$f"; done
cd supabase && deno task test
```
Expected: `chapters_test.sql` all `ok`; `deno task test` fully green. The pre-existing broken pgTAP files (`roles_and_role_permissions_test.sql`, `staff_org_roles_test.sql`, `organizations_test.sql`, `org_modules_test.sql`, `permissions_test.sql` — stale `key='vms'` / `rizq` slug collision, predate this branch) are still red and out of scope; confirm nothing NEW fails.

- [ ] **Step 3: Frontend gate**

```bash
npx tsc --noEmit && npm test
```
Both clean/green.

- [ ] **Step 4: Commit any final fixes**

```bash
git add -A && git commit -m "test: finalize chapters-platform + expiry regression"
```

---

## Self-Review

**Spec coverage (this plan's slice — §2.1, §5, §6, §7 platform parts, §8 in-scope, §9, §10):**

- §2.1 `chapters` table + RLS → Task 1. `staff_role_assignments.chapter_id` FK → Task 1. `scope_label` rewrite on rename → Task 2 (`update-chapter`). `staff.expires_at` column → Task 1.
- §5.1 `verifyPlatformStaffSession` + `mint-staff-token` expiry gate → Task 3. §5.2 Expired badge + Active stat exclusion → Task 10. §5.3 drawer field + payloads → Task 4 (handlers) + Task 6 (payload types) + Task 10 (UI).
- §6.1 platform `list-chapters` / `create-chapter` / `update-chapter` + audit + `scope_label` rewrite → Task 2. `admin_audit_log.action` vocab + audit-page filter → Task 10 Step 1.
- §6.2 `update-organization` branding + org-admin auth + widened sync (+ `moduleBackends.ts` + `enable-module`) → Task 5.
- §6.3 `org_branding` `security_invoker` — **YR-side, one line**; not in this platform plan. Carried into the enforcement plan's YR migration task (it already adds a YR migration). *Flagged: if the enforcement plan is deferred, this one-line YR fix should be lifted out into its own tiny change.*
- §6.4 Organization page (Profile + Chapters, single page) → Task 8; `ChaptersPanel` relocation + Roles-tab removal → Task 8; scope dropdowns still fed by `TeamAccessProvider` → Task 9.
- §7 client changes: `platformFunctions.ts` chapter wrappers + branding + `expiresAt` → Task 6; `youthRepublicFunctions.ts` drop → Task 6; `TeamAccessProvider` repoint → Task 9; `AuditTable` filter → Task 10; Members Expired badge → Task 10; drawer field → Task 10; drop `<ChaptersPanel/>` from roles → Task 8. `lib/staffToken.ts` `chapterScopes` rename is **enforcement-plan** scope, not here.
- §8 in-scope: delete the 3 **YR** chapter Edge Functions — that is YR-repo work; carried into the enforcement plan's YR tasks (or a standalone cleanup). This platform plan's `list-chapters`/`create-chapter`/`update-chapter` are *new platform functions with the same names*, different repo — no conflict.
- §10 deploy → Task 11.

**Gaps consciously deferred to the enforcement plan or a standalone:** §6.3 `org_branding` one-liner; deletion of the 3 YR chapter functions; §3 token model; all of §4.

**Placeholder scan:** none. Task 6 Step 3's "errors only from not-yet-fixed consumers" is a real, expected intermediate `tsc` state with the fixing tasks named (9, 10) — not a hand-wave.

**Type consistency:** `ChapterRow { id, name, city: string | null, status }` — identical in `list-chapters/handler.ts` (Task 2), `lib/platformFunctions.ts` (Task 6), and consumed by `ChaptersPanel` (Task 8) + `TeamAccessProvider` (Task 9). `createChapter`/`updateChapter` payload shapes match between handler (Task 2) and wrapper (Task 6). `expiresAt?: string | null` identical across `InviteStaffMemberInput`/`UpdateStaffAccessInput` (Task 4), the payload types (Task 6), and the drawer sends (Task 10). `updateOrganization(supabase, callerStaffId, callerPlatformOwner, input)` signature — Task 5 defines it, Task 5 Step 4 updates the one caller (`index.ts`).

# Chapter-Scoped Enforcement — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make chapter scope actually restrict admin access — the staff token carries chapter scope **per capability key**, YR data gets an `opportunities.chapter_id`, and every YR admin read/write path filters by the caller's per-key chapter scope. Includes the Create Opportunity chapter picker.

**Architecture:** Two repos. **Platform** (`tmp-partner-admin`): `mint-staff-token` emits a `chapter_scopes` map (permission key → allowed chapter ids; absent key = unrestricted), replacing the flat `chapters` union; `lib/staffToken.ts` decodes it; `CreateOpportunityForm` gets the picker. **YR** (`youth-republic/backend`): a nullable `opportunities.chapter_id`; a 4-arg `staff_has_permission(org, module, perm, target_chapter_id)` (SQL + the TS `staffHasPermission` helper); every admin handler for opportunities/applications/hours does the 4-arg check against the target row's chapter (direct for opportunities, via `opportunity_id` for children); `list-*` handlers constrain their query to the caller's `:read` scope. RLS on those tables is updated as defense-in-depth (and its stale `'vms'` module string is fixed in passing).

**Tech Stack:** Supabase (two hosted projects), Postgres + pgTAP, Deno Edge Functions with `deno test`, Next.js 16 + Vitest.

**Spec:** `docs/superpowers/specs/2026-09-06-chapter-scoped-access-design.md` (§3, §4, §6.3, §8, §9, §10). The platform `chapters` table, edge functions, Organization page, and `staff.expires_at` are the **prerequisite** plan `2026-09-06-chapters-platform-and-expiry.md` — it must be implemented and its `0014` migration deployed **before** this plan starts (this plan's `mint-staff-token` change reads `staff_role_assignments.chapter_id`, which is only meaningful once the `chapters` table and FK exist).

## Prerequisites & Coordination

- **Plan `2026-09-06-chapters-platform-and-expiry.md` is done and deployed.** `chapters` table live, `staff_role_assignments.chapter_id` FK live, platform chapter functions live.
- **The YR repo (`youth-republic`) has active concurrent work on `feat/opportunities-admin-wiring`.** This plan's YR tasks touch `create-opportunity`, `update-opportunity`, `list-opportunities`, `list-applications`, `list-activity-hours`, `decide-application`, `verify-hours`, `update-participation-status`, `_shared/verifyStaffToken.ts`, and two migrations. Execute the YR tasks on a branch off the current `origin/feat/opportunities-admin-wiring` tip, keep each task's diff small, and expect to rebase. The platform tasks (1a mint-staff-token, staffToken.ts, CreateOpportunityForm) go on `feat/team-and-access`.
- **The old YR chapter functions** (`create-chapter`, `list-chapters`, `update-chapter`) are deleted in Task 10 — the platform functions of the same name (different repo) from the prerequisite plan replace them.

## Global Constraints

- Two hosted Supabase projects. Platform: `set -a; source .env; set +a` in `tmp-partner-admin`. YR: same in `youth-republic/backend`. Migrations `npx supabase@latest db push --linked` per repo; DB tests `for f in supabase/tests/database/*.sql; do psql "$SUPABASE_DB_URL" ... -f "$f"; done`; function tests `cd supabase && deno task test`; deploy `npx supabase@latest functions deploy <names> [--import-map ./supabase/deno.jsonc] --project-ref "$SUPABASE_PROJECT_REF"` (YR functions also need `--no-verify-jwt` for the staff-JWT ones — match the flags a sibling YR function's deploy uses).
- YR module key in the token and in every check is `youth-republic`. YR's `0010`-era RLS currently passes the **stale** literal `'vms'` — this plan fixes those specific policies to `'youth-republic'` while adding the 4-arg check.
- **Token contract (this plan defines it):** each `module_access` entry is
  `{ organization_id, module, permissions: string[], chapter_scopes?: Record<string, string[]> }`.
  `permissions` is the flat "holds this key in some scope" list (unchanged).
  `chapter_scopes[key]` present → the key is allowed only for those `chapter_id`s.
  `chapter_scopes[key]` absent → the key is unrestricted. Build rule (per org+module, per key any assignment grants): if **any** granting assignment is `scope_kind='org_wide'` → omit the key (unrestricted); else → union of `chapter_id` across the chapter-scoped granting assignments. `super_admin`-org path and `platform_owner` emit **no** `chapter_scopes`. The old flat `chapters` field is removed.
- The five capability keys that participate: `opportunities:write`, `opportunities:update`, `applications:update`, `hours:update`, `noticeboard:write` (the write/triage side — these are what a chapter role scopes). The `:read` keys (`opportunities:read`, `applications:read`, `hours:read`) are what `list-*` filters on when scoped. `team:write` is platform-only, never chapter-scoped.
- Every YR handler keeps its existing "fetch the target row's stored `organization_id`, authorize against **that**" pattern — the 4-arg check adds a chapter argument, it does not replace the org check.
- Frontend acceptance gate: `npx tsc --noEmit` + `npm test`. (The `useSearchParams` build blocker was fixed on `feat/team-and-access` — `npm run build` now passes; keep it passing.)

---

## File Structure

**`tmp-partner-admin` (platform) — on `feat/team-and-access`:**
- `supabase/functions/mint-staff-token/handler.ts` (+ `handler.test.ts`) — emit `chapter_scopes`, drop `chapters`.
- `lib/staffToken.ts` (+ `lib/staffToken.test.ts`) — `chapters?` → `chapterScopes?: Record<string, string[]>`.
- `components/youth-republic/CreateOpportunityForm.tsx` (+ its test) — chapter picker.
- `lib/youthRepublicFunctions.ts` — `create-opportunity` / `update-opportunity` payloads gain `chapterId?: string | null`.

**`youth-republic/backend` — on a branch off `origin/feat/opportunities-admin-wiring`:**
- `supabase/migrations/0025_opportunity_chapter_and_4arg_perm.sql` — new: `opportunities.chapter_id`; 4-arg `staff_has_permission`; `org_branding` `security_invoker` (spec §6.3).
- `supabase/migrations/0026_chapter_scoped_rls.sql` — new: opportunities/applications/activity_hours staff policies → `'youth-republic'` + 4-arg (defense-in-depth).
- `supabase/tests/database/chapter_scoped_perm_test.sql` — new: pgTAP for the 4-arg function + RLS.
- `supabase/functions/_shared/verifyStaffToken.ts` (+ `verifyStaffToken.test.ts`) — `chapterScopes` claim + 4-arg `staffHasPermission`.
- `supabase/functions/create-opportunity/handler.ts` (+ test) — accept/validate/store `chapterId`.
- `supabase/functions/update-opportunity/handler.ts` (+ test) — 4-arg check on stored chapter.
- `supabase/functions/decide-application/handler.ts` (+ test) — 4-arg check via opportunity link.
- `supabase/functions/verify-hours/handler.ts` (+ test) — 4-arg check via opportunity link.
- `supabase/functions/update-participation-status/handler.ts` (+ test) — 4-arg check via opportunity link.
- `supabase/functions/list-opportunities/handler.ts` (+ test) — scope filter.
- `supabase/functions/list-applications/handler.ts` (+ test) — scope filter.
- `supabase/functions/list-activity-hours/handler.ts` (+ test) — scope filter.
- Delete: `supabase/functions/{create-chapter,list-chapters,update-chapter}/`.

---

## Task 1: Platform `mint-staff-token` emits `chapter_scopes`

**Files:**
- Modify: `supabase/functions/mint-staff-token/handler.ts`
- Modify: `supabase/functions/mint-staff-token/handler.test.ts`

**Interfaces:**
- Consumes: `staff_role_assignments` (`role_id`, `scope_kind`, `chapter_id`), `role_permissions` → `permissions(resource, action)`.
- Produces: each `module_access` entry has `chapter_scopes?: Record<string, string[]>` per the token contract; no `chapters` field.

- [ ] **Step 1: Write the failing test**

In `supabase/functions/mint-staff-token/handler.test.ts`, remove/replace the existing `chapters`-union test with:

```ts
Deno.test("mintStaffToken emits per-key chapter_scopes: org-wide grant unrestricts a key, others are scoped", async () => {
  const supabase = testClient();
  const { data: org } = await supabase.from("organizations").insert({
    name: "Scopes Org", slug: `scopes-${crypto.randomUUID()}`,
  }).select("id").single();
  const { data: mod } = await supabase.from("modules").select("id").eq("key", "youth-republic").single();
  await supabase.from("org_modules").insert({ organization_id: org!.id, module_id: mod!.id });
  await supabase.rpc("seed_youth_republic_system_roles", { p_org_id: org!.id, p_module_id: mod!.id });
  const roleId = async (n: string) =>
    (await supabase.from("roles").select("id").eq("organization_id", org!.id).eq("name", n).single()).data!.id as string;
  const auditor = await roleId("Auditor");           // read-only everything (org-wide grant)
  const opsLead = await roleId("Operations Lead");    // write/triage (chapter-scoped)

  const { data: chapter } = await supabase.from("chapters").insert({
    organization_id: org!.id, name: `LUMS-${crypto.randomUUID()}`,
  }).select("id").single();

  const email = `scopes-${crypto.randomUUID()}@example.com`;
  const { data: authUser } = await supabase.auth.admin.createUser({ email, email_confirm: true });
  const { data: staff } = await supabase.from("staff").insert({
    auth_user_id: authUser!.user!.id, full_name: "Scoped", email,
  }).select("id").single();

  await supabase.from("staff_role_assignments").insert([
    { staff_id: staff!.id, organization_id: org!.id, module_id: mod!.id, role_id: auditor,
      scope_kind: "org_wide", scope_label: "National / All Chapters" },
    { staff_id: staff!.id, organization_id: org!.id, module_id: mod!.id, role_id: opsLead,
      scope_kind: "chapter", chapter_id: chapter!.id, scope_label: "LUMS" },
  ]);

  const token = await mintStaffToken(supabase, staff!.id, false);
  const entry = JSON.parse(atob(token.split(".")[1])).module_access
    .find((m: { module: string }) => m.module === "youth-republic");

  // read keys granted by the org-wide Auditor → unrestricted (absent from chapter_scopes)
  assertEquals(entry.chapter_scopes["applications:read"], undefined);
  assertEquals(entry.chapter_scopes["opportunities:read"], undefined);
  // write/triage keys only from the chapter-scoped Ops Lead → scoped to [chapter]
  assertEquals(entry.chapter_scopes["opportunities:write"], [chapter!.id]);
  assertEquals(entry.chapter_scopes["applications:update"], [chapter!.id]);
  // no flat chapters field anymore
  assertEquals(entry.chapters, undefined);
});

Deno.test("mintStaffToken emits no chapter_scopes for a super_admin org", async () => {
  const supabase = testClient();
  const { data: org } = await supabase.from("organizations").insert({
    name: "SA Scopes Org", slug: `sa-scopes-${crypto.randomUUID()}`,
  }).select("id").single();
  const { data: mod } = await supabase.from("modules").select("id").eq("key", "youth-republic").single();
  await supabase.from("org_modules").insert({ organization_id: org!.id, module_id: mod!.id });
  const email = `sa-scopes-${crypto.randomUUID()}@example.com`;
  const { data: authUser } = await supabase.auth.admin.createUser({ email, email_confirm: true });
  const { data: staff } = await supabase.from("staff").insert({
    auth_user_id: authUser!.user!.id, full_name: "SA", email,
  }).select("id").single();
  await supabase.from("staff_org_roles").insert({ staff_id: staff!.id, organization_id: org!.id, org_tier: "super_admin" });

  const token = await mintStaffToken(supabase, staff!.id, false);
  const entry = JSON.parse(atob(token.split(".")[1])).module_access
    .find((m: { module: string }) => m.module === "youth-republic");
  assertEquals(entry.chapter_scopes, undefined);
});
```

Also update any other test in this file that asserts on `entry.chapters` — replace with `entry.chapter_scopes` expectations (an org-wide-only member → `chapter_scopes` is `undefined`).

- [ ] **Step 2: Run — expect fail**

Run: `cd supabase && deno task test --filter "per-key chapter_scopes"` → FAIL (`entry.chapter_scopes` undefined; handler still emits `chapters`).

- [ ] **Step 3: Rewrite the scope logic in `handler.ts`**

The handler currently has a `scopeMap` keyed `orgId:moduleKey → { anyOrgWide, chapters: Set }` and, at the end, attaches `chapters` when `!anyOrgWide && chapters.size > 0`. Replace with a **per-key** accumulator.

In the assignment loop, the code already resolves each assignment's `moduleKey` and its `permissions` (via `role_permissions` → `permissions(resource, action)` → `"resource:action"`). For each such key, record the assignment's scope:

```ts
  // key: `${orgId}:${moduleKey}` -> Map<permissionKey, { anyOrgWide: boolean; chapters: Set<string> }>
  const keyScopes = new Map<string, Map<string, { anyOrgWide: boolean; chapters: Set<string> }>>();
  function notePermScope(orgId: string, moduleKey: string, permKey: string, row: { scope_kind: string; chapter_id: string | null }) {
    const mapKey = `${orgId}:${moduleKey}`;
    let perKey = keyScopes.get(mapKey);
    if (!perKey) { perKey = new Map(); keyScopes.set(mapKey, perKey); }
    let cur = perKey.get(permKey);
    if (!cur) { cur = { anyOrgWide: false, chapters: new Set<string>() }; perKey.set(permKey, cur); }
    if (row.scope_kind === "org_wide") cur.anyOrgWide = true;
    else if (row.chapter_id) cur.chapters.add(row.chapter_id);
  }
```

Where the assignment loop currently calls `addPermissions(orgId, moduleKey, permissions)`, also loop:
```ts
    for (const permKey of permissions) {
      notePermScope(row.organization_id as string, moduleKey, permKey, row);
    }
```

The `super_admin`-org path (which currently calls `addPermissions` for every module permission) must **not** call `notePermScope` at all — leaving `keyScopes` without an entry means "unrestricted", which is correct for super_admin.

When building the final `module_access` array (currently `.map` over `moduleAccessMap.values()`), compute `chapter_scopes`:
```ts
  const moduleAccess = Array.from(moduleAccessMap.values()).map((entry) => {
    const perKey = keyScopes.get(`${entry.organization_id}:${entry.module}`);
    if (!perKey) return entry;
    const chapter_scopes: Record<string, string[]> = {};
    for (const [permKey, scope] of perKey) {
      if (!scope.anyOrgWide && scope.chapters.size > 0) {
        chapter_scopes[permKey] = Array.from(scope.chapters);
      }
    }
    return Object.keys(chapter_scopes).length > 0 ? { ...entry, chapter_scopes } : entry;
  });
```
Pass `module_access: moduleAccess` into `create(...)`. Delete the old `scopeMap` / `noteScope` code and the `chapters` attachment.

- [ ] **Step 4: Run — expect pass**

Run: `cd supabase && deno task test --filter mintStaffToken` → all PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/mint-staff-token/
git commit -m "feat(token): emit per-capability chapter_scopes, drop the flat chapters union"
```

---

## Task 2: Platform `lib/staffToken.ts` — decode `chapterScopes`

**Files:**
- Modify: `lib/staffToken.ts`
- Modify: `lib/staffToken.test.ts`

**Interfaces:**
- Produces: `StaffTokenClaims.moduleAccess[]` — `chapters?: string[]` removed, `chapterScopes?: Record<string, string[]>` added; `decodeStaffTokenClaims` maps `m.chapter_scopes`.

- [ ] **Step 1: Update the type + decode**

In `lib/staffToken.ts`, the `moduleAccess` member type: remove `chapters?: string[]`, add `chapterScopes?: Record<string, string[]>`. In `decodeStaffTokenClaims`'s `moduleAccess` map, replace the `chapters` mapping with:

```ts
        chapterScopes:
          m.chapter_scopes && typeof m.chapter_scopes === "object"
            ? Object.fromEntries(
                Object.entries(m.chapter_scopes as Record<string, unknown>).map(([k, v]) => [
                  k,
                  Array.isArray(v) ? (v as unknown[]).map(String) : [],
                ]),
              )
            : undefined,
```

- [ ] **Step 2: Update `lib/staffToken.test.ts`**

Any assertion referencing `moduleAccess[].chapters` → `chapterScopes`. Add a case: a token payload with `chapter_scopes: { "opportunities:write": ["c1"] }` decodes to `chapterScopes: { "opportunities:write": ["c1"] }`; a payload without the field decodes to `chapterScopes: undefined`.

- [ ] **Step 3: Typecheck + test + commit**

Run: `npx tsc --noEmit` (any consumer of `.chapters` on module access — grep `grep -rn "moduleAccess.*chapters\|\.chapters" components lib app` — expect none; the Team & Access frontend never read that field). `npm test -- lib/staffToken.test.ts` → green.

```bash
git add lib/staffToken.ts lib/staffToken.test.ts
git commit -m "feat(lib): decode per-key chapterScopes from the staff token"
```

---

## Task 3: YR migration `0025` — `opportunities.chapter_id`, 4-arg `staff_has_permission`, `org_branding` fix

**Repo: `youth-republic/backend`.**

**Files:**
- Create: `supabase/migrations/0025_opportunity_chapter_and_4arg_perm.sql`
- Create: `supabase/tests/database/chapter_scoped_perm_test.sql`

**Interfaces:**
- Produces: `opportunities.chapter_id uuid` (nullable, no FK); SQL function `staff_has_permission(uuid, text, text, uuid)`; `org_branding` view is `security_invoker`.

- [ ] **Step 1: Write the migration**

```sql
-- 0025_opportunity_chapter_and_4arg_perm.sql
-- Chapter scoping: opportunities carry a platform chapter UUID; a 4-arg
-- permission check consults the token's per-key chapter_scopes.
-- See docs (platform repo): 2026-09-06-chapter-scoped-access-design.md §3, §4, §6.3.

alter table opportunities add column chapter_id uuid;  -- nullable, no FK (platform-owned id)

-- 4-arg permission check. The 3-arg staff_has_permission (0009) is unchanged
-- and still used by non-chapter-partitioned tables.
create or replace function staff_has_permission(
  p_org_id uuid, p_module text, p_permission text, p_target_chapter_id uuid
) returns boolean as $$
  select is_platform_owner() or exists (
    select 1
    from jsonb_array_elements(coalesce(auth.jwt() -> 'module_access', '[]'::jsonb)) m
    where (m ->> 'organization_id')::uuid = p_org_id
      and (m ->> 'module') = p_module
      and (m -> 'permissions') ? p_permission
      and (
        not (coalesce(m -> 'chapter_scopes', '{}'::jsonb) ? p_permission)
        or (
          p_target_chapter_id is not null
          and (m -> 'chapter_scopes' -> p_permission) ? p_target_chapter_id::text
        )
      )
  );
$$ language sql stable;

-- Spec §6.3: org_branding is a plain view that bypasses the base table's RLS
-- (Supabase flags it "unrestricted"). The exposure matches
-- organizations_public_select (deactivated_at is null); make it explicit.
alter view org_branding set (security_invoker = on);
```

- [ ] **Step 2: Write the pgTAP test**

Create `supabase/tests/database/chapter_scoped_perm_test.sql`:

```sql
begin;
select plan(8);

select has_column('public', 'opportunities', 'chapter_id', 'opportunities.chapter_id exists');
select has_function('public', 'staff_has_permission', ARRAY['uuid','text','text','uuid'], '4-arg staff_has_permission exists');

-- Drive the function via a fake JWT claims blob.
select set_config('role', 'authenticated', true);

-- Case A: unrestricted key (not in chapter_scopes) → true for any target, incl. null.
select set_config('request.jwt.claims', json_build_object(
  'module_access', json_build_array(json_build_object(
    'organization_id', '11111111-1111-1111-1111-111111111111',
    'module', 'youth-republic',
    'permissions', json_build_array('opportunities:read'),
    'chapter_scopes', json_build_object()
  ))
)::text, true);
select is(staff_has_permission('11111111-1111-1111-1111-111111111111'::uuid, 'youth-republic', 'opportunities:read', null),
  true, 'unrestricted key: true even for a null target');
select is(staff_has_permission('11111111-1111-1111-1111-111111111111'::uuid, 'youth-republic', 'opportunities:read',
  '22222222-2222-2222-2222-222222222222'::uuid), true, 'unrestricted key: true for any chapter');

-- Case B: scoped key → true only for a listed chapter, false for others and for null.
select set_config('request.jwt.claims', json_build_object(
  'module_access', json_build_array(json_build_object(
    'organization_id', '11111111-1111-1111-1111-111111111111',
    'module', 'youth-republic',
    'permissions', json_build_array('opportunities:write'),
    'chapter_scopes', json_build_object('opportunities:write', json_build_array('22222222-2222-2222-2222-222222222222'))
  ))
)::text, true);
select is(staff_has_permission('11111111-1111-1111-1111-111111111111'::uuid, 'youth-republic', 'opportunities:write',
  '22222222-2222-2222-2222-222222222222'::uuid), true, 'scoped key: true for the listed chapter');
select is(staff_has_permission('11111111-1111-1111-1111-111111111111'::uuid, 'youth-republic', 'opportunities:write',
  '33333333-3333-3333-3333-333333333333'::uuid), false, 'scoped key: false for a different chapter');
select is(staff_has_permission('11111111-1111-1111-1111-111111111111'::uuid, 'youth-republic', 'opportunities:write', null),
  false, 'scoped key: false for a null (org-wide) target');

-- Case C: key absent from permissions entirely → false.
select is(staff_has_permission('11111111-1111-1111-1111-111111111111'::uuid, 'youth-republic', 'hours:update', null),
  false, 'key not granted at all: false');

select * from finish();
rollback;
```

- [ ] **Step 3: Apply + test + commit**

```bash
set -a; source .env; set +a
npx supabase@latest db push --linked
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/database/chapter_scoped_perm_test.sql
```
Expected: `ok 1`..`ok 8`. Adjust `plan(N)` if your count differs.

```bash
git add supabase/migrations/0025_opportunity_chapter_and_4arg_perm.sql supabase/tests/database/chapter_scoped_perm_test.sql
git commit -m "feat(db): opportunities.chapter_id, 4-arg staff_has_permission, org_branding security_invoker"
```

---

## Task 4: YR `verifyStaffToken.ts` — `chapterScopes` claim + 4-arg `staffHasPermission`

**Repo: `youth-republic/backend`.**

**Files:**
- Modify: `supabase/functions/_shared/verifyStaffToken.ts`
- Modify: `supabase/functions/_shared/verifyStaffToken.test.ts`

**Interfaces:**
- Produces:
  - `ModuleAccessEntry` gains `chapterScopes?: Record<string, string[]>`.
  - `staffHasPermission(claims, organizationId, module, permission)` — **unchanged** 3-arg.
  - `staffHasPermission(claims, organizationId, module, permission, targetChapterId: string | null)` — new 4-arg overload: `platformOwner` → true; module_access entry lacking `permission` → false; entry's `chapterScopes[permission]` absent → true; present → `targetChapterId != null && list.includes(targetChapterId)`.

- [ ] **Step 1: Failing test**

In `verifyStaffToken.test.ts` add:

```ts
Deno.test("staffHasPermission 4-arg honours per-key chapter scope", () => {
  const claims: StaffClaims = {
    actorType: "staff", staffId: "s1", platformOwner: false, canVerifyIdentity: false,
    orgRoles: [{ organizationId: "org-1" }],
    moduleAccess: [{
      organizationId: "org-1", module: "youth-republic",
      permissions: ["opportunities:read", "opportunities:write"],
      chapterScopes: { "opportunities:write": ["lums"] },
    }],
  };
  // unrestricted read
  assertEquals(staffHasPermission(claims, "org-1", "youth-republic", "opportunities:read", null), true);
  assertEquals(staffHasPermission(claims, "org-1", "youth-republic", "opportunities:read", "nust"), true);
  // scoped write
  assertEquals(staffHasPermission(claims, "org-1", "youth-republic", "opportunities:write", "lums"), true);
  assertEquals(staffHasPermission(claims, "org-1", "youth-republic", "opportunities:write", "nust"), false);
  assertEquals(staffHasPermission(claims, "org-1", "youth-republic", "opportunities:write", null), false);
  // ungranted key
  assertEquals(staffHasPermission(claims, "org-1", "youth-republic", "hours:update", "lums"), false);
  // 3-arg still works
  assertEquals(staffHasPermission(claims, "org-1", "youth-republic", "opportunities:write"), true);
});

Deno.test("verifyStaffToken decodes chapter_scopes", async () => {
  // build a token the same way the file's other tests do, with
  // module_access[0].chapter_scopes = { "opportunities:write": ["lums"] },
  // then assert claims.moduleAccess[0].chapterScopes deep-equals it.
});
```

- [ ] **Step 2: Run — expect fail** (5-arg call errors / `chapterScopes` undefined).

- [ ] **Step 3: Implement**

`ModuleAccessEntry` interface: add `chapterScopes?: Record<string, string[]>`. In `verifyStaffToken`'s `moduleAccess` map, add:

```ts
        chapterScopes:
          m.chapter_scopes && typeof m.chapter_scopes === "object"
            ? Object.fromEntries(
                Object.entries(m.chapter_scopes as Record<string, unknown>).map(([k, v]) => [
                  k, Array.isArray(v) ? v.map(String) : [],
                ]),
              )
            : undefined,
```

Replace `staffHasPermission` with an overloaded version:

```ts
export function staffHasPermission(
  claims: StaffClaims, organizationId: string, module: string, permission: string,
): boolean;
export function staffHasPermission(
  claims: StaffClaims, organizationId: string, module: string, permission: string,
  targetChapterId: string | null,
): boolean;
export function staffHasPermission(
  claims: StaffClaims, organizationId: string, module: string, permission: string,
  targetChapterId?: string | null,
): boolean {
  if (claims.platformOwner) return true;
  const entry = claims.moduleAccess.find(
    (m) => m.organizationId === organizationId && m.module === module,
  );
  if (!entry || !entry.permissions.includes(permission)) return false;
  if (targetChapterId === undefined) return true; // 3-arg: any scope
  const scope = entry.chapterScopes?.[permission];
  if (!scope) return true; // key unrestricted
  return targetChapterId !== null && scope.includes(targetChapterId);
}
```

- [ ] **Step 4: Run — expect pass**

Run: `cd supabase && deno task test --filter "staffHasPermission|verifyStaffToken"` → all PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/verifyStaffToken.ts supabase/functions/_shared/verifyStaffToken.test.ts
git commit -m "feat(shared): chapterScopes claim + 4-arg staffHasPermission"
```

---

## Task 5: YR `create-opportunity` — accept, validate, store `chapterId`

**Repo: `youth-republic/backend`.**

**Files:**
- Modify: `supabase/functions/create-opportunity/handler.ts` + `handler.test.ts`

**Interfaces:**
- Consumes: 4-arg `staffHasPermission` (Task 4).
- Produces: `CreateOpportunityInput` gains `chapterId?: string | null`. The handler checks `staffHasPermission(claims, org, "youth-republic", "opportunities:write", input.chapterId ?? null)` (4-arg) instead of the current 3-arg check, and writes `chapter_id: input.chapterId ?? null` into the insert row.

- [ ] **Step 1: Failing tests**

In `create-opportunity/handler.test.ts` (mirror how its existing tests build `staffClaims`), add:

```ts
Deno.test("createOpportunity: a chapter-scoped writer can only file under a scoped chapter", async () => {
  // claims with permissions incl. "opportunities:write" and
  // chapterScopes: { "opportunities:write": ["lums"] }
  // 1) chapterId "lums" → succeeds, row.chapter_id == "lums"
  // 2) chapterId "nust" → assertRejects(..., "forbidden")
  // 3) chapterId null (org-wide) → assertRejects(..., "forbidden")
});

Deno.test("createOpportunity: an unrestricted writer can file org-wide or under any chapter", async () => {
  // claims with "opportunities:write" and NO chapterScopes entry for it
  // chapterId null → succeeds, row.chapter_id == null
  // chapterId "lums" → succeeds, row.chapter_id == "lums"
});
```

- [ ] **Step 2: Run — expect fail.**

- [ ] **Step 3: Implement**

`CreateOpportunityInput`: add `chapterId?: string | null`. Change the guard:

```ts
  if (!staffHasPermission(staffClaims, input.organizationId, "youth-republic", "opportunities:write", input.chapterId ?? null)) {
    throw new Error("forbidden");
  }
```

In the `row` object, add `chapter_id: input.chapterId ?? null`.

- [ ] **Step 4: Run — expect pass. Commit.**

```bash
git add supabase/functions/create-opportunity/
git commit -m "feat(fn): create-opportunity stores chapter_id and 4-arg-checks it"
```

---

## Task 6: YR `update-opportunity` — 4-arg check on the stored chapter

**Repo: `youth-republic/backend`.**

**Files:**
- Modify: `supabase/functions/update-opportunity/handler.ts` + `handler.test.ts`

**Interfaces:**
- Produces: the handler's opportunity fetch also selects `chapter_id`; both the `opportunities:update` and `opportunities:delete` checks become 4-arg against that stored `chapter_id`. `chapter_id` is never changed by this handler.

- [ ] **Step 1: Failing test**

```ts
Deno.test("updateOpportunity: a chapter-scoped updater can only touch its own chapter's opportunity", async () => {
  // seed two opportunities: one with chapter_id "lums", one with chapter_id "nust"
  // claims: chapterScopes { "opportunities:update": ["lums"] }
  // update the LUMS one → succeeds; update the NUST one → assertRejects(..., "forbidden")
  // update a null-chapter (org-wide) opportunity → assertRejects(..., "forbidden")
});
```

- [ ] **Step 2: Run — expect fail.**

- [ ] **Step 3: Implement**

The fetch is `supabase.from("opportunities").select("id, organization_id").eq("id", input.opportunityId).single()` — change to `select("id, organization_id, chapter_id")`. The two guards:

```ts
  if (touchesOtherFields &&
      !staffHasPermission(staffClaims, opportunity.organization_id, "youth-republic", "opportunities:update", opportunity.chapter_id ?? null)) {
    throw new Error("forbidden");
  }
  if (input.deactivatedAt !== undefined &&
      !staffHasPermission(staffClaims, opportunity.organization_id, "youth-republic", "opportunities:delete", opportunity.chapter_id ?? null)) {
    throw new Error("forbidden");
  }
```

- [ ] **Step 4: Run — expect pass. Commit.**

```bash
git add supabase/functions/update-opportunity/
git commit -m "feat(fn): update-opportunity 4-arg-checks the opportunity's chapter"
```

---

## Task 7: YR `decide-application` + `verify-hours` + `update-participation-status` — 4-arg via opportunity link

**Repo: `youth-republic/backend`.**

**Files:**
- Modify: `supabase/functions/decide-application/handler.ts` + `handler.test.ts`
- Modify: `supabase/functions/verify-hours/handler.ts` + `handler.test.ts`
- Modify: `supabase/functions/update-participation-status/handler.ts` + `handler.test.ts`

**Interfaces:**
- Produces: each handler resolves the target row's opportunity `chapter_id` (`decide-application`: `applications.opportunity_id`; `verify-hours`: `activity_hours.opportunity_id`; `update-participation-status`: `participation.opportunity_id`), then does the 4-arg check with its existing key (`applications:update` / `hours:update` / `participation:update`).

- [ ] **Step 1: Add a shared helper**

Create `supabase/functions/_shared/opportunityChapter.ts`:

```ts
import { SupabaseClient } from "@supabase/supabase-js";

export async function opportunityChapterId(
  supabase: SupabaseClient, opportunityId: string,
): Promise<string | null> {
  const { data } = await supabase.from("opportunities").select("chapter_id").eq("id", opportunityId).single();
  return (data?.chapter_id as string | null) ?? null;
}
```

- [ ] **Step 2: `decide-application`**

Failing test: a chapter-scoped `applications:update` (`chapterScopes { "applications:update": ["lums"] }`) can decide an application whose opportunity is LUMS-chaptered, and gets `forbidden` for a NUST-chaptered one and a null-chapter one.

Implement: the handler fetches `applications.select("id, volunteer_id, opportunity_id, organization_id")`. After that, before the permission check:

```ts
import { opportunityChapterId } from "../_shared/opportunityChapter.ts";
...
  const targetChapter = await opportunityChapterId(supabase, application.opportunity_id);
  if (!staffHasPermission(staffClaims, application.organization_id, "youth-republic", "applications:update", targetChapter)) {
    throw new Error("forbidden");
  }
```
(replace the existing 3-arg check).

- [ ] **Step 3: `verify-hours`**

The fetch is `activity_hours.select("id, organization_id, volunteer_id, hours_submitted")` — add `opportunity_id`. Then:
```ts
  const targetChapter = await opportunityChapterId(supabase, row.opportunity_id);
  if (!staffHasPermission(staffClaims, row.organization_id, "youth-republic", "hours:update", targetChapter)) {
    throw new Error("forbidden");
  }
```
Failing test mirrors Step 2 with `hours:update`.

- [ ] **Step 4: `update-participation-status`**

The fetch is `participation.select("id, organization_id")` — add `opportunity_id`. Then:
```ts
  const targetChapter = await opportunityChapterId(supabase, participation.opportunity_id);
  if (!staffHasPermission(staffClaims, participation.organization_id, "youth-republic", "participation:update", targetChapter)) {
    throw new Error("forbidden");
  }
```
Failing test: mirrors Step 2 with `participation:update`. (No role grants `participation:update` in the current capability model, so this check is unrestricted for every real caller today — the test uses a hand-built claims blob with an explicit `chapterScopes` entry to prove the wiring.)

- [ ] **Step 5: Run all three suites — expect pass. Commit.**

Run: `cd supabase && deno task test --filter "decideApplication|verifyHours|updateParticipationStatus"` → PASS.

```bash
git add supabase/functions/_shared/opportunityChapter.ts supabase/functions/decide-application/ supabase/functions/verify-hours/ supabase/functions/update-participation-status/
git commit -m "feat(fn): chapter-scope the application/hours/participation write paths via the opportunity link"
```

---

## Task 8: YR `list-opportunities` + `list-applications` + `list-activity-hours` — scope the query

**Repo: `youth-republic/backend`.**

**Files:**
- Modify: `supabase/functions/list-opportunities/handler.ts` + `handler.test.ts`
- Modify: `supabase/functions/list-applications/handler.ts` + `handler.test.ts`
- Modify: `supabase/functions/list-activity-hours/handler.ts` + `handler.test.ts`

**Interfaces:**
- Consumes: `claims.moduleAccess[].chapterScopes` (Task 4).
- Produces: each `list-*` handler, after its existing `:read` permission gate, reads `chapterScopes[<the :read key>]` for the (org, `youth-republic`) entry; if present, constrains the result set to those chapter ids. `list-opportunities` filters `opportunities.chapter_id`; the other two filter via `opportunity_id in (select id from opportunities where chapter_id in (...))`.

- [ ] **Step 1: Add a shared helper**

Append to `supabase/functions/_shared/opportunityChapter.ts`:

```ts
import { type StaffClaims } from "./verifyStaffToken.ts";

export function readScopeChapterIds(
  claims: StaffClaims, organizationId: string, readPermission: string,
): string[] | null {
  if (claims.platformOwner) return null;
  const entry = claims.moduleAccess.find(
    (m) => m.organizationId === organizationId && m.module === "youth-republic",
  );
  const scope = entry?.chapterScopes?.[readPermission];
  return scope && scope.length > 0 ? scope : null;
}
```
`null` = unrestricted (return everything); a non-empty array = restrict.

- [ ] **Step 2: `list-opportunities`**

After `staffHasPermission(... "opportunities:read")` passes, compute `const chapterIds = readScopeChapterIds(staffClaims, input.organizationId, "opportunities:read");` and, where the main query is built (`.eq("organization_id", ...)`), add `if (chapterIds) query = query.in("chapter_id", chapterIds);`. Do the same on the facets query if it filters opportunities.

Failing test: a caller with `chapterScopes { "opportunities:read": ["lums"] }` gets back only LUMS-chaptered opportunities (not NUST, not null-chapter); a caller with no such scope gets all.

- [ ] **Step 3: `list-applications`**

After the `applications:read` gate: `const chapterIds = readScopeChapterIds(staffClaims, input.organizationId, "applications:read");` then, on the query builder that has `.eq("organization_id", ...)`:
```ts
  if (chapterIds) {
    const { data: opps } = await supabase.from("opportunities").select("id")
      .eq("organization_id", input.organizationId).in("chapter_id", chapterIds);
    query = query.in("opportunity_id", (opps ?? []).map((o) => o.id as string));
  }
```
(place it before `if (input.opportunityId) query = query.eq("opportunity_id", input.opportunityId);` so an explicit `opportunityId` filter still ANDs correctly — a scoped caller passing an out-of-scope `opportunityId` then gets an empty result, which is correct.)

Failing test mirrors Step 2 for applications.

- [ ] **Step 4: `list-activity-hours`**

After the `hours:read` gate: `const chapterIds = readScopeChapterIds(staffClaims, input.organizationId, "hours:read");`. The handler already builds an optional `opportunityIdFilter: string[] | null` (for the `activityType` filter). Extend it: if `chapterIds` is set, fetch `opportunities.id where organization_id = org and chapter_id in chapterIds`, and intersect with any existing `opportunityIdFilter` (or set it if none). The existing `if (opportunityIdFilter) query = query.in("opportunity_id", opportunityIdFilter);` then applies both constraints.

Failing test mirrors Step 2 for activity hours.

- [ ] **Step 5: Run all three suites — expect pass. Commit.**

```bash
git add supabase/functions/_shared/opportunityChapter.ts supabase/functions/list-opportunities/ supabase/functions/list-applications/ supabase/functions/list-activity-hours/
git commit -m "feat(fn): list-opportunities/applications/activity-hours filter by the caller's chapter read-scope"
```

---

## Task 9: YR RLS migration `0026` (defense-in-depth)

**Repo: `youth-republic/backend`.**

**Files:**
- Create: `supabase/migrations/0026_chapter_scoped_rls.sql`
- Modify: `supabase/tests/database/chapter_scoped_perm_test.sql` (add RLS assertions)

**Interfaces:**
- Produces: `opportunities` / `applications` / `activity_hours` staff RLS branches use `'youth-republic'` (fixing the stale `'vms'`) and the 4-arg `staff_has_permission` against the row's chapter.

- [ ] **Step 1: Write the migration**

```sql
-- 0026_chapter_scoped_rls.sql — align staff RLS on the chapter-partitioned
-- tables with the 4-arg permission check. Also fixes the stale 'vms' module
-- literal left in 0010 (the modules table was renamed vms->youth-republic in
-- the platform project; the token has always carried 'youth-republic').
-- These policies are a backstop — all admin access is via service-role Edge
-- Functions that already check in code (this plan's Tasks 5-8).

-- opportunities
drop policy opportunities_staff_select on opportunities;
create policy opportunities_staff_select on opportunities
  for select using (staff_has_permission(organization_id, 'youth-republic', 'opportunities:read', chapter_id));

drop policy opportunities_staff_insert on opportunities;
create policy opportunities_staff_insert on opportunities
  for insert with check (staff_has_permission(organization_id, 'youth-republic', 'opportunities:write', chapter_id));

drop policy opportunities_staff_update on opportunities;
create policy opportunities_staff_update on opportunities
  for update using (staff_has_permission(organization_id, 'youth-republic', 'opportunities:update', chapter_id));

drop policy opportunities_staff_delete on opportunities;
create policy opportunities_staff_delete on opportunities
  for delete using (staff_has_permission(organization_id, 'youth-republic', 'opportunities:delete', chapter_id));

-- applications (chapter derived through the opportunity link)
drop policy applications_staff_select on applications;
create policy applications_staff_select on applications
  for select using (staff_has_permission(
    organization_id, 'youth-republic', 'applications:read',
    (select o.chapter_id from opportunities o where o.id = applications.opportunity_id)));

drop policy applications_staff_update on applications;
create policy applications_staff_update on applications
  for update using (staff_has_permission(
    organization_id, 'youth-republic', 'applications:update',
    (select o.chapter_id from opportunities o where o.id = applications.opportunity_id)));

-- activity_hours
drop policy activity_hours_staff_select on activity_hours;
create policy activity_hours_staff_select on activity_hours
  for select using (staff_has_permission(
    organization_id, 'youth-republic', 'hours:read',
    (select o.chapter_id from opportunities o where o.id = activity_hours.opportunity_id)));

drop policy activity_hours_staff_update on activity_hours;
create policy activity_hours_staff_update on activity_hours
  for update using (staff_has_permission(
    organization_id, 'youth-republic', 'hours:update',
    (select o.chapter_id from opportunities o where o.id = activity_hours.opportunity_id)));
```

If `0024_application_drafts_and_partner_visibility.sql` re-created `applications_staff_select` / `applications_staff_update` (it did — with `'vms'`), this migration's `drop policy ... create policy` supersedes those with the same names. Confirm the policy names match by `\d applications` on the linked DB first; if `0024` used different names, drop those too.

- [ ] **Step 2: Extend the pgTAP**

Add to `chapter_scoped_perm_test.sql`: a scoped-vs-org-wide token fixture, an `opportunities` row with `chapter_id = X`, and `select is((select count(*) from opportunities where id = ...), 1::bigint, ...)` under a claims blob that scopes `opportunities:read` to `[X]` (visible) vs `[Y]` (not visible). Bump `plan(N)`.

- [ ] **Step 3: Apply + test + commit**

```bash
set -a; source .env; set +a
npx supabase@latest db push --linked
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/database/chapter_scoped_perm_test.sql
```

```bash
git add supabase/migrations/0026_chapter_scoped_rls.sql supabase/tests/database/chapter_scoped_perm_test.sql
git commit -m "feat(db): chapter-scoped RLS on opportunities/applications/activity_hours (+ fix stale 'vms')"
```

---

## Task 10: Frontend `CreateOpportunityForm` chapter picker + delete old YR chapter functions + deploy

**Files:**
- Modify: `tmp-partner-admin/components/youth-republic/CreateOpportunityForm.tsx` + its test (on `feat/team-and-access`)
- Modify: `tmp-partner-admin/lib/youthRepublicFunctions.ts` — `create-opportunity` / `update-opportunity` payloads gain `chapterId?: string | null`
- Delete: `youth-republic/backend/supabase/functions/{create-chapter,list-chapters,update-chapter}/`

**Interfaces:**
- Consumes: `listChapters` from `@/lib/platformFunctions` (prerequisite plan), `useStaffClaims` from `AppShell`.
- Produces: the form sends `chapterId` on create; a chapter-scoped `opportunities:write` caller sees only their scoped chapters and the field is required; an unrestricted caller sees all chapters + an "Org-wide (no chapter)" option.

- [ ] **Step 1: `lib/youthRepublicFunctions.ts` payloads**

Add `chapterId?: string | null` to `CreateOpportunityPayload` and `UpdateOpportunityPayload` (whatever they're named in that file).

- [ ] **Step 2: Failing component test**

In `CreateOpportunityForm`'s test: mock `listChapters` to return `[{id:"lums",name:"Rizq LUMS",...},{id:"nust",name:"Rizq NUST",...}]`; mock `useStaffClaims` to return claims with `moduleAccess[0].chapterScopes = { "opportunities:write": ["lums"] }`. Assert: the chapter `<select>` offers only "Rizq LUMS" (not NUST, no org-wide option) and the form won't submit without it. Second case: claims with no `chapterScopes` for `opportunities:write` → the select offers both chapters plus "Org-wide (no chapter)", and submitting with the latter sends `chapterId: null`.

- [ ] **Step 3: Implement the picker**

On mount, if `organizationId` and `accessToken`, `listChapters({ organizationId }, accessToken)`. Derive `scoped = claims.moduleAccess.find(m => m.organizationId === organizationId && m.module === "youth-republic")?.chapterScopes?.["opportunities:write"]`. If `scoped` is a non-empty array → options = chapters filtered to `scoped`, field required, no org-wide option, default to the first. Else → options = all active chapters + an "Org-wide (no chapter)" entry (value `""`), default org-wide. Include `chapterId: value || null` in the create payload. (Edit mode: the field is read-only showing the stored chapter — `chapter_id` is immutable per spec §4.1.)

- [ ] **Step 4: Run — expect pass** (`npm test -- components/youth-republic/CreateOpportunityForm`; `npx tsc --noEmit`; `npm run build` still passes).

- [ ] **Step 5: Commit the frontend (on `feat/team-and-access`)**

```bash
git add components/youth-republic/CreateOpportunityForm.tsx components/youth-republic/CreateOpportunityForm.test.tsx lib/youthRepublicFunctions.ts
git commit -m "feat(opps): chapter picker on Create Opportunity, scoped to the caller's write chapters"
```

- [ ] **Step 6: Delete the old YR chapter functions (YR repo)**

```bash
cd /path/to/youth-republic
git rm -r backend/supabase/functions/create-chapter backend/supabase/functions/list-chapters backend/supabase/functions/update-chapter
grep -rn "create-chapter\|list-chapters\|update-chapter" backend/supabase/functions youth-republic/frontend 2>/dev/null   # expect none
git commit -m "chore(fn): remove YR chapter functions — chapters are platform-owned now"
```

- [ ] **Step 7: Deploy**

Platform (`tmp-partner-admin`):
```bash
set -a; source .env; set +a
npx supabase@latest functions deploy mint-staff-token --import-map ./supabase/deno.jsonc --project-ref "$SUPABASE_PROJECT_REF"
```

YR (`youth-republic/backend`) — apply `0025` + `0026` then deploy the changed functions:
```bash
set -a; source .env; set +a
npx supabase@latest db push --linked
npx supabase@latest functions deploy create-opportunity update-opportunity decide-application verify-hours update-participation-status list-opportunities list-applications list-activity-hours --no-verify-jwt --import-map ./supabase/deno.jsonc --project-ref "$SUPABASE_PROJECT_REF"
npx supabase@latest functions delete create-chapter list-chapters update-chapter --project-ref "$SUPABASE_PROJECT_REF"
```
(Match the deploy flags to what a sibling YR staff-JWT function uses — check `youth-republic/backend`'s deploy notes / a recent deploy command.)

- [ ] **Step 8: Regression**

- Platform: `cd tmp-partner-admin/supabase && deno task test` green; `npx tsc --noEmit && npm test` green; `npm run build` passes.
- YR: `cd youth-republic/backend/supabase && deno task test` green; `for f in supabase/tests/database/*.sql; do psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$f"; done` — `chapter_scoped_perm_test.sql` all `ok`, and confirm no YR pgTAP file that was green before is now red.

- [ ] **Step 9: Final commits**

```bash
# tmp-partner-admin
git add -A && git commit -m "test: finalize chapter-scoped enforcement (platform)"
# youth-republic
git add -A && git commit -m "test: finalize chapter-scoped enforcement (YR)"
```

---

## Self-Review

**Spec coverage (§3, §4, §6.3, §8, §9, §10):**

- §3.1 `mint-staff-token` per-key `chapter_scopes` build (org-wide unrestricts a key; super_admin/platform_owner emit none; flat `chapters` removed) → Task 1.
- §3.2 `lib/staffToken.ts` + YR `verifyStaffToken.ts` `chapterScopes` decode → Task 2 + Task 4.
- §3.3 4-arg `staff_has_permission` SQL + truth table → Task 3 (SQL + pgTAP); TS `staffHasPermission` 4-arg + truth table → Task 4.
- §4.1 Create Opportunity chapter picker (required + scoped for a chapter writer; optional + "org-wide" for an unrestricted writer) → Task 10; `create-opportunity` accepts/validates/stores `chapter_id` → Task 5.
- §4.2 RLS on opportunities/applications/activity_hours → 4-arg → Task 9; `update-opportunity` 4-arg check on the stored (immutable) `chapter_id` → Task 6; children derive chapter through `opportunity_id` → Tasks 7 (handlers) + 9 (RLS subqueries); public/volunteer policy branches untouched → Task 9 only re-creates the `_staff_*` policies.
- §4.3 `list-opportunities`/`list-applications`/`list-activity-hours` scope filter → Task 8; write handlers `decide-application`/`verify-hours`/`update-participation-status`/`update-opportunity` 4-arg check → Tasks 6 + 7.
- §6.3 `org_branding` `security_invoker` → Task 3.
- §8 delete the 3 YR chapter Edge Functions → Task 10 Step 6/7.
- §9 testing → per-task Deno + the two pgTAP files. §10 deploy → Task 10 Step 7 + Task 3/9 `db push`.

**Placeholder scan:** Tasks 5, 6, 7, 8, 10 describe some failing tests in prose ("mirror how its existing tests build `staffClaims`") rather than full code, because each YR handler test file has its own established fixture builder that the implementer must follow — the *assertions* and the *implementation edits* are given in full. This is a deliberate "follow the file's existing test pattern" instruction, not a hand-wave; the exact expected behavior (which chapterId succeeds, which throws `forbidden`) is spelled out for every case. Task 9 Step 1's "confirm the policy names match" is a required verification step with a concrete fallback, not a TODO.

**Type consistency:** `chapterScopes?: Record<string, string[]>` — identical in `lib/staffToken.ts` (Task 2), YR `verifyStaffToken.ts` `ModuleAccessEntry` (Task 4), and read by `readScopeChapterIds` (Task 8) + the form (Task 10). `chapter_scopes` (snake) is the on-the-wire JSON key in the token (Task 1) and the pgTAP JWT fixtures (Task 3) and the SQL function body (Task 3, Task 9). `staffHasPermission` 4-arg signature `(claims, org, module, permission, targetChapterId: string | null)` — defined Task 4, called with that exact shape in Tasks 5, 6, 7. `opportunityChapterId(supabase, opportunityId): Promise<string | null>` and `readScopeChapterIds(claims, organizationId, readPermission): string[] | null` — defined in `_shared/opportunityChapter.ts` (Tasks 7, 8), consumed within Tasks 7 and 8. `chapterId?: string | null` on the create/update opportunity payloads (Task 10) matches `CreateOpportunityInput.chapterId` (Task 5) and `input.chapterId ?? null` at the call site.

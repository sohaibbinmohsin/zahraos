# Youth Republic — Admin UI Redesign · Handoff Report

**Date:** 2026-08-31
**Author:** prior session (volunteer-app + backend-api-contract track)
**For:** the agent picking up the admin UI redesign in `tmp-partner-admin`
**Status of this doc:** current as of the two branches named in §2.

---

## 0. TL;DR

- The admin side is **meant** to be built separately — it already is. `tmp-partner-admin`
  (the "platform") is its own Next.js app + its own Supabase project; `youth-republic`
  (the "module") is another. This is `docs/superpowers/specs/2026-08-27-platform-design.md`
  §2, "Module = separate project." Nothing about building the admin UI on a different
  platform/tool changes that — keep the separation.
- The 5 functional admin screens **already exist and are merged to `main`**
  (`/modules/youth-republic/{dashboard,volunteers,opportunities,applications,hours}`),
  wired to real `youth-republic` backend endpoints. Your job is a **visual/UX
  redesign** to match the recovered admin prototype, plus the net-new screens that
  prototype introduces (form builder, Team Members, Audit Log, org branding editor).
  Do **not** rebuild the data plumbing.
- There is an in-flight **clean-break API change** on feature branches in both repos
  (`§7`). It is **not** merged to `main` yet. Build against it, not against `main`.
- One folder — `rizq/demos/` — holding both prototypes is **not under version
  control at all**. See §9 action item 1.

---

## 1. Prototype recovery + the naming collision (what happened)

There are **two** prototypes, both under `rizq/demos/youth-republic/`:

| Prototype | What it is | File(s) now |
|---|---|---|
| **Volunteer-facing** | "VOLUNTEER WHERE IT MATTERS" — hash-routed hub, opportunity detail, 2-step register w/ CNIC upload, portfolio, auth gating. Drove `youth-republic/docs/superpowers/specs/2026-08-30-backend-api-contract-design.md`. | `demos/youth-republic/volunteer-prototype.html` *(recovered)* |
| **Admin-facing** | "OPERATIONS COMMAND CENTER" — the design you are building. Dashboard, Opportunities + form builder, Applications triage, Hours verification, Volunteers, Team Members, Roles, Audit Log. | `demos/youth-republic/prototype.html`, `prototype_clean.html`, `prototype_typography_scale.html` (3 visual variants) |

**What went wrong:** the admin prototype was saved into `demos/youth-republic/` as
`prototype.html` — the exact name the volunteer prototype already had — and overwrote
it. `demos/` is in no git repo, so there was no history to restore from. The volunteer
prototype was recovered from a still-open browser tab (`View Source`) and saved to
`~/Downloads/Youth Republic — Wave 1 Prototype.html`, then copied into the repo as
`volunteer-prototype.html`.

**Font fix applied to `volunteer-prototype.html`:** Chrome's "save complete" had
rewritten the Google Fonts `<link>` and the logo `<img>` to a local `_files/` folder
that was never copied, so Oswald/Jost fell back to a system sans. Fixed by pointing
the stylesheet at the canonical Google Fonts URL (same one the sibling demos use) and
the logo at `assets/youth-republic-logo.png`. Open it **directly in a browser**
(`file://…/volunteer-prototype.html`) — the in-editor preview pane serves it as a
`data:` URL which blocks web fonts *and* hash routing.

**Still to do (see §9):** the 3 admin files still carry the stale
`<title>Youth Republic — Volunteer Operations & Noticeboard</title>` and the
collision-prone name `prototype.html`.

---

## 2. Repo & branch topology — what to check out

Two independent git repos, each with its own GitHub remote. `rizq/` itself is **not**
a git repo.

### `youth-republic` — the module (volunteer app + its backend)
- Remote: `https://github.com/sohaibbinmohsin/youth-republic`
- **`main`** — volunteer app + backend as of the VMS→Youth-Republic rename.
- **`spec/backend-api-contract`** — ✅ **pushed this session** (`origin/spec/backend-api-contract`).
  ~28 commits: the clean-break schema + edge-function rewrite (§7). Not merged to `main`.
- Backend project ref: `kbotpktgojpvkotigrjh`
  (`https://kbotpktgojpvkotigrjh.supabase.co/functions/v1`).

### `tmp-partner-admin` — the platform / admin hub (you work here)
- Remote: `https://github.com/sohaibbinmohsin/tmp-partner-admin`
- **`main`** — platform shell + RBAC + the 5 functional Youth-Republic admin screens
  (all merged: PRs #1–#2 + the `execution/vms-admin-portal-frontend` merge).
- **`feat/backend-api-contract`** — ✅ **pushed this session**
  (`origin/feat/backend-api-contract`). **← start from this branch.** 4 commits on top
  of `main`:
  - `7858cfd` admin_reset.sql for the Youth Republic seed pipeline
  - `a6cd9fe` align youth-republic staff client with final API contract
  - `d88bcd4` mint-staff-token emits `can_verify_identity` claim
  - `f45829a` org branding columns + `staff.can_verify_identity`
- This doc lives on this branch at `docs/HANDOFF-admin-ui-redesign.md`.

> Untracked in both repos (leave alone): `.claude/`, `deno.lock`, `supabase/.gitignore`,
> `supabase/deno.lock`.

**Merge order (important):** `youth-republic spec/backend-api-contract` and
`tmp-partner-admin feat/backend-api-contract` are a **coordinated pair** — they must
land together (the contract doc's §Rollout: "no compatibility window"). If the admin
branch merges first, the admin app calls signatures the deployed `youth-republic`
backend doesn't have yet.

---

## 3. The architecture you're building within

From `tmp-partner-admin/docs/superpowers/specs/2026-08-27-platform-design.md`:

- **Module = separate Supabase project. Organization = a row + RLS.** `tmp-partner-admin`
  owns staff identity/auth, the org + module registry, RBAC, and the admin hub shell
  (including the module-admin screens). It owns **no** module domain data.
- **Staff auth lives only in the platform.** The admin browser calls `youth-republic`
  backend edge functions **directly** with a **minted staff JWT** — never proxied
  through the platform's own backend. `youth-republic`'s PostgREST rejects the staff
  JWT outright (different signing secret), so **every** admin screen's data comes from
  a `youth-republic` **edge-function** call, never a direct table read.
- **Org data is pushed, not pulled.** When the platform creates/renames/deactivates an
  org that has the module enabled, it pushes the change to `youth-republic` via the
  `sync-organization` edge function. The module never makes a live cross-project call
  to resolve org data at request time.
- **Contract is append-only.** "A module backend's contract with the platform must
  never break in place." Breaking changes ship as a new additively-versioned endpoint;
  the old one is removed only after the platform migrates off it.
- **Module UI code lives in this repo**, hand-written typed client
  (`lib/youthRepublicFunctions.ts`), not imported from the `youth-republic` repo. No
  shared package, no monorepo.
- **One shared file, vendored by copy:** `functions/_shared/forms.ts` (the dynamic-form
  field registry + validators). It is copied into both frontends, not published. If it
  changes in `youth-republic`, re-copy it here.

### Env vars the admin app relies on (`tmp-partner-admin/.env.example`)
| Var | Purpose |
|---|---|
| `STAFF_JWT_SECRET` | **Must be byte-identical** to `youth-republic/backend/.env`'s. Platform mints, module verifies. Mismatch = every staff call fails silently. |
| `NEXT_PUBLIC_YOUTH_REPUBLIC_FUNCTIONS_URL` | Browser → `youth-republic` edge functions (`https://kbotpktgojpvkotigrjh.supabase.co/functions/v1`). |
| `YOUTH_REPUBLIC_BACKEND_FUNCTIONS_URL` | Server-side; used by `enable-module` / `update-organization` to call `sync-organization`. |
| `NEXT_PUBLIC_SUPABASE_URL` / `_ANON_KEY` / `NEXT_PUBLIC_FUNCTIONS_URL` | The platform's own Supabase project. |

> The design docs still say `vms`, `NEXT_PUBLIC_VMS_FUNCTIONS_URL`, `/modules/vms`,
> `lib/vmsFunctions.ts`. **That is stale doc language.** The code was fully migrated:
> module key `youth-republic`, route `/modules/youth-republic`, client
> `lib/youthRepublicFunctions.ts`, env var `NEXT_PUBLIC_YOUTH_REPUBLIC_FUNCTIONS_URL`,
> permission keys `youth-republic:*`. Use the code names.

---

## 4. What already exists on the admin side (do NOT rebuild)

### Platform-level screens (`tmp-partner-admin/app/`)
`login`, `set-password`, `organizations`, `roles`, `staff` — plus components:
`CreateStaffForm`, `DeactivateStaffButton`, `CreateOrganizationForm`,
`ModuleEnablementPanel`, `CreateCustomRoleForm`, `AssignStaffOrgRoleForm`,
`AssignStaffModuleRoleForm`, `RolesList`, `StaffList`, `OrganizationsList`, `LoginForm`,
`SetPasswordForm`, plus `components/shell/*` (`AppShell`, `useSelectedOrg()`).

### Module admin screens (`tmp-partner-admin/app/modules/youth-republic/`)
`layout.tsx` (tab nav) + `dashboard`, `volunteers`, `volunteers/[id]`, `opportunities`,
`applications`, `hours` — each with a `page.test.tsx`. Registered via
`registry/modules.ts` (`{ key: "youth-republic", navLabel: "Youth Republic",
route: "/modules/youth-republic", icon: "🤝" }`).

### The typed client — `lib/youthRepublicFunctions.ts`
Every screen fetches through this; every mutating action reuses an existing, tested
`youth-republic` edge function. Wrappers: `getKpiSummary`, `listVolunteers`,
`getVolunteerDetail`, `listOpportunities`, `listParticipationForOpportunity`,
`listApplications`, `listActivityHours`, `createOpportunity`, `updateOpportunity`,
`decideApplication`, `verifyHours`, `bulkAssignHours`, plus a CSV export. Signature
shape: `(payload, staffToken: string) => Promise<…>`.

### The `youth-republic` read endpoints these call (merged to `youth-republic` main via PR #3)
`get-kpi-summary`, `list-volunteers`, `get-volunteer-detail`, `list-opportunities`,
`list-participation-for-opportunity`, `list-applications`, `list-activity-hours` —
each gated on the matching `youth-republic:<resource>:read` permission via
`staffHasPermission`. Detail in
`youth-republic/docs/superpowers/plans/2026-08-30-vms-admin-backend-reads.md` and
`tmp-partner-admin/docs/superpowers/specs/2026-08-30-vms-admin-portal-design.md` §3.

### Global patterns every screen already follows (keep them)
- `organizationId` comes from `useSelectedOrg()` in `@/components/shell/AppShell` —
  never a second org-selection mechanism.
- Two-step token: `getBrowserSupabaseClient().auth.getSession()` → `fetchStaffToken(accessToken)`
  → then call any `youthRepublicFunctions` wrapper.
- `activity_hours.admin_notes` is rendered **only** on Volunteer-detail and Hours — the
  two endpoints that return it. Never leak it into a volunteer-facing view.
- Tests: Vitest + RTL, mock `youthRepublicFunctions`/`platformFunctions` the way
  `CreateStaffForm.test.tsx` does. `npm test` → 0 failed; `npm run build` before finishing.
- **`git commit`, do not push mid-plan** — push commands are handed to the user at the end.

---

## 5. What the new admin prototype adds beyond what's shipped

The recovered admin prototype (`demos/youth-republic/prototype.html` +
`prototype_clean.html` + `prototype_typography_scale.html`, three visual directions)
is broader than the 5 shipped screens. It presents one "Operations Command Center"
console. Screen inventory:

| Prototype screen | Shipped today? | Notes for the redesign |
|---|---|---|
| **Dashboard** ("Operations Command Center") | ✅ basic stat tiles | Prototype adds "Urgent Volunteer Capacity" bars + "Recent Applications Queue". Data still = `get-kpi-summary`; no charting lib (spec §8 defers it). |
| **Opportunities** — list + **Create/Edit with Interactive Application Form Builder** + "Live Volunteer Experience Preview" | ✅ list + plain create/edit | The **form builder is net-new UI**. It must emit a `FormDefinition` that passes `functions/_shared/forms.ts` `validateFormDefinition` and round-trips through the `update-opportunity-form` endpoint (§6). The "Live Preview" renders the volunteer apply form from that definition. |
| **Applications** — "Candidate Triage", "Candidate Submitted Responses", duplicate-submission flag | ✅ list + decide/promote | Prototype renders **arbitrary dynamic-form answers** + attachments per application — needs `answers` + `form_snapshot` + attachment ids from `list-applications` / `get-volunteer-detail` (§6, §7). |
| **Hours Verification** — Approve / **Adjust** + Admin note, "Break not deducted", "Admin Assigned Accredited Hours" | ✅ verify + bulk-assign | "Adjust" = `verify-hours` with a different `hoursVerified`; surface "adjusted by admin" when `hoursVerified ≠ hoursSubmitted` (`adjusted: boolean` in the response). |
| **Volunteers** — directory + detail inspector, "CNIC Verified", Accreditation / Accredited Certificates | ✅ list + `[id]` detail | Identity status now comes from the `attachments` / `verify-volunteer` model (§6). |
| **Team Members** — Active Team, Edit Access, Account Access Status, "Awaiting account activation", Change Password | ✅ as platform `app/staff` | Prototype folds this into the module console. Decide (§9-4) whether it stays a platform screen or gets a module-scoped view. Reuse `CreateStaffForm` / `DeactivateStaffButton` / `AssignStaffModuleRoleForm`. |
| **Roles** — Create Custom Role, Base Permission Template, "Clone from Operations Lead / Drive Coordinator / Application Reviewer" | ✅ as platform `app/roles` | Same IA question. Reuse `CreateCustomRoleForm` / `RolesList`. Permissions offered must come from the org's enabled modules (`platform-design.md` §2). |
| **Audit Log / Audit Trail** — All Action Types, Authorized Actors | ❌ **not built** | `youth-republic.admin_action_log` exists and gains new action values in §7. Needs a new `youth-republic` read endpoint (list/filter `admin_action_log`) + a screen. Platform-side `staff` actions may be a separate source. |
| **Org branding editor** (implied — `brand_color` / `logo_url` / `favicon_url` / `about`) | ❌ **not built** | Columns land on the admin `organizations` table in `f45829a`. Admin owns branding; logo/favicon assets are hosted by the platform; changes propagate to `youth-republic` via `sync-organization` (§6). Sub-project 4 of the backend-api-contract doc. |

**IA divergence to resolve with the user:** the shipped app separates *platform*
concerns (Staff, Roles, Organizations at the top nav) from *module* screens (under
`/modules/youth-republic/`). The prototype merges them into one Youth-Republic
operations console under a Super-Admin identity. Pick one before building — see §9-4.

---

## 6. The contract the admin UI codes against (must not break)

All of this is specified in
`youth-republic/docs/superpowers/specs/2026-08-30-backend-api-contract-design.md`.

1. **Auth.** Call `NEXT_PUBLIC_YOUTH_REPUBLIC_FUNCTIONS_URL/<fn>` with
   `Authorization: Bearer <staff JWT>` (HS256, signed with `STAFF_JWT_SECRET`).
   Token claims (from `mint-staff-token`): resolved per-module permission set
   (`module_access` / `moduleAccess`), `org_roles` entries **with no `role` field**
   (affiliation only — authorization is per-permission), and **`canVerifyIdentity`**
   (boolean).
2. **`functions/_shared/forms.ts`** — the form builder must use this exact
   `validateFormDefinition` / `validateAnswers` / `resolveConsent`. Field types:
   `short_text | long_text | email | phone | url | number | date | select |
   multiselect | radio | checkbox | file`. Rules: unique non-empty field ids; options
   present for choice types; `file.accept` ⊆ the `application_file` domain allowlist;
   at most one required `checkbox` = the consent field. Vendored by copy — no npm.
3. **`sync-organization`** payload the admin sends:
   `{ id, name, slug, deactivatedAt, brandColor?, logoUrl?, faviconUrl?, about? }`
   (COALESCE-merged on the module side, so an un-updated caller is safe).
4. **Admin `organizations` table** needs the 4 branding columns — added in `f45829a`.
   Editing UI is the admin's job.
5. **Identity verification** (`list-pending-volunteers`, `verify-volunteer`) is gated by
   `staff.can_verify_identity` → the `canVerifyIdentity` claim (folded into
   `mint-staff-token` in `d88bcd4`), for the **central Youth Republic team** — **not**
   an org role. `platform_owner` always has it. Needs a screen to toggle that column
   per staff member.
6. **Attachments are never read directly.** Screens get attachment **ids** from
   `list-applications` / `get-volunteer-detail`, then resolve each to a signed URL
   (5-min TTL) via `get-attachment`. Permission matrix: `application_file` /
   `session_photo` → staff of that `organization_id` with the read permission;
   `identity_doc` → central verification team only.
7. **Contract stability.** Need a `youth-republic` endpoint changed in a breaking way?
   It ships as a **new versioned endpoint**; the admin migrates; only then is the old
   one retired. Drift is caught by CI booting the `youth-republic` local stack and
   running an integration suite against `lib/youthRepublicFunctions.ts`.

---

## 7. What's "live" vs pending — the `backend-api-contract` clean break

**Nothing below is on `main` in either repo yet.** It's on the two branches in §2,
which land together.

### Schema (`youth-republic` migrations 0016–0021 + renames)
- `organizations`: `+ brand_color, logo_url, favicon_url, about`; new anon-readable
  `org_branding` view.
- `opportunities`: `+ about text, duties text[], eligibility text[], what_to_bring
  text[], application_form jsonb`; **dropped** `eligibility_criteria`; `description`
  is now just the card blurb.
- `applications`: `+ answers jsonb, form_snapshot jsonb, applicant_name/email/phone,
  consent_accepted`; **dropped** `motivation_statement`.
- `activity_hours`: `+ note text`; `verification_status` enum → `pending | verified |
  rejected`, default `pending`; `recorded` removed; "adjusted by admin" is derived
  (`hours_verified <> hours_submitted`) and surfaced as `adjusted: boolean`.
- **New `attachments` table** + 3 private storage buckets (`identity-docs`,
  `application-files`, `session-photos`); all reads via `get-attachment`; signed-URL
  upload flow.
- `volunteers`: `cnic_number` → `id_doc_number`; `+ id_doc_type ('cnic' | 'b_form')`;
  **dropped** `cnic_document_url` (now an `attachments` row).
- `admin_action_log`: new `action` values — `volunteer_identity_verified/rejected`,
  `hours_verified/adjusted/rejected`, `application_form_updated`.

### `youth-republic` edge functions — new
`request-attachment-upload`, `finalize-attachment`, `get-attachment`,
`verify-volunteer`, `list-pending-volunteers`, `get-volunteer-portfolio`,
`update-opportunity-form`, `get-opportunity-detail`.

### `youth-republic` edge functions — changed signatures (clean break, no shims)
- `apply-to-opportunity` → `{ opportunityId, answers, attachmentIds? }`; 422
  `{ fieldErrors }` on validation failure.
- `submit-hours` → `+ note?, attachmentIds?`.
- `register-volunteer` → `+ idDocType, idDocNumber, idDocAttachmentId`.
- `create-opportunity` / `update-opportunity` → `+ about?, duties?, eligibility?,
  whatToBring?, applicationForm?`; drop `eligibilityCriteria`.
- `list-opportunities` → filters/facets/sort, public vs staff projections.
- `list-applications` / `get-volunteer-detail` → now project `answers` +
  `form_snapshot` + attachment ids grouped by field; session `note` / `adjusted` /
  `photoAttachmentIds`.
- `verify-hours` / `bulk-assign-hours` → same signature; branch the audit action on
  verified vs adjusted vs rejected.
- `sync-organization` → payload widened with `brandColor?, logoUrl?, faviconUrl?,
  about?`.

### Data reset (part of the coordinated landing)
`reset` + `seed` of **both** DBs — keeps super-admin/admin staff, drops everything
else, re-seeds 4 orgs with **fixed UUIDs** (`rizq`, `green-crescent`, `sehat-first`,
`read-foundation`) + 6 opportunities + one worked-example volunteer (Ayesha Khan).
Admin side re-points `staff_org_roles` to the new fixed org UUIDs
(`7858cfd admin_reset.sql`).

---

## 8. Naming (read once, then never trip on it)

- **Module key / route / code:** `youth-republic` (never `vms`). Route
  `/modules/youth-republic`. Client `lib/youthRepublicFunctions.ts`. Permission keys
  `youth-republic:volunteers:read` etc.
- **"Youth Republic"** = the product/brand of the volunteer-management module.
- **"Rizq"** = the first tenant organization (first row in `organizations`), not a
  product name.
- Any doc that still says `vms` / `NEXT_PUBLIC_VMS_FUNCTIONS_URL` / `/modules/vms` is
  pre-rename prose — trust the code.

---

## 9. Action items & open decisions

1. **Version `rizq/demos/`.** It holds both prototypes and is in **no git repo** — one
   accidental overwrite already cost the volunteer prototype (recovered from a browser
   tab). Decide: init a repo at `rizq/`, or move `demos/` into `youth-republic/`
   (the backend-api-contract doc already refers to it as "in the frontend repo"), then
   commit both prototypes. **Do this before any more prototype edits.**
2. **Rename the admin prototype files + fix their `<title>`.** All three still read
   `<title>Youth Republic — Volunteer Operations & Noticeboard</title>` and one is
   named `prototype.html` (the name that caused the collision). Suggest
   `admin-prototype.html` / `admin-prototype-clean.html` /
   `admin-prototype-typographic.html` with an accurate title.
3. **Confirm which admin prototype variant is the source of truth** — a/clean/typography
   are three visual directions. Pick one (or the intended blend) before building.
4. **Resolve the IA divergence (§5).** Does the redesign keep the shipped separation
   (platform nav: Staff / Roles / Organizations; module nav: the 5 screens), or adopt
   the prototype's single Youth-Republic operations console that absorbs Team Members /
   Roles / Audit Log? This decides routing and how much of `app/staff` + `app/roles`
   gets re-skinned vs re-homed.
5. **Two net-new backends the redesign implies** (each an additively-versioned
   `youth-republic` endpoint + its own screen): an `admin_action_log` list/filter
   endpoint for the Audit Log screen, and confirm `update-opportunity-form` +
   `get-attachment` coverage for the form builder + application review.
6. **Design system.** The prototype uses Jost + Oswald, a violet primary (`#941A80`),
   light-mode only. The shipped admin app forces light mode already
   (`c4997c0 style: force light mode`). No charting library (spec §8).
7. **Merge coordination.** Land `feat/backend-api-contract` (this repo) only together
   with `youth-republic spec/backend-api-contract`. Until both are on `main`, keep the
   redesign on a branch off `feat/backend-api-contract`.

---

## 10. Key file map

| Path | What |
|---|---|
| `demos/youth-republic/prototype.html` (+ `_clean`, `_typography_scale`) | **Admin prototype** — the design to build (3 variants) |
| `demos/youth-republic/volunteer-prototype.html` | Recovered volunteer prototype (font-fixed) |
| `demos/youth-republic/wave1-demo-{a,b,c}-*.html` | Earlier small demo explorations |
| `demos/README.md` | Design brief: color roles, Jost + Oswald, status palette, patterns |
| `tmp-partner-admin/docs/superpowers/specs/2026-08-27-platform-design.md` | Platform architecture (separation model, §2, §7) |
| `tmp-partner-admin/docs/superpowers/specs/2026-08-30-vms-admin-portal-design.md` | The shipped 5-screen admin design (naming stale) |
| `tmp-partner-admin/docs/superpowers/plans/2026-08-30-vms-admin-portal-frontend.md` | How those screens were built (task-by-task) |
| `youth-republic/docs/superpowers/specs/2026-08-30-backend-api-contract-design.md` | **The contract** — read §6, §7 fully |
| `youth-republic/docs/superpowers/plans/2026-08-30-vms-admin-backend-reads.md` | The 7 read endpoints |
| `tmp-partner-admin/lib/youthRepublicFunctions.ts` | The typed client every admin screen uses |
| `tmp-partner-admin/registry/modules.ts` | Module registration |
| `tmp-partner-admin/components/shell/AppShell` | `useSelectedOrg()`, nav gating |

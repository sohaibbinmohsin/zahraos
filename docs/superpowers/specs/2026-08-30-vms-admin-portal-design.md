# VMS Admin Portal Design Spec (repo: `tmp-partner-admin`, with a `vms/backend` companion)

Status: approved for implementation planning
Date: 2026-08-30

## 1. Purpose & Scope

`registry/modules.ts` in `platform` has been empty since the shell was
built — `platform-frontend-shell.md`'s own words: "this plan builds the
mechanism the shell iterates over, not any module's screens." This spec
is that first module: the admin-facing screens for `vms` (Youth
Republic's volunteer management system), registered into the shell's
existing module mechanism.

Source: `VMS Phase 1 Acceptance Report` (2026-08-30), section 03 "Build
gaps — Admin VMS portal — module not built," 11 checklist items. This
spec turns that checklist into one coherent design.

**Explicitly out of scope**: the 8 volunteer-app (`youth-republic/frontend`)
polish items from the same report — a separate spec, planned after this
one, since the two are independent (different repo, no shared code path).

## 2. The Cross-Project Read Problem

`platform` and `vms/backend` are separate Supabase projects (§2 of
`platform-design.md`). `platform`'s admin hub already calls `vms/backend`
Edge Functions for **writes** it has no UI for yet (none, actually — no
VMS write ever happens from `platform` today; every existing `vms/backend`
write function was built and tested from its own repo's test suite, never
called from a real UI). Reading VMS data into an admin screen has the same
constraint the write path already established, twice over confirmed this
session: `vms/backend`'s PostgREST layer rejects the staff JWT outright
(wrong signing secret, verified live) — so there is no direct-table-read
option, RLS or otherwise, from `platform`'s browser client. Every VMS
admin screen's data comes from a `vms/backend` Edge Function call, full
stop.

Concretely, this spec adds:

- **`NEXT_PUBLIC_VMS_FUNCTIONS_URL`** — a new `platform` env var
  (`https://kbotpktgojpvkotigrjh.supabase.co/functions/v1`), alongside the
  existing `NEXT_PUBLIC_FUNCTIONS_URL` (platform's own functions).
- **`lib/vmsFunctions.ts`** in `platform` — mirrors `platformFunctions.ts`'s
  `callFunction()` helper, but targets the VMS URL and sends the **staff
  JWT** (from the existing `fetchStaffToken()`/`mintStaffToken()` pair) as
  the bearer token, not the platform session token `platformFunctions.ts`
  uses. `vms/backend`'s `verifyStaffToken()` already expects exactly this
  shape — no backend change needed to accept it.

## 3. New `vms/backend` Edge Functions (reads)

Every existing `vms/backend` function is a single-purpose write
(`create-opportunity`, `decide-application`, `verify-hours`, ...) or one of
the two existing CSV exports. None of them answer "list/search/filter" or
"aggregate" questions — that's the actual gap. New functions, one per
resource (matching this repo's existing one-function-per-action
convention, not a general-purpose query dispatcher):

| Function | Input | Permission required | Returns |
|---|---|---|---|
| `get-kpi-summary` | `organizationId` | `volunteers:read` | All 10 metrics in one call: total registered, active, completed participations, applications received, selected, total verified hours, counts by city/province/institution, participation by opportunity, participation by activity type |
| `list-volunteers` | `organizationId`, `search?`, `city?`, `province?`, `institution?`, `status?`, `limit`, `offset` | `volunteers:read` | Paginated volunteer rows scoped to the org via `org_volunteer_index` (never a bare `volunteers` scan — matches the existing "global pool, org visibility is the join" model) |
| `get-volunteer-detail` | `organizationId`, `volunteerId` | `volunteers:read` | One volunteer's applications, participations, activity_hours (with `admin_notes`), and roles — the §7 "bidirectional navigation" record, in one call |
| `list-opportunities` | `organizationId`, `type?`, `status?`, `limit`, `offset` | `opportunities:read` | Paginated opportunities, `opportunity_status()` computed status included |
| `list-participation-for-opportunity` | `organizationId`, `opportunityId` | `participation:read` | Applicants + participants for one opportunity (feeds the "view applicants + participants" requirement without a second list-applications round trip when already scoped to one opportunity) |
| `list-applications` | `organizationId`, `opportunityId?`, `status?`, `limit`, `offset` | `applications:read` | Paginated applications |
| `list-activity-hours` | `organizationId`, `activityType?`, `participationStatus?`, `limit`, `offset` | `hours:read` | Paginated activity_hours rows, including `admin_notes` (admin-only — see §5) |

`get-kpi-summary` is gated on `volunteers:read` specifically because every
one of its ten metrics is volunteer-scoped data (registrations, their
applications, their participation, their hours) — it's the catalog's
existing least-privileged permission that already covers seeing this
data elsewhere, not a new "dashboard access" concept.

All seven follow the exact structure every existing function already
uses: `handler.ts` (pure function, service-role client, `staffHasPermission`
gate first) + `index.ts` (CORS-wrapped `handleRequest` export, mirroring
the pattern the CORS-fix pass already established) + both files' own
`handler.test.ts`/`index.test.ts`.

## 4. Extending `export-csv`

`exportVolunteersCsv` and `exportApplicationsCsv` already exist and need
no changes. Add `exportOpportunitiesCsv` and `exportActivityHoursCsv` to
the same file, reusing the existing `csvEscape` helper (already closes the
formula-injection finding from the earlier review — new columns inherit
that protection for free). Gated on `opportunities:read` and `hours:read`
respectively, matching the catalog's existing `export:read` intent loosely
— **decision**: gate each export on the same permission its own list view
needs, not a separate blanket `export:read` check, since the catalog
already has one row per resource and requiring both would be redundant
friction with no security benefit (whoever can read the list can already
see everything the export contains).

## 5. Admin Notes — Visibility Boundary

`activity_hours.admin_notes` already exists as a column; nothing writes or
reads it today. The requirement (§5E: "admin notes are visible to admins
but never leak into any volunteer-facing view") is enforced by construction
here, not by a new check: `admin_notes` is selected only in
`get-volunteer-detail` and `list-activity-hours` (both admin-only, staff-JWT-gated
functions) — it is never added to any volunteer-facing query
(`portfolio/page.tsx`'s `activity_hours` select, fixed in the defects pass,
deliberately does not select it, and stays that way).

## 6. `platform` Frontend — Module Registration & Screens

**Registration**: one `registry/modules.ts` entry —
`{ key: "vms", navLabel: "VMS", route: "/modules/vms", icon: "🤝" }` —
(`icon` is declared on `ModuleRegistryEntry` but `AppShell`'s nav render
doesn't currently use it — any concrete value satisfies the type; this one
was picked over the plan deciding it needs to matter) —
appended as its own task, per that file's own header comment ("nothing
else in this file changes when that happens"). This alone makes the
already-correct `AppShell` nav-gating (`claims?.moduleAccess.some(...)`)
start showing the link for any staff member actually granted a VMS module
role — closing the "super admin can't see VMS" report with the module's
existence, not a permissions fix (the permission logic was already right).

**Routing**: one top-level route, `/modules/vms`, redirecting to
`/modules/vms/dashboard`. Five sibling screens under it — `dashboard`,
`volunteers`, `opportunities`, `applications`, `hours` — sharing a small
module-local layout with its own tab nav, the same relationship
Staff/Roles/Organizations already have as siblings under `AppShell`'s
top-level nav, just one level deeper.

**Screens**:
- **Dashboard** — the 10 KPIs from `get-kpi-summary`, rendered as simple
  stat tiles (no charting library — out of scope, add later if wanted).
- **Volunteers** — search + the four filters, paginated table, row click →
  volunteer detail (§5F), CSV export button.
- **Volunteer detail** — everything `get-volunteer-detail` returns, laid
  out as: profile header, applications list, activity history table
  (same Activity/Type/Role/Date/Hours/Status/Admin-notes shape as the
  volunteer-facing portfolio table, plus the admin-only notes column).
- **Opportunities** — list + type/status filters, create/edit forms calling
  the already-existing `createOpportunity`/`updateOpportunity` (no backend
  change), row → applicants/participants view via
  `list-participation-for-opportunity`, CSV export.
- **Applications** — list + opportunity/status filters, a decide action
  calling the already-existing `decide-application`, a "promote to
  selected" action that is the same call with `decision: "selected"` (no
  new backend), CSV export.
- **Hours** — list + activity-type/participation-status filters, a verify
  action calling the already-existing `verify-hours`, a bulk-assign form
  calling the already-existing `bulk-assign-hours`, CSV export.

Every screen's data fetch goes through `vmsFunctions.ts` (§2); every
mutating action reuses an existing, already-tested `vms/backend` function
verbatim — this spec adds zero new write endpoints.

## 7. Testing

Same discipline as every other track this session: TDD, RED confirmed
before implementing, real hosted-project fixtures (no mocks in
`vms/backend`'s own tests), component tests in `platform` mocking
`vmsFunctions`/`platformFunctions` the way `CreateStaffForm.test.tsx`
already does. New Edge Functions each get their own `handler.test.ts` +
`index.test.ts` pair. Pagination is plain offset/limit (`.range()`) —
no cursor complexity at this scale. "CSV/Excel export" means CSV only,
matching what's already shipped.

## 8. Explicitly Deferred

- Real `.xlsx` binary export (CSV satisfies the doc's own wording; revisit
  only if actually requested).
- Charting/visualization on the KPI dashboard (stat tiles are sufficient
  for Phase 1; a charting library is a design-system decision, not this
  spec's).
- Cursor-based pagination, server-side full-text search ranking, or any
  other scale optimization beyond what offset/limit + `ilike` filters
  need at Phase 1's expected data volume.

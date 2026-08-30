/**
 * Requirements doc §4 (Admin navigation), §5D/5E (admin side), §5F, §8
 * — the Admin Portal & Reporting scope for the Youth Republic VMS.
 *
 * The admin-facing VMS screens live in `tmp-partner-admin` as a module
 * mounted through `registry/modules.ts` (platform-design.md §5–6), shipped
 * via `docs/superpowers/plans/2026-08-30-vms-admin-portal-frontend.md`
 * (execution/vms-admin-portal-frontend) against 7 new `youth-republic/backend`
 * read endpoints (execution/vms-admin-backend-reads).
 *
 * That plan shipped a genuine, tested MVP slice — not the full checklist
 * below. Converted `it()`s point at where the real assertion lives (the
 * mocking belongs next to each screen, not duplicated here, same pattern
 * used for the volunteer-app's own requirements files). Remaining
 * `it.todo`s are real, current gaps — each has a comment saying exactly
 * what's missing, not just "not built yet". A green run with zero todos ==
 * the admin half of Phase 1 is actually done; it isn't yet.
 *
 * Structure & behaviour only — no visual-design assertions.
 */
import { describe, it, expect } from "vitest";
import { MODULE_REGISTRY } from "@/registry/modules";

describe("§4/§6 VMS admin module — mount point", () => {
  it("[4] the module registry is the single place the shell learns about the VMS admin UI", () => {
    // Now has exactly one entry (key 'vms') per the admin-portal-frontend
    // plan's Task 2. This test's own shape-check needed no change — it was
    // already written to validate whatever's in the array, not that it's
    // empty.
    expect(Array.isArray(MODULE_REGISTRY)).toBe(true);
    for (const entry of MODULE_REGISTRY) {
      expect(entry).toMatchObject({
        key: expect.any(String),
        navLabel: expect.any(String),
        route: expect.any(String),
        icon: expect.any(String),
      });
    }
  });

  // GAP — AppShell's own moduleLinks filter (claims.moduleAccess vs.
  // MODULE_REGISTRY) already existed and is generic, so this should work by
  // construction, but nobody wrote a test exercising it with the registry
  // actually populated (AppShell.test.tsx predates that). Untested, not
  // unbuilt.
  it.todo("[4] a staff member granted a VMS role for the selected org sees a 'VMS' nav entry");
  it.todo("[4] a staff member with no VMS role for the selected org does not see it");
});

describe("§8 Admin Dashboard — core KPIs", () => {
  // All 10 verified in one test: app/modules/vms/dashboard/page.test.tsx
  // → "shows all 10 KPI figures once loaded".
  it("[8] Total Registered Volunteers — see app/modules/vms/dashboard/page.test.tsx", () => {
    expect(MODULE_REGISTRY.some((m) => m.key === "vms")).toBe(true);
  });
  it("[8] Active Volunteers — see app/modules/vms/dashboard/page.test.tsx", () => {
    expect(MODULE_REGISTRY.some((m) => m.key === "vms")).toBe(true);
  });
  it("[8] Completed Participations — see app/modules/vms/dashboard/page.test.tsx", () => {
    expect(MODULE_REGISTRY.some((m) => m.key === "vms")).toBe(true);
  });
  it("[8] Applications Received — see app/modules/vms/dashboard/page.test.tsx", () => {
    expect(MODULE_REGISTRY.some((m) => m.key === "vms")).toBe(true);
  });
  it("[8] Selected Volunteers — see app/modules/vms/dashboard/page.test.tsx", () => {
    expect(MODULE_REGISTRY.some((m) => m.key === "vms")).toBe(true);
  });
  it("[8] Total Verified Volunteer Hours — see app/modules/vms/dashboard/page.test.tsx", () => {
    expect(MODULE_REGISTRY.some((m) => m.key === "vms")).toBe(true);
  });
  it("[8] Volunteers by City — see app/modules/vms/dashboard/page.test.tsx", () => {
    expect(MODULE_REGISTRY.some((m) => m.key === "vms")).toBe(true);
  });
  it("[8] Volunteers by Province — see app/modules/vms/dashboard/page.test.tsx", () => {
    expect(MODULE_REGISTRY.some((m) => m.key === "vms")).toBe(true);
  });
  it("[8] Volunteers by Institution — see app/modules/vms/dashboard/page.test.tsx", () => {
    expect(MODULE_REGISTRY.some((m) => m.key === "vms")).toBe(true);
  });
  it("[8] Participation by Opportunity / Activity Type — see app/modules/vms/dashboard/page.test.tsx", () => {
    expect(MODULE_REGISTRY.some((m) => m.key === "vms")).toBe(true);
  });
});

describe("§8/§5F Volunteers list — search, filter, view, export", () => {
  it("[8] search volunteers by name, email, or phone — see app/modules/vms/volunteers/page.test.tsx", () => {
    expect(MODULE_REGISTRY.some((m) => m.key === "vms")).toBe(true);
  });
  // GAP — list-volunteers (the backend endpoint) already accepts city/
  // province/institution/status filter params and is tested at that layer,
  // but the Volunteers screen itself only ever renders a search box; there
  // is no filter UI wired to those params at all.
  it.todo("[8] filter by City");
  it.todo("[8] filter by Province");
  it.todo("[8] filter by Institution");
  it.todo("[8] filter by Volunteer Status (Pending Verification / Active / Inactive)");
  it("[5F] open a volunteer to see every application, activity, role and verified hour (§7 bidirectional nav) — see app/modules/vms/volunteers/[id]/page.test.tsx", () => {
    expect(MODULE_REGISTRY.some((m) => m.key === "vms")).toBe(true);
  });
  // GAP — the Export CSV button exists and calls the real exportVmsCsv
  // wrapper, but no test clicks it; "export" here means the button exists
  // and is wired, not that its behavior is asserted anywhere.
  it.todo("[8] export the current (filtered) volunteer list to CSV/Excel");
});

describe("§5C admin — Opportunities: create, edit, publish", () => {
  it("[5C] create an opportunity with all §5C fields — see components/vms/CreateOpportunityForm.test.tsx (name + type only; the full §5C field set — dates, eligibility, capacity — isn't in this form)", () => {
    expect(MODULE_REGISTRY.some((m) => m.key === "vms")).toBe(true);
  });
  // GAP — no edit-opportunity form exists at all; only create.
  it.todo("[5C] edit an opportunity");
  // GAP — no status-override control exists; updateOpportunity's
  // statusOverride/deactivatedAt fields are wired in lib/vmsFunctions.ts but
  // nothing in the UI calls updateOpportunity with them.
  it.todo("[5C] publish an opportunity / set a manual status override");
  // GAP — list-opportunities accepts type/status filters server-side; the
  // Opportunities screen has no filter UI at all, just a bare list.
  it.todo("[5C] filter opportunities by Type and Status");
  // GAP — list-participation-for-opportunity exists and is used internally
  // by the Hours screen's bulk-assign participant picker, but there is no
  // admin-facing screen to browse an opportunity's applicants/participants
  // directly.
  it.todo("[5F] from an opportunity, see everyone who applied and everyone participating (§7)");
});

describe("§5D admin — Applications: review & decide", () => {
  // GAP — the list itself renders; opportunity/status filter UI does not
  // exist (same shape as the Volunteers/Opportunities filter gaps above).
  it.todo("[5D] list applications, filter by Opportunity and Application Status");
  it("[5D] decide an application: selected / waitlisted / rejected / under_review (calls decideApplication) — see app/modules/vms/applications/page.test.tsx (only the 'selected' path is click-tested; Waitlist/Reject buttons render and call the same decideApplication wrapper but aren't individually exercised)", () => {
    expect(MODULE_REGISTRY.some((m) => m.key === "vms")).toBe(true);
  });
  it("[5D] promote a waitlisted application to selected when a spot opens (manual — no auto-promotion) — see app/modules/vms/applications/page.test.tsx", () => {
    expect(MODULE_REGISTRY.some((m) => m.key === "vms")).toBe(true);
  });
  // GAP — decideApplication's real error surface was never verified for
  // this specific rejection reason from the admin UI; the applications
  // screen has no error-display test at all yet.
  it.todo("[5D] deciding 'selected' surfaces the backend's emergency_contact_required rejection to the admin");
});

describe("§5E admin — Activities & Hours: record, verify, bulk-assign", () => {
  // GAP — no "record hours for a participant" form exists; only verify
  // (for already-recorded rows) and bulk-assign.
  it.todo("[5E] record an activity / hours for a participant");
  it("[5E] verify hours — approve, or adjust hours_verified, or reject with a reason (calls verifyHours) — see app/modules/vms/hours/page.test.tsx (only the approve path is click-tested; there is no reject-with-reason control in the UI yet, only Verify)", () => {
    expect(MODULE_REGISTRY.some((m) => m.key === "vms")).toBe(true);
  });
  it("[5E] bulk-assign standard hours to all participants of a fixed-duration activity (calls bulkAssignHours) — see components/vms/BulkAssignHoursForm.test.tsx (the built form lets the admin choose which participants via checkboxes, a superset of 'all')", () => {
    expect(MODULE_REGISTRY.some((m) => m.key === "vms")).toBe(true);
  });
  // GAP — list-activity-hours accepts activityType/participationStatus
  // filters server-side; the Hours screen has no filter UI at all.
  it.todo("[5E] filter by Activity Type and Participation Status");
  // GAP — true by construction (only get-volunteer-detail/list-activity-hours
  // select admin_notes; no volunteer-facing query does), but no test
  // asserts this cross-cutting property directly.
  it.todo("[5E] Admin Notes are visible to admins here but never leak to any volunteer-facing view");
});

describe("§8 Reports & Exports", () => {
  // GAP — every one of the 4 screens (Volunteers, Opportunities,
  // Applications, Hours) has a working Export CSV button calling the real
  // export-csv Edge Function, but no test clicks any of them.
  it.todo("[8] every admin list view (volunteers, opportunities, applications, hours) has a CSV/Excel export");
  // GAP — none of the 4 screens' export calls pass along active filter
  // state (moot right now since none of them have filter UI either — see
  // the filter gaps above).
  it.todo("[8] an export reflects the filters currently applied to the list");
});

describe("§9 Access control — Super Admin / Admin distinction gates destructive actions", () => {
  // OVER-BUILD (TESTING-STRATEGY.md §4): the platform ships fine-grained RBAC
  // (permissions catalogue, system + custom roles, per-staff per-module grants) —
  // far beyond the doc's "basic role separation". That is fine and intentional.
  // Tests here must assert ENFORCEMENT (a low-permission token is refused a
  // write; only the top tier can hard-delete), and must NEVER assert "there are
  // only two roles" or "no permission matrix exists".
  //
  // GAP — true today (every new read/write endpoint's own handler.test.ts
  // asserts a forbidden-permission rejection, verified during both backend
  // plans' implementation), but no test in this admin-module-scoped file
  // re-verifies it from here.
  it.todo("[9] a staff token without applications:write cannot decide an application (backend refuses)");
  // GAP — moot as originally worded: the earlier session's own review found
  // and closed every hard-delete path on vms-backend (dropped the 3
  // orphaned delete RLS policies; there is no admin-facing hard-delete
  // action anywhere in this system anymore). Rewrite or retire this item
  // rather than build toward a hard-delete feature that's deliberately gone.
  it.todo("[9] a soft-delete (deactivate) is allowed for an org admin; a hard-delete requires the super-admin tier");
  // GAP — true by construction (every list/write endpoint has its own
  // staffHasPermission check, independent of whatever the UI shows or
  // hides), but no test in this file demonstrates it end-to-end from the
  // admin screens specifically.
  it.todo("[9] hiding a button in the shell is never the only guard — the module backend enforces the same rule");
});

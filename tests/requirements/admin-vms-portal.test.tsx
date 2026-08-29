/**
 * Requirements doc §4 (Admin navigation), §5D/5E (admin side), §5F, §8
 * — the Admin Portal & Reporting scope for the Youth Republic VMS.
 *
 * In this system the admin-facing VMS screens live in `tmp-partner-admin` as a
 * module mounted through `registry/modules.ts` (platform-design.md §5–6). That
 * module UI is NOT built yet — the backend Edge Functions it will call
 * (`decide-application`, `verify-hours`, `bulk-assign-hours`, `export-csv`,
 * `create-opportunity`, …) exist in `youth-republic/backend` with their own
 * handler tests.
 *
 * So almost everything here is `it.todo`: a checklist for the VMS admin module.
 * Convert each to a real `it(...)` as the corresponding screen ships. A green run
 * with zero todos == the admin half of Phase 1 is done.
 *
 * Structure & behaviour only — no visual-design assertions.
 */
import { describe, it, expect } from "vitest";
import { MODULE_REGISTRY } from "@/registry/modules";

describe("§4/§6 VMS admin module — mount point", () => {
  it("[4] the module registry is the single place the shell learns about the VMS admin UI", () => {
    // Today: empty. When the VMS admin module ships it appends exactly one entry
    // here (key 'vms', a navLabel, a route, an icon) and nothing else in the file
    // changes. This test documents that contract and will need its expectation
    // updated — deliberately — at that point.
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

  it.todo("[4] a staff member granted a VMS role for the selected org sees a 'VMS' nav entry");
  it.todo("[4] a staff member with no VMS role for the selected org does not see it");
});

describe("§8 Admin Dashboard — core KPIs", () => {
  // Each KPI renders from a known query. Doc §8 KPI table, verbatim:
  it.todo("[8] Total Registered Volunteers");
  it.todo("[8] Active Volunteers");
  it.todo("[8] Completed Participations");
  it.todo("[8] Applications Received");
  it.todo("[8] Selected Volunteers");
  it.todo("[8] Total Verified Volunteer Hours");
  it.todo("[8] Volunteers by City");
  it.todo("[8] Volunteers by Province");
  it.todo("[8] Volunteers by Institution");
  it.todo("[8] Participation by Opportunity / Activity Type");
});

describe("§8/§5F Volunteers list — search, filter, view, export", () => {
  it.todo("[8] search volunteers by name, email, or phone");
  it.todo("[8] filter by City");
  it.todo("[8] filter by Province");
  it.todo("[8] filter by Institution");
  it.todo("[8] filter by Volunteer Status (Pending Verification / Active / Inactive)");
  it.todo("[5F] open a volunteer to see every application, activity, role and verified hour (§7 bidirectional nav)");
  it.todo("[8] export the current (filtered) volunteer list to CSV/Excel");
});

describe("§5C admin — Opportunities: create, edit, publish", () => {
  it.todo("[5C] create an opportunity with all §5C fields");
  it.todo("[5C] edit an opportunity");
  it.todo("[5C] publish an opportunity / set a manual status override");
  it.todo("[5C] filter opportunities by Type and Status");
  it.todo("[5F] from an opportunity, see everyone who applied and everyone participating (§7)");
});

describe("§5D admin — Applications: review & decide", () => {
  it.todo("[5D] list applications, filter by Opportunity and Application Status");
  it.todo("[5D] decide an application: selected / waitlisted / rejected / under_review (calls decideApplication)");
  it.todo("[5D] promote a waitlisted application to selected when a spot opens (manual — no auto-promotion)");
  it.todo("[5D] deciding 'selected' surfaces the backend's emergency_contact_required rejection to the admin");
});

describe("§5E admin — Activities & Hours: record, verify, bulk-assign", () => {
  it.todo("[5E] record an activity / hours for a participant");
  it.todo("[5E] verify hours — approve, or adjust hours_verified, or reject with a reason (calls verifyHours)");
  it.todo("[5E] bulk-assign standard hours to all participants of a fixed-duration activity (calls bulkAssignHours)");
  it.todo("[5E] filter by Activity Type and Participation Status");
  it.todo("[5E] Admin Notes are visible to admins here but never leak to any volunteer-facing view");
});

describe("§8 Reports & Exports", () => {
  it.todo("[8] every admin list view (volunteers, opportunities, applications, hours) has a CSV/Excel export");
  it.todo("[8] an export reflects the filters currently applied to the list");
});

describe("§9 Access control — Super Admin / Admin distinction gates destructive actions", () => {
  // OVER-BUILD (TESTING-STRATEGY.md §4): the platform ships fine-grained RBAC
  // (permissions catalog, system + custom roles, per-staff per-module grants) —
  // far beyond the doc's "basic role separation". That is fine and intentional.
  // Tests here must assert ENFORCEMENT (a low-permission token is refused a
  // write; only the top tier can hard-delete), and must NEVER assert "there are
  // only two roles" or "no permission matrix exists".
  it.todo("[9] a staff token without applications:write cannot decide an application (backend refuses)");
  it.todo("[9] a soft-delete (deactivate) is allowed for an org admin; a hard-delete requires the super-admin tier");
  it.todo("[9] hiding a button in the shell is never the only guard — the module backend enforces the same rule");
});

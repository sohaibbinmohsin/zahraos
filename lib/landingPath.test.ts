import { describe, expect, it } from "vitest";
import { firstAllowedDestination, type LandingAccess } from "./landingPath";

const none: LandingAccess = {
  canAccessDashboard: false,
  canViewDrives: false,
  canViewApplications: false,
  canViewHours: false,
  canViewVolunteers: false,
  canViewOrganization: false,
  canViewInquiries: false,
  canManageTeam: false,
};

describe("firstAllowedDestination", () => {
  it("lands a Youth Republic user on the dashboard", () => {
    expect(firstAllowedDestination({ ...none, canAccessDashboard: true, canViewApplications: true })).toEqual({
      href: "/youth-republic/dashboard",
      label: "Dashboard",
    });
  });

  it("uses the first Youth Republic section when the dashboard itself is closed", () => {
    expect(firstAllowedDestination({ ...none, canViewDrives: true })).toEqual({
      href: "/youth-republic/drives",
      label: "Drives",
    });
  });

  it("lands an inquiries-only user on Partner Inquiries", () => {
    expect(firstAllowedDestination({ ...none, canViewInquiries: true })).toEqual({
      href: "/team/organization/inquiries",
      label: "Partner Inquiries",
    });
  });

  it("prefers Organization before later governance pages", () => {
    expect(
      firstAllowedDestination({ ...none, canViewOrganization: true, canViewInquiries: true, canManageTeam: true }),
    ).toEqual({ href: "/team/organization", label: "Organization" });
  });

  it("returns null when no page is allowed", () => {
    expect(firstAllowedDestination(none)).toBeNull();
  });
});

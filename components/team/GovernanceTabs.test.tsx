import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

let pathname = "/team/members";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

const permsMock = vi.fn();
const isAdminMock = vi.fn();
vi.mock("@/components/shell/useStaffPermissions", () => ({
  useStaffPermissions: () => permsMock(),
}));
vi.mock("@/components/shell/AppShell", () => ({
  useIsOrgAdminOrAbove: () => isAdminMock(),
}));

import { GovernanceTabs } from "./GovernanceTabs";

describe("GovernanceTabs", () => {
  beforeEach(() => {
    isAdminMock.mockReturnValue(true);
    permsMock.mockReturnValue({
      canViewOrganization: true,
      canManageTeam: true,
      canViewInquiries: true,
    });
  });

  it("renders every governance tab including Organization", () => {
    pathname = "/team/members";
    render(<GovernanceTabs />);
    expect(screen.getByRole("link", { name: /Organization/i })).toHaveAttribute("href", "/team/organization");
    expect(screen.getByRole("link", { name: /Partner Inquiries/i })).toHaveAttribute("href", "/team/organization/inquiries");
    expect(screen.getByRole("link", { name: /Team Members/i })).toHaveAttribute("href", "/team/members");
    expect(screen.getByRole("link", { name: /Roles & Permissions/i })).toHaveAttribute("href", "/team/roles");
    expect(screen.getByRole("link", { name: /Audit Log/i })).toHaveAttribute("href", "/team/audit");
    expect(screen.getByText("Data Controls")).toBeInTheDocument();
  });

  it("marks the Organization tab active on /team/organization and /organization", () => {
    pathname = "/team/organization";
    const { unmount } = render(<GovernanceTabs />);
    expect(screen.getByRole("link", { name: /Organization/i })).toHaveClass("active");
    expect(screen.getByRole("link", { name: /Team Members/i })).not.toHaveClass("active");
    unmount();

    pathname = "/organization";
    render(<GovernanceTabs />);
    expect(screen.getByRole("link", { name: /Organization/i })).toHaveClass("active");
  });

  it("shows only Partner Inquiries for inquiries-reader custom roles", () => {
    pathname = "/team/organization/inquiries";
    isAdminMock.mockReturnValue(false);
    permsMock.mockReturnValue({
      canViewOrganization: false,
      canManageTeam: false,
      canViewInquiries: true,
    });
    render(<GovernanceTabs />);
    expect(screen.getByRole("link", { name: /Partner Inquiries/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Organization/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Team Members/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Roles & Permissions/i })).not.toBeInTheDocument();
  });
});

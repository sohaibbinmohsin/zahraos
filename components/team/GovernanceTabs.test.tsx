import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

let pathname = "/team/members";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

import { GovernanceTabs } from "./GovernanceTabs";

describe("GovernanceTabs", () => {
  it("renders every governance tab including Organization", () => {
    pathname = "/team/members";
    render(<GovernanceTabs />);
    expect(screen.getByRole("link", { name: /Organization/i })).toHaveAttribute("href", "/organization");
    expect(screen.getByRole("link", { name: /Team Members/i })).toHaveAttribute("href", "/team/members");
    expect(screen.getByRole("link", { name: /Roles & Permissions/i })).toHaveAttribute("href", "/team/roles");
    expect(screen.getByRole("link", { name: /Audit Log/i })).toHaveAttribute("href", "/team/audit");
    expect(screen.getByText("Data Controls")).toBeInTheDocument();
  });

  it("marks the Organization tab active on /organization", () => {
    pathname = "/organization";
    render(<GovernanceTabs />);
    expect(screen.getByRole("link", { name: /Organization/i })).toHaveClass("active");
    expect(screen.getByRole("link", { name: /Team Members/i })).not.toHaveClass("active");
  });
});

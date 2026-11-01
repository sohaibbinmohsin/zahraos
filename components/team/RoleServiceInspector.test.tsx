import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { RoleServiceInspector } from "./RoleServiceInspector";
import {
  RESTRICTED_GRID,
  type CapabilityGrid,
} from "@/lib/capabilityMap";

describe("RoleServiceInspector", () => {
  const chapterLeadGrid: CapabilityGrid = {
    ...RESTRICTED_GRID,
    drive: "granted",
    publish: "granted",
    triage: "granted",
    hours: "granted",
    volunteers: "restricted",
    org_governance: "granted",
    members: "restricted",
    roles: "restricted",
    audit: "restricted",
    inquiries: "restricted",
    team: "restricted",
  };

  it("renders policy summary header with role name and governed modules", () => {
    render(<RoleServiceInspector grid={chapterLeadGrid} roleName="Chapter Lead" />);

    // Role name displayed in header
    expect(screen.getByText("Chapter Lead")).toBeInTheDocument();
    expect(screen.getByText(/IAM Service Policy/i)).toBeInTheDocument();
  });

  it("renders collapsible service module accordions with access badges and ratio counts", () => {
    render(<RoleServiceInspector grid={chapterLeadGrid} roleName="Chapter Lead" />);

    // Service module accordions exist
    expect(screen.getByText("Youth Republic")).toBeInTheDocument();
    expect(screen.getByText("Team & Governance")).toBeInTheDocument();

    // Module descriptions
    expect(
      screen.getByText(/Volunteer drives, public noticeboard, applicant screening/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Chapter governance, team roster, roles configuration/i),
    ).toBeInTheDocument();

    // Youth Republic should have Full Access badge and ratio count
    const fullAccessBadge = screen.getByText("Full Access");
    expect(fullAccessBadge).toBeInTheDocument();
    expect(fullAccessBadge).toHaveClass("badge", "badge-pos");
    expect(screen.getByText("4 Granted · 1 Restricted")).toBeInTheDocument();

    // Team & Governance should have Limited badge and ratio count
    const limitedBadge = screen.getByText("Limited");
    expect(limitedBadge).toBeInTheDocument();
    expect(limitedBadge).toHaveClass("badge", "badge-warn");
    expect(screen.getByText("1 Granted · 4 Restricted")).toBeInTheDocument();
  });

  it("toggles capability items when clicking a service accordion", async () => {
    const user = userEvent.setup();
    render(<RoleServiceInspector grid={chapterLeadGrid} roleName="Chapter Lead" />);

    // Capabilities should not be visible initially
    expect(screen.queryByText("Drive Creation")).not.toBeInTheDocument();
    expect(screen.queryByText("Volunteer Directory")).not.toBeInTheDocument();

    // Find and click the Youth Republic accordion header button
    const yrButton = screen.getByRole("button", { name: /Youth Republic/i });
    await user.click(yrButton);

    // Capabilities should now be visible
    expect(screen.getByText("Drive Creation")).toBeInTheDocument();
    expect(screen.getByText("Publish Noticeboard")).toBeInTheDocument();
    expect(screen.getByText("Triage Apps")).toBeInTheDocument();
    expect(screen.getByText("Approve Hours")).toBeInTheDocument();
    expect(screen.getByText("Volunteer Directory")).toBeInTheDocument();

    // Click again to toggle closed
    await user.click(yrButton);
    expect(screen.queryByText("Drive Creation")).not.toBeInTheDocument();
  });

  it("renders correct level badges for individual capabilities", async () => {
    const user = userEvent.setup();
    render(<RoleServiceInspector grid={chapterLeadGrid} roleName="Chapter Lead" />);

    // Open Youth Republic accordion
    const yrButton = screen.getByRole("button", { name: /Youth Republic/i });
    await user.click(yrButton);

    // Locate Drive Creation capability row and verify Granted badge
    const driveRow = screen.getByText("Drive Creation").closest("div[data-capability]")!;
    expect(driveRow).toBeInTheDocument();
    const driveBadge = driveRow.querySelector(".badge");
    expect(driveBadge).toHaveTextContent("Granted");
    expect(driveBadge).toHaveClass("badge", "badge-pos");

    // Locate Volunteer Directory capability row and verify Restricted badge
    const volRow = screen.getByText("Volunteer Directory").closest("div[data-capability]")!;
    expect(volRow).toBeInTheDocument();
    const volBadge = volRow.querySelector(".badge");
    expect(volBadge).toHaveTextContent("Restricted");
    expect(volBadge).toHaveClass("badge", "badge-neg");
  });

  it("renders Read Only badge for Auditor role", () => {
    const auditorGrid: CapabilityGrid = {
      ...RESTRICTED_GRID,
      triage: "read_only",
      hours: "read_only",
      volunteers: "read_only",
      audit: "read_only",
    };

    render(<RoleServiceInspector grid={auditorGrid} roleName="Auditor" />);

    const readOnlyBadges = screen.getAllByText("Read Only");
    expect(readOnlyBadges.length).toBeGreaterThan(0);
    expect(readOnlyBadges[0]).toHaveClass("badge", "badge-neu");
  });

  it("renders Restricted badge for fully restricted role", () => {
    render(<RoleServiceInspector grid={RESTRICTED_GRID} roleName="Guest" />);

    const restrictedBadges = screen.getAllByText("Restricted");
    expect(restrictedBadges.length).toBeGreaterThan(0);
    expect(restrictedBadges[0]).toHaveClass("badge", "badge-neg");
  });

  it("accepts readOnly prop gracefully", () => {
    render(<RoleServiceInspector grid={chapterLeadGrid} roleName="Chapter Lead" readOnly={true} />);
    expect(screen.getByText("Chapter Lead")).toBeInTheDocument();
  });
});

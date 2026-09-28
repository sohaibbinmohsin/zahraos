import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { RolesTable } from "./RolesTable";
import type { TeamRole } from "./TeamAccessProvider";

const roles: TeamRole[] = [
  { id: "r1", name: "Super Admin", description: "Full control", isSystem: true,
    permissionKeys: ["opportunities:write", "noticeboard:write", "applications:update", "applications:read", "hours:update", "hours:read", "team:write"] },
  { id: "r2", name: "Regional Logistics Lead", description: "Logistics", isSystem: false,
    permissionKeys: ["opportunities:write", "hours:update", "hours:read"] },
];
const counts = new Map([["r1", 1], ["r2", 0]]);

describe("RolesTable", () => {
  it("shows SYSTEM/CUSTOM badges and per-capability Granted/Restricted cells", () => {
    render(<RolesTable roles={roles} assignmentCountByRoleId={counts} onView={vi.fn()} onEdit={vi.fn()} onClone={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText("SYSTEM")).toBeInTheDocument();
    expect(screen.getByText("CUSTOM")).toBeInTheDocument();
    // Super Admin row: Team Management = Granted
    const superRow = screen.getByText("Super Admin").closest("tr")!;
    expect(superRow).toHaveTextContent("Granted");
    // Regional Logistics Lead row: Publish Noticeboard = Restricted
    const logisticsRow = screen.getByText("Regional Logistics Lead").closest("tr")!;
    expect(logisticsRow).toHaveTextContent("Restricted");
  });

  it("system rows expose View + Clone; custom rows expose Edit + Clone + Delete", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(<RolesTable roles={roles} assignmentCountByRoleId={counts} onView={vi.fn()} onEdit={onEdit} onClone={vi.fn()} onDelete={onDelete} />);
    const logisticsRow = screen.getByText("Regional Logistics Lead").closest("tr")!;
    await user.click(within(logisticsRow).getByRole("button", { name: "Edit" }));
    expect(onEdit).toHaveBeenCalledWith("r2");
  });

  it("renders grouped multi-level column headers for Youth Republic and Team & Governance", () => {
    render(<RolesTable roles={roles} assignmentCountByRoleId={counts} onView={vi.fn()} onEdit={vi.fn()} onClone={vi.fn()} onDelete={vi.fn()} />);

    // Header row 1 module grouping
    const yrHeader = screen.getByRole("columnheader", { name: "Youth Republic" });
    expect(yrHeader).toBeInTheDocument();
    expect(yrHeader).toHaveAttribute("colspan", "5");

    const teamGovHeader = screen.getByRole("columnheader", { name: "Team & Governance" });
    expect(teamGovHeader).toBeInTheDocument();
    expect(teamGovHeader).toHaveAttribute("colspan", "5");

    // Header row 2 specific capabilities
    // Youth Republic capabilities
    expect(screen.getByRole("columnheader", { name: "Drive Creation" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Publish Noticeboard" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Triage Apps" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Approve Hours" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Volunteer Directory" })).toBeInTheDocument();

    // Team & Governance capabilities
    expect(screen.getByRole("columnheader", { name: "Org Governance" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Team Members" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Roles & Permissions" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Audit Logs" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Partner Inquiries" })).toBeInTheDocument();
  });
});

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { RolesTable } from "./RolesTable";
import type { TeamRole } from "./TeamAccessProvider";

const roles: TeamRole[] = [
  {
    id: "r1",
    name: "Super Admin",
    description: "Full control across platform",
    isSystem: true,
    permissionKeys: [
      "opportunities:write",
      "noticeboard:write",
      "applications:update",
      "applications:read",
      "hours:update",
      "hours:read",
      "team:write",
    ],
  },
  {
    id: "r2",
    name: "Regional Logistics Lead",
    description: "Logistics and shift hours coordinator",
    isSystem: false,
    permissionKeys: ["opportunities:write", "hours:update", "hours:read"],
  },
];
const counts = new Map([["r1", 1], ["r2", 0]]);

describe("RolesTable", () => {
  it("renders 5 fixed headers instead of horizontal capability columns", () => {
    render(
      <RolesTable
        roles={roles}
        assignmentCountByRoleId={counts}
        onView={vi.fn()}
        onEdit={vi.fn()}
        onClone={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    // 5 fixed IAM headers (plus expand column)
    expect(screen.getByRole("columnheader", { name: "Expand" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Role Title & Type" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Description" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Governed Modules" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Active Staff" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Actions" })).toBeInTheDocument();

    // Previous multi-column spreadsheet capability headers must NOT exist
    expect(screen.queryByRole("columnheader", { name: "Drive Creation" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Publish Noticeboard" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Triage Apps" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Approve Hours" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Volunteer Directory" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Org Governance" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Team Members" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Roles & Permissions" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Audit Logs" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Partner Inquiries" })).not.toBeInTheDocument();
  });

  it("shows SYSTEM/CUSTOM badges and module access pills in Governed Modules column", () => {
    render(
      <RolesTable
        roles={roles}
        assignmentCountByRoleId={counts}
        onView={vi.fn()}
        onEdit={vi.fn()}
        onClone={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText("SYSTEM")).toBeInTheDocument();
    expect(screen.getByText("CUSTOM")).toBeInTheDocument();

    // Super Admin row: Full Access in Youth Republic, Limited in Team & Governance (only team:write)
    const superRow = screen.getByText("Super Admin").closest("tr")!;
    const superYRBadge = within(superRow).getByText(/Youth Republic.*Full Access/i);
    expect(superYRBadge).toHaveClass("badge", "badge-pos");
    const superTeamBadge = within(superRow).getByText(/Team & Governance.*Limited/i);
    expect(superTeamBadge).toHaveClass("badge", "badge-warn");

    // Regional Logistics Lead row: Limited in Youth Republic, Restricted in Team & Governance
    const logisticsRow = screen.getByText("Regional Logistics Lead").closest("tr")!;
    const logYRBadge = within(logisticsRow).getByText(/Youth Republic.*Limited/i);
    expect(logYRBadge).toHaveClass("badge", "badge-warn");
    const logTeamBadge = within(logisticsRow).getByText(/Team & Governance.*Restricted/i);
    expect(logTeamBadge).toHaveClass("badge", "badge-neg");
  });

  it("system rows expose View + Clone; custom rows expose Edit + Clone + Delete", async () => {
    const user = userEvent.setup();
    const onView = vi.fn();
    const onEdit = vi.fn();
    const onClone = vi.fn();
    const onDelete = vi.fn();

    render(
      <RolesTable
        roles={roles}
        assignmentCountByRoleId={counts}
        onView={onView}
        onEdit={onEdit}
        onClone={onClone}
        onDelete={onDelete}
      />,
    );

    // Super Admin: system role
    const superRow = screen.getByText("Super Admin").closest("tr")!;
    await user.click(within(superRow).getByRole("button", { name: "View" }));
    expect(onView).toHaveBeenCalledWith("r1");
    await user.click(within(superRow).getByRole("button", { name: "Clone" }));
    expect(onClone).toHaveBeenCalledWith("r1");
    expect(within(superRow).queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(within(superRow).queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();

    // Regional Logistics Lead: custom role
    const logisticsRow = screen.getByText("Regional Logistics Lead").closest("tr")!;
    await user.click(within(logisticsRow).getByRole("button", { name: "Edit" }));
    expect(onEdit).toHaveBeenCalledWith("r2");
    await user.click(within(logisticsRow).getByRole("button", { name: "Delete" }));
    expect(onDelete).toHaveBeenCalledWith("r2");
  });

  it("clicking a row or chevron expands and collapses RoleServiceInspector", async () => {
    const user = userEvent.setup();
    render(
      <RolesTable
        roles={roles}
        assignmentCountByRoleId={counts}
        onView={vi.fn()}
        onEdit={vi.fn()}
        onClone={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    // RoleServiceInspector is initially not visible
    expect(screen.queryByText("IAM Service Policy")).not.toBeInTheDocument();

    // Click Regional Logistics Lead row to expand
    const logisticsRow = screen.getByText("Regional Logistics Lead").closest("tr")!;
    await user.click(logisticsRow);

    // RoleServiceInspector should now be visible
    expect(screen.getByText("IAM Service Policy")).toBeInTheDocument();

    // Click the chevron button to collapse
    const collapseBtn = within(logisticsRow).getByRole("button", { name: /collapse/i });
    await user.click(collapseBtn);

    // RoleServiceInspector should no longer be visible
    expect(screen.queryByText("IAM Service Policy")).not.toBeInTheDocument();
  });

  it("Expand All / Collapse All toolbar button toggles all rows", async () => {
    const user = userEvent.setup();
    render(
      <RolesTable
        roles={roles}
        assignmentCountByRoleId={counts}
        onView={vi.fn()}
        onEdit={vi.fn()}
        onClone={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    const expandAllBtn = screen.getByRole("button", { name: "Expand All" });
    expect(expandAllBtn).toBeInTheDocument();

    // Click Expand All
    await user.click(expandAllBtn);

    // Both roles should have their RoleServiceInspector expanded
    const policyHeaders = screen.getAllByText("IAM Service Policy");
    expect(policyHeaders).toHaveLength(2);

    // Button text toggles to Collapse All
    const collapseAllBtn = screen.getByRole("button", { name: "Collapse All" });
    expect(collapseAllBtn).toBeInTheDocument();

    // Click Collapse All
    await user.click(collapseAllBtn);

    // All inspectors should be collapsed
    expect(screen.queryByText("IAM Service Policy")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Expand All" })).toBeInTheDocument();
  });

  it("filters roles by governed module access using module filter dropdown", async () => {
    const user = userEvent.setup();
    render(
      <RolesTable
        roles={roles}
        assignmentCountByRoleId={counts}
        onView={vi.fn()}
        onEdit={vi.fn()}
        onClone={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    // Initially both roles are present
    expect(screen.getByText("Super Admin")).toBeInTheDocument();
    expect(screen.getByText("Regional Logistics Lead")).toBeInTheDocument();

    // Open module filter dropdown
    const moduleSelect = screen.getByRole("combobox", { name: "Module filter" });
    await user.click(moduleSelect);

    // Select Team & Governance
    await user.click(screen.getByRole("option", { name: "Team & Governance" }));

    // Super Admin has Team & Governance access (Limited) -> visible
    expect(screen.getByText("Super Admin")).toBeInTheDocument();
    // Regional Logistics Lead is Restricted in Team & Governance -> hidden
    expect(screen.queryByText("Regional Logistics Lead")).not.toBeInTheDocument();

    // Switch back to All Modules
    await user.click(screen.getByRole("combobox", { name: "Module filter" }));
    await user.click(screen.getByRole("option", { name: "All Modules" }));

    // Both are visible again
    expect(screen.getByText("Super Admin")).toBeInTheDocument();
    expect(screen.getByText("Regional Logistics Lead")).toBeInTheDocument();
  });

  it("filters roles by search input matching role title, description, and governed module names", async () => {
    const user = userEvent.setup();
    render(
      <RolesTable
        roles={roles}
        assignmentCountByRoleId={counts}
        onView={vi.fn()}
        onEdit={vi.fn()}
        onClone={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    const searchInput = screen.getByPlaceholderText(/search/i);

    // Search by title
    await user.type(searchInput, "Logistics");
    expect(screen.queryByText("Super Admin")).not.toBeInTheDocument();
    expect(screen.getByText("Regional Logistics Lead")).toBeInTheDocument();

    // Clear search
    await user.clear(searchInput);
    expect(screen.getByText("Super Admin")).toBeInTheDocument();
    expect(screen.getByText("Regional Logistics Lead")).toBeInTheDocument();

    // Search by description
    await user.type(searchInput, "Full control");
    expect(screen.getByText("Super Admin")).toBeInTheDocument();
    expect(screen.queryByText("Regional Logistics Lead")).not.toBeInTheDocument();

    // Clear search
    await user.clear(searchInput);

    // Search by governed module name "Youth Republic"
    await user.type(searchInput, "Youth Republic");
    expect(screen.getByText("Super Admin")).toBeInTheDocument();
    expect(screen.getByText("Regional Logistics Lead")).toBeInTheDocument();

    // Clear search
    await user.clear(searchInput);

    // Search nonexistent term
    await user.type(searchInput, "Nonexistent Role");
    expect(screen.getByText(/no roles found/i)).toBeInTheDocument();
  });
});

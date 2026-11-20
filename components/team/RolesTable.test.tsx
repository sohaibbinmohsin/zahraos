import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { RolesTable } from "./RolesTable";
import type { TeamRole } from "./TeamAccessProvider";
import { mockModuleCatalogsFetch } from "./testCatalogFixtures";

vi.mock("@/components/team/TeamAccessProvider", () => ({
  useTeamAccess: () => ({ organizationId: "org-1", accessToken: "access-token" }),
}));

const roles: TeamRole[] = [
  {
    id: "r1",
    name: "Super Admin",
    description: "Full control across platform",
    isSystem: true,
    permissionKeys: [
      "opportunities:read",
      "opportunities:write",
      "opportunities:update",
      "noticeboard:read",
      "noticeboard:write",
      "applications:update",
      "applications:read",
      "hours:update",
      "hours:read",
      "volunteers:read",
      "chapters:read",
      "chapters:write",
      "members:read",
      "members:write",
      "team:write",
      "roles:read",
      "roles:write",
      "admin_action_log:read",
      "inquiries:read",
      "inquiries:write",
    ],
  },
  {
    id: "r2",
    name: "Regional Logistics Lead",
    description: "Logistics and shift hours coordinator",
    isSystem: false,
    permissionKeys: ["members:read", "members:write", "team:write"],
  },
];
const counts = new Map([["r1", 1], ["r2", 0]]);

describe("RolesTable", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockModuleCatalogsFetch());
  });

  async function waitForTable() {
    await waitFor(() => {
      expect(screen.getByText("Super Admin")).toBeInTheDocument();
    });
  }

  it("renders 5 fixed headers instead of horizontal capability columns", async () => {
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
    await waitForTable();

    // 5 fixed IAM headers
    expect(screen.getByRole("columnheader", { name: "Role Title & Type" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Description" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Governed Modules" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Active Staff" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Actions" })).toBeInTheDocument();

    // Expand header must NOT exist
    expect(screen.queryByRole("columnheader", { name: "Expand" })).not.toBeInTheDocument();

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

  it("shows SYSTEM/CUSTOM badges and module access pills in Governed Modules column", async () => {
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
    await waitForTable();

    expect(screen.getByText("SYSTEM")).toBeInTheDocument();
    expect(screen.getByText("CUSTOM")).toBeInTheDocument();

    const superRow = screen.getByText("Super Admin").closest("tr")!;
    expect(within(superRow).getByText(/Youth Republic:/i)).toBeInTheDocument();
    expect(within(superRow).getByText(/Team & Governance:/i)).toBeInTheDocument();

    const logisticsRow = screen.getByText("Regional Logistics Lead").closest("tr")!;
    expect(within(logisticsRow).getByText(/Youth Republic:/i)).toBeInTheDocument();
    expect(within(logisticsRow).getByText(/Team & Governance:/i)).toBeInTheDocument();
  });

  it("system rows expose View + Clone; custom rows expose View + Edit + Clone + Delete", async () => {
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
    await waitForTable();

    // Super Admin: system role
    const superRow = screen.getByText("Super Admin").closest("tr")!;
    await user.click(within(superRow).getByRole("button", { name: "View" }));
    expect(onView).toHaveBeenCalledWith("r1");
    await user.click(within(superRow).getByRole("button", { name: "Clone" }));
    expect(onClone).toHaveBeenCalledWith("r1");
    expect(within(superRow).queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(within(superRow).queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();

    // Regional Logistics Lead: custom role has View, Edit, Clone, Delete
    const logisticsRow = screen.getByText("Regional Logistics Lead").closest("tr")!;
    await user.click(within(logisticsRow).getByRole("button", { name: "View" }));
    expect(onView).toHaveBeenCalledWith("r2");
    await user.click(within(logisticsRow).getByRole("button", { name: "Edit" }));
    expect(onEdit).toHaveBeenCalledWith("r2");
    await user.click(within(logisticsRow).getByRole("button", { name: "Delete" }));
    expect(onDelete).toHaveBeenCalledWith("r2");
  });

  it("does not render dropdown card or expandable rows", async () => {
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
    await waitForTable();

    // Expand chevrons or dropdown cards must NOT exist
    expect(screen.queryByText("IAM Service Policy")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /expand/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /collapse/i })).not.toBeInTheDocument();
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
    await waitForTable();

    // Initially both roles are present
    expect(screen.getByText("Super Admin")).toBeInTheDocument();
    expect(screen.getByText("Regional Logistics Lead")).toBeInTheDocument();

    // Open module filter dropdown
    const moduleSelect = screen.getByRole("combobox", { name: "Module filter" });
    await user.click(moduleSelect);

    await user.click(screen.getByRole("option", { name: "Youth Republic" }));

    expect(screen.getByText("Super Admin")).toBeInTheDocument();
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
    await waitForTable();

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
    expect(screen.queryByText("Regional Logistics Lead")).not.toBeInTheDocument();

    // Clear search
    await user.clear(searchInput);

    // Search nonexistent term
    await user.type(searchInput, "Nonexistent Role");
    expect(screen.getByText(/no roles found/i)).toBeInTheDocument();
  });

  it("renders only View button when canManageRoles is false", async () => {
    render(
      <RolesTable
        roles={roles}
        assignmentCountByRoleId={counts}
        canManageRoles={false}
        onView={vi.fn()}
        onEdit={vi.fn()}
        onClone={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    await waitForTable();

    // View button should be present
    expect(screen.getAllByRole("button", { name: "View" })).toHaveLength(2);
    // Edit, Clone, Delete buttons should NOT be present
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clone" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  });
});

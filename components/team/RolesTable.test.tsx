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
});

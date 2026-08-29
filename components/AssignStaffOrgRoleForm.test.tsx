import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AssignStaffOrgRoleForm } from "./AssignStaffOrgRoleForm";
import * as platformFunctions from "@/lib/platformFunctions";

vi.mock("@/lib/platformFunctions");

describe("AssignStaffOrgRoleForm", () => {
  beforeEach(() => {
    vi.mocked(platformFunctions.assignStaffOrgRole).mockReset();
  });

  it("submits the selected staff member and org role, defaulting to admin", async () => {
    vi.mocked(platformFunctions.assignStaffOrgRole).mockResolvedValue({ staffId: "s3" });
    const onAssigned = vi.fn();
    const user = userEvent.setup();

    render(
      <AssignStaffOrgRoleForm
        organizationId="org-1"
        staffOptions={[{ id: "s3", fullName: "Target Staff" }]}
        accessToken="session-token"
        onAssigned={onAssigned}
      />,
    );

    await user.selectOptions(screen.getByLabelText("Staff member"), "s3");
    await user.click(screen.getByRole("button", { name: "Assign org role" }));

    await waitFor(() => {
      expect(platformFunctions.assignStaffOrgRole).toHaveBeenCalledWith(
        { staffId: "s3", organizationId: "org-1", orgTier: "admin" },
        "session-token",
      );
      expect(onAssigned).toHaveBeenCalled();
    });
  });

  it("submits super_admin when that role is selected", async () => {
    vi.mocked(platformFunctions.assignStaffOrgRole).mockResolvedValue({ staffId: "s3" });
    const onAssigned = vi.fn();
    const user = userEvent.setup();

    render(
      <AssignStaffOrgRoleForm
        organizationId="org-1"
        staffOptions={[{ id: "s3", fullName: "Target Staff" }]}
        accessToken="session-token"
        onAssigned={onAssigned}
      />,
    );

    await user.selectOptions(screen.getByLabelText("Org role"), "super_admin");
    await user.click(screen.getByRole("button", { name: "Assign org role" }));

    await waitFor(() => {
      expect(platformFunctions.assignStaffOrgRole).toHaveBeenCalledWith(
        { staffId: "s3", organizationId: "org-1", orgTier: "super_admin" },
        "session-token",
      );
    });
  });
});

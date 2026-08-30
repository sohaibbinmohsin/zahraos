import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AssignStaffModuleRoleForm } from "./AssignStaffModuleRoleForm";
import * as platformFunctions from "@/lib/platformFunctions";

vi.mock("@/lib/platformFunctions");

describe("AssignStaffModuleRoleForm", () => {
  beforeEach(() => {
    vi.mocked(platformFunctions.assignStaffModuleRole).mockReset();
  });

  it("submits the selected staff, module, and role", async () => {
    vi.mocked(platformFunctions.assignStaffModuleRole).mockResolvedValue({ staffId: "s2" });
    const onAssigned = vi.fn();
    const user = userEvent.setup();

    render(
      <AssignStaffModuleRoleForm
        organizationId="org-1"
        staffOptions={[{ id: "s2", fullName: "Target Staff" }]}
        moduleOptions={[{ id: "mod-youth-republic", key: "youth-republic" }]}
        roleOptionsByModuleId={{ "mod-youth-republic": [{ id: "role-editor", name: "Editor" }] }}
        accessToken="session-token"
        onAssigned={onAssigned}
      />,
    );

    await user.selectOptions(screen.getByLabelText("Staff member"), "s2");
    await user.selectOptions(screen.getByLabelText("Module"), "mod-youth-republic");
    await user.selectOptions(screen.getByLabelText("Role"), "role-editor");
    await user.click(screen.getByRole("button", { name: "Assign role" }));

    await waitFor(() => {
      expect(platformFunctions.assignStaffModuleRole).toHaveBeenCalledWith(
        { staffId: "s2", organizationId: "org-1", moduleId: "mod-youth-republic", roleId: "role-editor" },
        "session-token",
      );
      expect(onAssigned).toHaveBeenCalled();
    });
  });
});

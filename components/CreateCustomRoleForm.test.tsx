import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CreateCustomRoleForm } from "./CreateCustomRoleForm";
import * as platformFunctions from "@/lib/platformFunctions";

vi.mock("@/lib/platformFunctions");

describe("CreateCustomRoleForm", () => {
  beforeEach(() => {
    vi.mocked(platformFunctions.createCustomRole).mockReset();
  });

  it("submits the selected module, name, and checked permissions", async () => {
    vi.mocked(platformFunctions.createCustomRole).mockResolvedValue({ roleId: "role-1" });
    const onCreated = vi.fn();
    const user = userEvent.setup();

    render(
      <CreateCustomRoleForm
        organizationId="org-1"
        modules={[{ id: "mod-vms", key: "vms" }]}
        permissionsByModuleId={{ "mod-vms": [{ id: "perm-1", resource: "hours", action: "update" }] }}
        accessToken="session-token"
        onCreated={onCreated}
      />,
    );

    await user.selectOptions(screen.getByLabelText("Module"), "mod-vms");
    await user.type(screen.getByLabelText("Role name"), "Hours Verifier");
    await user.click(screen.getByLabelText("hours:update"));
    await user.click(screen.getByRole("button", { name: "Create role" }));

    await waitFor(() => {
      expect(platformFunctions.createCustomRole).toHaveBeenCalledWith(
        { organizationId: "org-1", moduleId: "mod-vms", name: "Hours Verifier", permissionIds: ["perm-1"] },
        "session-token",
      );
      expect(onCreated).toHaveBeenCalled();
    });
  });
});

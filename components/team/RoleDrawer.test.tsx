import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

const createRole = vi.fn().mockResolvedValue({ roleId: "new" });
const updateRole = vi.fn().mockResolvedValue({ roleId: "r2" });
const refresh = vi.fn();
const showToast = vi.fn();
vi.mock("@/lib/platformFunctions", () => ({
  createCustomRole: (...a: unknown[]) => createRole(...a),
  updateCustomRole: (...a: unknown[]) => updateRole(...a),
}));
vi.mock("@/components/shell/ToastContext", () => ({ useToast: () => ({ showToast }) }));
vi.mock("@/components/team/TeamAccessProvider", () => ({
  useTeamAccess: () => ({
    organizationId: "org-1", accessToken: "access-token", moduleId: "mod-1", refresh,
    roles: [
      { id: "r1", name: "Operations Lead", isSystem: true, description: "sys",
        permissionKeys: ["opportunities:write", "noticeboard:write", "applications:update", "applications:read", "hours:update", "hours:read"] },
      { id: "r2", name: "Regional Logistics Lead", isSystem: false, description: "cust",
        permissionKeys: ["opportunities:write", "hours:update", "hours:read"] },
    ],
  }),
}));

import { RoleDrawer } from "./RoleDrawer";

describe("RoleDrawer", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a custom role from the capability selects", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<RoleDrawer request={{ mode: "create", roleId: null }} onClose={onClose} />);
    await user.type(screen.getByLabelText(/Role Title/i), "Warehouse Lead");
    await user.selectOptions(screen.getByLabelText("Drive Creation"), "granted");
    await user.selectOptions(screen.getByLabelText("Approve Hours"), "read_only");
    await user.click(screen.getByRole("button", { name: /Save Role/i }));

    await waitFor(() => expect(createRole).toHaveBeenCalledTimes(1));
    const [payload] = createRole.mock.calls[0];
    expect(payload).toMatchObject({ organizationId: "org-1", moduleId: "mod-1", name: "Warehouse Lead" });
    expect(payload.capabilities).toMatchObject({ drive: "granted", hours: "read_only" });
    expect(onClose).toHaveBeenCalled();
  });

  it("opens a system role read-only with no save", () => {
    render(<RoleDrawer request={{ mode: "view", roleId: "r1" }} onClose={vi.fn()} />);
    expect(screen.getByLabelText("Drive Creation")).toBeDisabled();
    expect(screen.queryByRole("button", { name: /Save Role/i })).not.toBeInTheDocument();
  });

  it("prefills a clone from the source role with an editable name", () => {
    render(<RoleDrawer request={{ mode: "clone", roleId: "r2" }} onClose={vi.fn()} />);
    expect((screen.getByLabelText(/Role Title/i) as HTMLInputElement).value).toBe("Regional Logistics Lead (Copy)");
    expect((screen.getByLabelText("Drive Creation") as HTMLSelectElement).value).toBe("granted");
  });

  it("edits a custom role", async () => {
    const user = userEvent.setup();
    render(<RoleDrawer request={{ mode: "edit", roleId: "r2" }} onClose={vi.fn()} />);
    await user.selectOptions(screen.getByLabelText("Publish Noticeboard"), "granted");
    await user.click(screen.getByRole("button", { name: /Save Role/i }));
    await waitFor(() => expect(updateRole).toHaveBeenCalledTimes(1));
    expect(updateRole.mock.calls[0][0]).toMatchObject({ roleId: "r2" });
    expect(updateRole.mock.calls[0][0].capabilities.publish).toBe("granted");
  });
});

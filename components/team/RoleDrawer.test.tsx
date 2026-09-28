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
    await user.click(screen.getByRole("combobox", { name: "Drive Creation" }));
    await user.click(screen.getByRole("option", { name: "Granted" }));
    await user.click(screen.getByRole("combobox", { name: "Approve Hours" }));
    await user.click(screen.getByRole("option", { name: "Read Only" }));
    await user.click(screen.getByRole("button", { name: /Save Role/i }));

    await waitFor(() => expect(createRole).toHaveBeenCalledTimes(1));
    const [payload] = createRole.mock.calls[0];
    expect(payload).toMatchObject({ organizationId: "org-1", moduleId: "mod-1", name: "Warehouse Lead" });
    expect(payload.capabilities).toMatchObject({ drive: "granted", hours: "read_only" });
    expect(onClose).toHaveBeenCalled();
  });

  it("opens a system role read-only with no save", () => {
    render(<RoleDrawer request={{ mode: "view", roleId: "r1" }} onClose={vi.fn()} />);
    expect(screen.getByRole("combobox", { name: "Drive Creation" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: /Save Role/i })).not.toBeInTheDocument();
  });

  it("prefills a clone from the source role with an editable name", () => {
    render(<RoleDrawer request={{ mode: "clone", roleId: "r2" }} onClose={vi.fn()} />);
    expect((screen.getByLabelText(/Role Title/i) as HTMLInputElement).value).toBe("Regional Logistics Lead (Copy)");
    expect(screen.getByRole("combobox", { name: "Drive Creation" })).toHaveTextContent("Granted");
  });

  it("edits a custom role", async () => {
    const user = userEvent.setup();
    render(<RoleDrawer request={{ mode: "edit", roleId: "r2" }} onClose={vi.fn()} />);
    await user.click(screen.getByRole("combobox", { name: "Publish Noticeboard" }));
    await user.click(screen.getByRole("option", { name: "Granted" }));
    await user.click(screen.getByRole("button", { name: /Save Role/i }));
    await waitFor(() => expect(updateRole).toHaveBeenCalledTimes(1));
    expect(updateRole.mock.calls[0][0]).toMatchObject({ roleId: "r2" });
    expect(updateRole.mock.calls[0][0].capabilities.publish).toBe("granted");
  });

  it("applies a system template to update capability grid", async () => {
    const user = userEvent.setup();
    render(<RoleDrawer request={{ mode: "create", roleId: null }} onClose={vi.fn()} />);
    await user.click(screen.getByRole("combobox", { name: "Base Permission Template" }));
    await user.click(screen.getByRole("option", { name: "Clone from Operations Lead" }));
    expect(screen.getByRole("combobox", { name: "Approve Hours" })).toHaveTextContent("Granted");
  });

  it("applies the Org Admin template with full capabilities across all modules", async () => {
    const user = userEvent.setup();
    render(<RoleDrawer request={{ mode: "create", roleId: null }} onClose={vi.fn()} />);
    await user.click(screen.getByRole("combobox", { name: "Base Permission Template" }));
    await user.click(screen.getByRole("option", { name: "Clone from Org Admin" }));

    expect(screen.getByRole("combobox", { name: "Drive Creation" })).toHaveTextContent("Granted");
    expect(screen.getByRole("combobox", { name: "Publish Noticeboard" })).toHaveTextContent("Granted");
    expect(screen.getByRole("combobox", { name: "Triage Apps" })).toHaveTextContent("Granted");
    expect(screen.getByRole("combobox", { name: "Approve Hours" })).toHaveTextContent("Granted");
    expect(screen.getByRole("combobox", { name: "Team Members" })).toHaveTextContent("Granted");
    expect(screen.getByRole("combobox", { name: "Roles & Permissions" })).toHaveTextContent("Granted");
    expect(screen.getByRole("combobox", { name: "Partner Inquiries" })).toHaveTextContent("Granted");
  });

  it("opens the Org Admin role in view mode as a protected system specification", () => {
    render(<RoleDrawer request={{ mode: "view", roleId: "Org Admin" }} onClose={vi.fn()} />);
    expect(screen.getByText("System Role Specification")).toBeInTheDocument();
    expect((screen.getByLabelText(/Role Title/i) as HTMLInputElement).value).toBe("Org Admin");
    expect(screen.getByRole("combobox", { name: "Drive Creation" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Publish Noticeboard" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Triage Apps" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Approve Hours" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Team Members" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Partner Inquiries" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: /Save Role/i })).not.toBeInTheDocument();
  });

  it("organizes capabilities into Youth Republic Operations and Team & Governance sections", () => {
    render(<RoleDrawer request={{ mode: "create", roleId: null }} onClose={vi.fn()} />);
    expect(screen.getByText("Youth Republic Operations")).toBeInTheDocument();
    expect(screen.getByText("Team & Governance")).toBeInTheDocument();
  });

  it("restricts Partner Inquiries to Super Admin and National Org Admin templates", async () => {
    const user = userEvent.setup();
    render(<RoleDrawer request={{ mode: "create", roleId: null }} onClose={vi.fn()} />);

    // 1. Super Admin template grants Partner Inquiries
    await user.click(screen.getByRole("combobox", { name: "Base Permission Template" }));
    await user.click(screen.getByRole("option", { name: "Clone from Super Admin" }));
    expect(screen.getByRole("combobox", { name: "Partner Inquiries" })).toHaveTextContent("Granted");

    // 2. Operations Lead template restricts Partner Inquiries
    await user.click(screen.getByRole("combobox", { name: "Base Permission Template" }));
    await user.click(screen.getByRole("option", { name: "Clone from Operations Lead" }));
    expect(screen.getByRole("combobox", { name: "Partner Inquiries" })).toHaveTextContent("Restricted");

    // 3. Chapter Admin template restricts Partner Inquiries
    await user.click(screen.getByRole("combobox", { name: "Base Permission Template" }));
    await user.click(screen.getByRole("option", { name: "Clone from Chapter Admin" }));
    expect(screen.getByRole("combobox", { name: "Partner Inquiries" })).toHaveTextContent("Restricted");

    // 4. Org Admin template grants Partner Inquiries
    await user.click(screen.getByRole("combobox", { name: "Base Permission Template" }));
    await user.click(screen.getByRole("option", { name: "Clone from Org Admin" }));
    expect(screen.getByRole("combobox", { name: "Partner Inquiries" })).toHaveTextContent("Granted");
  });
});

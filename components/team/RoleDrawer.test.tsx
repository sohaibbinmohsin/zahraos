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

  it("opens a system role read-only with no save and collapsed cards", async () => {
    const user = userEvent.setup();
    render(<RoleDrawer request={{ mode: "view", roleId: "r1" }} onClose={vi.fn()} />);
    // Service cards start collapsed in view modal
    expect(screen.queryByTestId("cap-badge-drive")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Save Role/i })).not.toBeInTheDocument();

    // Toggle Youth Republic card open
    await user.click(screen.getByRole("button", { name: /Toggle Youth Republic/i }));
    expect(screen.getByTestId("cap-badge-drive")).toHaveTextContent("Granted");
    expect(screen.getByTestId("cap-badge-drive")).toHaveClass("badge", "badge-pos");
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

  it("opens the Org Admin role in view mode as a protected system specification", async () => {
    const user = userEvent.setup();
    render(<RoleDrawer request={{ mode: "view", roleId: "Org Admin" }} onClose={vi.fn()} />);
    expect(screen.getByText("System Role Specification")).toBeInTheDocument();
    expect((screen.getByLabelText(/Role Title/i) as HTMLInputElement).value).toBe("Org Admin");
    expect(screen.queryByRole("button", { name: /Save Role/i })).not.toBeInTheDocument();

    // Toggle Youth Republic card open
    await user.click(screen.getByRole("button", { name: /Toggle Youth Republic/i }));
    expect(screen.getByTestId("cap-badge-drive")).toHaveTextContent("Granted");
    expect(screen.getByTestId("cap-badge-drive")).toHaveClass("badge", "badge-pos");
  });

  it("organizes capabilities into Youth Republic and Team & Governance service accordions", () => {
    render(<RoleDrawer request={{ mode: "create", roleId: null }} onClose={vi.fn()} />);
    expect(screen.getByText("Youth Republic")).toBeInTheDocument();
    expect(screen.getByText("Team & Governance")).toBeInTheDocument();
  });

  it("renders service accordions with descriptions and collapse toggle", async () => {
    const user = userEvent.setup();
    render(<RoleDrawer request={{ mode: "create", roleId: null }} onClose={vi.fn()} />);

    expect(screen.getByText("Youth Republic")).toBeInTheDocument();
    expect(
      screen.getByText("Volunteer drives, public noticeboard, applicant screening, and shift hours logging."),
    ).toBeInTheDocument();
    expect(screen.getByText("Team & Governance")).toBeInTheDocument();
    expect(
      screen.getByText("Chapter governance, team roster, roles configuration, partner inquiries, and audit logs."),
    ).toBeInTheDocument();

    // Accordions are expanded by default
    expect(screen.getByRole("combobox", { name: "Drive Creation" })).toBeInTheDocument();

    // Collapse Youth Republic
    const collapseButton = screen.getByRole("button", { name: /Toggle Youth Republic/i });
    await user.click(collapseButton);

    expect(screen.queryByRole("combobox", { name: "Drive Creation" })).not.toBeInTheDocument();

    // Re-expand Youth Republic
    await user.click(collapseButton);
    expect(screen.getByRole("combobox", { name: "Drive Creation" })).toBeInTheDocument();
  });

  it("service-level presets toggle all actions in that service simultaneously and update badge", async () => {
    const user = userEvent.setup();
    render(<RoleDrawer request={{ mode: "create", roleId: null }} onClose={vi.fn()} />);

    const yrFullBtn = screen.getByRole("button", { name: /Youth Republic: Full Access/i });
    const yrReadOnlyBtn = screen.getByRole("button", { name: /Youth Republic: Read Only/i });
    const yrRestrictedBtn = screen.getByRole("button", { name: /Youth Republic: Restricted/i });

    // Click Full Access on Youth Republic
    await user.click(yrFullBtn);
    expect(screen.getByRole("combobox", { name: "Drive Creation" })).toHaveTextContent("Granted");
    expect(screen.getByRole("combobox", { name: "Publish Noticeboard" })).toHaveTextContent("Granted");
    expect(screen.getByRole("combobox", { name: "Triage Apps" })).toHaveTextContent("Granted");
    expect(screen.getByRole("combobox", { name: "Approve Hours" })).toHaveTextContent("Granted");
    expect(screen.getByRole("combobox", { name: "Volunteer Directory" })).toHaveTextContent("Read Only");
    expect(screen.getByTestId("service-badge-youth-republic")).toHaveTextContent("Full Access");

    // Click Read Only on Youth Republic
    await user.click(yrReadOnlyBtn);
    expect(screen.getByRole("combobox", { name: "Drive Creation" })).toHaveTextContent("Read Only");
    expect(screen.getByRole("combobox", { name: "Publish Noticeboard" })).toHaveTextContent("Read Only");
    expect(screen.getByRole("combobox", { name: "Triage Apps" })).toHaveTextContent("Read Only");
    expect(screen.getByRole("combobox", { name: "Approve Hours" })).toHaveTextContent("Read Only");
    expect(screen.getByRole("combobox", { name: "Volunteer Directory" })).toHaveTextContent("Read Only");
    expect(screen.getByTestId("service-badge-youth-republic")).toHaveTextContent("Read Only");

    // Click Restricted on Youth Republic
    await user.click(yrRestrictedBtn);
    expect(screen.getByRole("combobox", { name: "Drive Creation" })).toHaveTextContent("Restricted");
    expect(screen.getByRole("combobox", { name: "Publish Noticeboard" })).toHaveTextContent("Restricted");
    expect(screen.getByRole("combobox", { name: "Triage Apps" })).toHaveTextContent("Restricted");
    expect(screen.getByRole("combobox", { name: "Approve Hours" })).toHaveTextContent("Restricted");
    expect(screen.getByRole("combobox", { name: "Volunteer Directory" })).toHaveTextContent("Restricted");
    expect(screen.getByTestId("service-badge-youth-republic")).toHaveTextContent("Restricted");

    // Set one capability manually to make it Limited (not Custom)
    await user.click(screen.getByRole("combobox", { name: "Drive Creation" }));
    await user.click(screen.getByRole("option", { name: "Granted" }));
    expect(screen.getByTestId("service-badge-youth-republic")).toHaveTextContent("Limited");
    expect(screen.getByTestId("service-badge-youth-republic")).toHaveClass("badge", "badge-warn");

    // Team & Governance presets
    const tgFullBtn = screen.getByRole("button", { name: /Team & Governance: Full Access/i });
    const tgRestrictedBtn = screen.getByRole("button", { name: /Team & Governance: Restricted/i });

    await user.click(tgFullBtn);
    expect(screen.getByRole("combobox", { name: "Org Governance" })).toHaveTextContent("Granted");
    expect(screen.getByRole("combobox", { name: "Team Members" })).toHaveTextContent("Granted");
    expect(screen.getByRole("combobox", { name: "Roles & Permissions" })).toHaveTextContent("Granted");
    expect(screen.getByRole("combobox", { name: "Audit Logs" })).toHaveTextContent("Read Only");
    expect(screen.getByRole("combobox", { name: "Partner Inquiries" })).toHaveTextContent("Granted");
    expect(screen.getByTestId("service-badge-team-governance")).toHaveTextContent("Full Access");

    await user.click(tgRestrictedBtn);
    expect(screen.getByRole("combobox", { name: "Org Governance" })).toHaveTextContent("Restricted");
    expect(screen.getByRole("combobox", { name: "Team Members" })).toHaveTextContent("Restricted");
    expect(screen.getByRole("combobox", { name: "Roles & Permissions" })).toHaveTextContent("Restricted");
    expect(screen.getByRole("combobox", { name: "Audit Logs" })).toHaveTextContent("Restricted");
    expect(screen.getByRole("combobox", { name: "Partner Inquiries" })).toHaveTextContent("Restricted");
    expect(screen.getByTestId("service-badge-team-governance")).toHaveTextContent("Restricted");
  });

  it("includes Chapter Lead and City Lead templates and applies their permissions", async () => {
    const user = userEvent.setup();
    render(<RoleDrawer request={{ mode: "create", roleId: null }} onClose={vi.fn()} />);

    await user.click(screen.getByRole("combobox", { name: "Base Permission Template" }));
    expect(screen.getByRole("option", { name: "Clone from Chapter Lead" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Clone from City Lead" })).toBeInTheDocument();

    // Apply Chapter Lead template
    await user.click(screen.getByRole("option", { name: "Clone from Chapter Lead" }));
    expect(screen.getByRole("combobox", { name: "Drive Creation" })).toHaveTextContent("Granted");
    expect(screen.getByRole("combobox", { name: "Publish Noticeboard" })).toHaveTextContent("Granted");
    expect(screen.getByRole("combobox", { name: "Triage Apps" })).toHaveTextContent("Granted");
    expect(screen.getByRole("combobox", { name: "Approve Hours" })).toHaveTextContent("Granted");
    expect(screen.getByRole("combobox", { name: "Org Governance" })).toHaveTextContent("Granted");
    // Restricted items:
    expect(screen.getByRole("combobox", { name: "Volunteer Directory" })).toHaveTextContent("Restricted");
    expect(screen.getByRole("combobox", { name: "Team Members" })).toHaveTextContent("Restricted");
    expect(screen.getByRole("combobox", { name: "Roles & Permissions" })).toHaveTextContent("Restricted");
    expect(screen.getByRole("combobox", { name: "Partner Inquiries" })).toHaveTextContent("Restricted");
    expect(screen.getByRole("combobox", { name: "Audit Logs" })).toHaveTextContent("Restricted");
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

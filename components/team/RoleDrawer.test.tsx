import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  chapterLeadPermissionKeys,
  mockModuleCatalogsFetch,
  moduleCatalogsFixture,
} from "./testCatalogFixtures";
import { expandSwitches } from "@/registry/moduleCatalog";

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
    organizationId: "org-1",
    accessToken: "access-token",
    moduleId: "mod-1",
    refresh,
    roles: [
      {
        id: "chapter-lead-id",
        name: "Chapter Lead",
        isSystem: true,
        description: "Chapter lead system role",
        permissionKeys: chapterLeadPermissionKeys,
      },
      {
        id: "r1",
        name: "Operations Lead",
        isSystem: true,
        description: "sys",
        permissionKeys: ["opportunities:write", "noticeboard:write", "applications:update", "applications:read", "hours:update", "hours:read"],
      },
      {
        id: "r2",
        name: "Regional Logistics Lead",
        isSystem: false,
        description: "cust",
        permissionKeys: ["opportunities:write", "hours:update", "hours:read"],
      },
    ],
  }),
}));

import { RoleDrawer } from "./RoleDrawer";

describe("RoleDrawer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", mockModuleCatalogsFetch());
  });

  async function waitForCatalogs() {
    await waitFor(() => {
      expect(screen.getByText("Youth Republic")).toBeInTheDocument();
    });
  }

  it("shows Chapter Lead system specification with one switch per area", async () => {
    const user = userEvent.setup();
    render(<RoleDrawer request={{ mode: "view", roleId: "chapter-lead-id" }} onClose={vi.fn()} />);

    await waitForCatalogs();
    expect(screen.getByText("System Role Specification")).toBeInTheDocument();
    expect(screen.getByTestId("service-badge-youth-republic")).toHaveTextContent("Limited");

    await user.click(screen.getByRole("button", { name: /Toggle Youth Republic/i }));
    expect(screen.getByText("Drives")).toBeInTheDocument();
    expect(screen.getByText("Noticeboard")).toBeInTheDocument();
    expect(screen.getByText("Applications")).toBeInTheDocument();
    expect(screen.getByText("Hours")).toBeInTheDocument();
    expect(screen.getByText("Volunteer Directory")).toBeInTheDocument();
    expect(screen.getByTestId("area-badge-youth-republic-drives")).toHaveTextContent("Manage");
    expect(screen.getByTestId("area-badge-youth-republic-volunteers")).toHaveTextContent("None");

    expect(screen.queryByText("Drive Creation")).not.toBeInTheDocument();
    expect(screen.queryByText("Granted")).not.toBeInTheDocument();
    expect(screen.queryByText("Read Only")).not.toBeInTheDocument();
  });

  it("creates a custom role from the area switches", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<RoleDrawer request={{ mode: "create", roleId: null }} onClose={onClose} />);
    await waitForCatalogs();

    await user.type(screen.getByLabelText(/Role Title/i), "Warehouse Lead");
    await user.click(screen.getByRole("combobox", { name: "Hours" }));
    await user.click(screen.getByRole("option", { name: "View" }));
    await user.click(screen.getByRole("button", { name: /Save Role/i }));

    await waitFor(() => expect(createRole).toHaveBeenCalledTimes(1));
    const [payload] = createRole.mock.calls[0];
    expect(payload).toMatchObject({ organizationId: "org-1", moduleId: "mod-1", name: "Warehouse Lead" });
    expect(payload.permissionKeys).toEqual(
      expect.arrayContaining(["hours:read"]),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("opens a system role read-only with no save and collapsed cards", async () => {
    const user = userEvent.setup();
    render(<RoleDrawer request={{ mode: "view", roleId: "r1" }} onClose={vi.fn()} />);
    await waitForCatalogs();
    expect(screen.queryByTestId("area-badge-youth-republic-drives")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Save Role/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Toggle Youth Republic/i }));
    expect(screen.getByTestId("area-badge-youth-republic-drives")).toBeInTheDocument();
  });

  it("prefills a clone from the source role with an editable name", async () => {
    render(<RoleDrawer request={{ mode: "clone", roleId: "r2" }} onClose={vi.fn()} />);
    await waitForCatalogs();
    expect((screen.getByLabelText(/Role Title/i) as HTMLInputElement).value).toBe("Regional Logistics Lead (Copy)");
    expect(screen.getByRole("combobox", { name: "Drives" })).toBeInTheDocument();
  });

  it("edits a custom role", async () => {
    const user = userEvent.setup();
    render(<RoleDrawer request={{ mode: "edit", roleId: "r2" }} onClose={vi.fn()} />);
    await waitForCatalogs();
    await user.click(await screen.findByRole("combobox", { name: "Hours" }));
    await user.click(screen.getByRole("option", { name: "Manage" }));
    await user.click(screen.getByRole("button", { name: /Save Role/i }));
    await waitFor(() => expect(updateRole).toHaveBeenCalledTimes(1));
    expect(updateRole.mock.calls[0][0]).toMatchObject({ roleId: "r2" });
    expect(updateRole.mock.calls[0][0].permissionKeys).toEqual(
      expect.arrayContaining(["hours:read", "hours:update"]),
    );
  });

  it("applies a system template to update area switches", async () => {
    const user = userEvent.setup();
    render(<RoleDrawer request={{ mode: "create", roleId: null }} onClose={vi.fn()} />);
    await waitForCatalogs();
    await user.click(screen.getByRole("combobox", { name: "Base Permission Template" }));
    await user.click(screen.getByRole("option", { name: "Clone from Operations Lead" }));
    expect(screen.getByRole("combobox", { name: "Hours" })).toHaveTextContent("Manage");
  });

  it("organizes areas into Youth Republic and Team & Governance accordions", async () => {
    render(<RoleDrawer request={{ mode: "create", roleId: null }} onClose={vi.fn()} />);
    await waitForCatalogs();
    expect(screen.getByText("Youth Republic")).toBeInTheDocument();
    expect(screen.getByText("Team & Governance")).toBeInTheDocument();
  });

  it("catalog presets set every area switch and update the badge", async () => {
    const user = userEvent.setup();
    render(<RoleDrawer request={{ mode: "create", roleId: null }} onClose={vi.fn()} />);
    await waitForCatalogs();

    await user.click(screen.getByRole("button", { name: /Youth Republic: Full/i }));
    expect(screen.getByRole("combobox", { name: "Volunteer Directory" })).toHaveTextContent("View");
    expect(screen.getByTestId("service-badge-youth-republic")).toHaveTextContent("Full");

    await user.click(screen.getByRole("button", { name: /Youth Republic: View/i }));
    expect(screen.getByTestId("service-badge-youth-republic")).toHaveTextContent("View only");

    await user.click(screen.getByRole("button", { name: /Youth Republic: None/i }));
    expect(screen.getByTestId("service-badge-youth-republic")).toHaveTextContent("None");
  });

  it("includes Chapter Lead and City Lead templates and applies their permissions", async () => {
    const user = userEvent.setup();
    render(<RoleDrawer request={{ mode: "create", roleId: null }} onClose={vi.fn()} />);
    await waitForCatalogs();
    await user.click(screen.getByRole("combobox", { name: "Base Permission Template" }));
    expect(screen.getByRole("option", { name: "Clone from Chapter Lead" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Clone from City Lead" })).toBeInTheDocument();

    await user.click(screen.getByRole("option", { name: "Clone from Chapter Lead" }));
    expect(screen.getByRole("combobox", { name: "Drives" })).toHaveTextContent("Manage");
    expect(screen.getByRole("combobox", { name: "Volunteer Directory" })).toHaveTextContent("None");
    expect(screen.getByRole("combobox", { name: "Org Governance" })).toHaveTextContent("Manage");
  });

  it("expands manage switches to the expected permission keys on save", async () => {
    const user = userEvent.setup();
    render(<RoleDrawer request={{ mode: "create", roleId: null }} onClose={vi.fn()} />);
    await waitForCatalogs();
    await user.type(screen.getByLabelText(/Role Title/i), "Catalog Keys");
    await user.click(screen.getByRole("button", { name: /Youth Republic: None/i }));
    await user.click(screen.getByRole("combobox", { name: "Drives" }));
    await user.click(screen.getByRole("option", { name: "Manage" }));
    await user.click(screen.getByRole("button", { name: /Save Role/i }));

    await waitFor(() => expect(createRole).toHaveBeenCalledTimes(1));
    expect(createRole.mock.calls[0][0].permissionKeys).toEqual(
      expandSwitches(moduleCatalogsFixture[1], { drives: "manage" }).sort(),
    );
  });
});
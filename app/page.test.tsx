import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import Home from "./page";
import * as shell from "@/components/shell/AppShell";

vi.mock("@/components/shell/AppShell", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/shell/AppShell")>();
  return { ...actual, useSelectedOrg: vi.fn(), useStaffClaims: vi.fn(), useOrgTier: vi.fn() };
});

describe("Home", () => {
  it("shows a no-access message when the staff has no org at all", () => {
    vi.mocked(shell.useSelectedOrg).mockReturnValue(null);
    vi.mocked(shell.useStaffClaims).mockReturnValue({
      actorType: "staff", staffId: "s1", platformOwner: false, orgRoles: [], moduleAccess: [],
    });
    vi.mocked(shell.useOrgTier).mockReturnValue(null);

    render(<Home />);

    expect(screen.getByText(/don't have access to any organization yet/i)).toBeInTheDocument();
  });

  it("shows a no-modules-enabled message for a selected org with no module_access entries", () => {
    vi.mocked(shell.useSelectedOrg).mockReturnValue("org-1");
    vi.mocked(shell.useStaffClaims).mockReturnValue({
      actorType: "staff", staffId: "s1", platformOwner: false,
      orgRoles: [{ organizationId: "org-1" }], moduleAccess: [],
    });
    vi.mocked(shell.useOrgTier).mockReturnValue("admin");

    render(<Home />);

    expect(screen.getByText(/no modules are enabled for this organization yet/i)).toBeInTheDocument();
  });

  it("renders a heading when the staff has at least one module available", () => {
    vi.mocked(shell.useSelectedOrg).mockReturnValue("org-1");
    vi.mocked(shell.useStaffClaims).mockReturnValue({
      actorType: "staff", staffId: "s1", platformOwner: false,
      orgRoles: [{ organizationId: "org-1" }],
      moduleAccess: [{ organizationId: "org-1", module: "vms", permissions: ["applications:read"] }],
    });
    vi.mocked(shell.useOrgTier).mockReturnValue(null);

    render(<Home />);

    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.queryByText(/don't have access/i)).not.toBeInTheDocument();
  });
});

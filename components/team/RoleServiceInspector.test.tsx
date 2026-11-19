import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { RoleServiceInspector } from "./RoleServiceInspector";
import { chapterLeadPermissionKeys, moduleCatalogsFixture } from "./testCatalogFixtures";
import { expandSwitches } from "@/registry/moduleCatalog";
import { platformCatalog, platformRole } from "@/registry/platformCatalog";

describe("RoleServiceInspector", () => {
  it("renders policy summary header with role name and governed modules", () => {
    render(
      <RoleServiceInspector
        catalogs={moduleCatalogsFixture}
        permissionKeys={chapterLeadPermissionKeys}
        roleName="Chapter Lead"
      />,
    );

    expect(screen.getByText("Chapter Lead")).toBeInTheDocument();
    expect(screen.getByText(/IAM Service Policy/i)).toBeInTheDocument();
  });

  it("renders collapsible service module accordions with area-based badges", () => {
    render(
      <RoleServiceInspector
        catalogs={moduleCatalogsFixture}
        permissionKeys={chapterLeadPermissionKeys}
        roleName="Chapter Lead"
      />,
    );

    expect(screen.getByText("Youth Republic")).toBeInTheDocument();
    expect(screen.getByText("Team & Governance")).toBeInTheDocument();

    const yrModule = screen.getByRole("button", { name: /Youth Republic/i });
    expect(within(yrModule).getByText("Limited")).toHaveClass("badge", "badge-warn");
  });

  it("toggles area rows when clicking a service accordion", async () => {
    const user = userEvent.setup();
    render(
      <RoleServiceInspector
        catalogs={moduleCatalogsFixture}
        permissionKeys={chapterLeadPermissionKeys}
        roleName="Chapter Lead"
      />,
    );

    expect(screen.queryByText("Drives")).not.toBeInTheDocument();
    const yrButton = screen.getByRole("button", { name: /Youth Republic/i });
    await user.click(yrButton);

    expect(screen.getByText("Drives")).toBeInTheDocument();
    expect(screen.getByText("Volunteer Directory")).toBeInTheDocument();
  });

  it("renders correct level badges for individual areas", async () => {
    const user = userEvent.setup();
    render(
      <RoleServiceInspector
        catalogs={moduleCatalogsFixture}
        permissionKeys={chapterLeadPermissionKeys}
        roleName="Chapter Lead"
      />,
    );

    await user.click(screen.getByRole("button", { name: /Youth Republic/i }));
    const driveRow = screen.getByText("Drives").closest("div[data-area]")!;
    expect(driveRow.querySelector(".badge")).toHaveTextContent("Manage");

    const volRow = screen.getByText("Volunteer Directory").closest("div[data-area]")!;
    expect(volRow.querySelector(".badge")).toHaveTextContent("None");
  });

  it("renders View only badge for Auditor role", () => {
    const permissionKeys = expandSwitches(platformCatalog, platformRole("Auditor").switches);

    render(
      <RoleServiceInspector
        catalogs={[platformCatalog]}
        permissionKeys={permissionKeys}
        roleName="Auditor"
      />,
    );

    expect(screen.getByText("View only")).toBeInTheDocument();
  });

  it("renders None badge for fully off role", () => {
    render(
      <RoleServiceInspector
        catalogs={moduleCatalogsFixture}
        permissionKeys={[]}
        roleName="Guest"
      />,
    );

    const noneBadges = screen.getAllByText("None");
    expect(noneBadges.length).toBeGreaterThan(0);
  });

  it("accepts readOnly prop gracefully", () => {
    render(
      <RoleServiceInspector
        catalogs={moduleCatalogsFixture}
        permissionKeys={chapterLeadPermissionKeys}
        roleName="Chapter Lead"
        readOnly={true}
      />,
    );
    expect(screen.getByText("Chapter Lead")).toBeInTheDocument();
  });
});
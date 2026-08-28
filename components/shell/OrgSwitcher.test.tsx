import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { OrgSwitcher } from "./OrgSwitcher";

describe("OrgSwitcher", () => {
  it("renders nothing when there is only one org", () => {
    const { container } = render(
      <OrgSwitcher orgIds={["org-1"]} selectedOrgId="org-1" orgNames={{ "org-1": "Rizq" }} onSelect={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders a select with one option per org and calls onSelect on change", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(
      <OrgSwitcher
        orgIds={["org-1", "org-2"]}
        selectedOrgId="org-1"
        orgNames={{ "org-1": "Rizq", "org-2": "Second Org" }}
        onSelect={onSelect}
      />,
    );

    expect(screen.getByRole("option", { name: "Rizq" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Second Org" })).toBeInTheDocument();

    await user.selectOptions(screen.getByRole("combobox"), "org-2");
    expect(onSelect).toHaveBeenCalledWith("org-2");
  });
});

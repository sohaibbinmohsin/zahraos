import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { OrganizationsList } from "./OrganizationsList";

describe("OrganizationsList", () => {
  it("renders one row per organization", () => {
    render(
      <OrganizationsList
        organizations={[
          { id: "org-1", name: "Rizq", slug: "rizq", status: "active" },
          { id: "org-2", name: "Second Org", slug: "second-org", status: "active" },
        ]}
      />,
    );
    expect(screen.getByText("Rizq")).toBeInTheDocument();
    expect(screen.getByText("Second Org")).toBeInTheDocument();
  });
});

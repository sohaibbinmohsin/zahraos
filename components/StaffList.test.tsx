import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { StaffList } from "./StaffList";

describe("StaffList", () => {
  it("renders one row per staff member with a deactivate control for active staff", () => {
    render(
      <StaffList
        staff={[
          { id: "s1", fullName: "Admin Person", email: "admin@example.com", status: "active", orgTier: "admin" },
          { id: "s2", fullName: "Regular Person", email: "regular@example.com", status: "deactivated", orgTier: null },
        ]}
        accessToken="session-token"
        onDeactivated={vi.fn()}
      />,
    );

    expect(screen.getByText("Admin Person")).toBeInTheDocument();
    expect(screen.getByText("Regular Person")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Deactivate" })).toHaveLength(1);
  });
});

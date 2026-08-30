import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import YouthRepublicModuleLayout from "./layout";

vi.mock("next/navigation", () => ({
  usePathname: () => "/modules/youth-republic/dashboard",
}));

describe("YouthRepublicModuleLayout", () => {
  it("renders a tab for each of the 5 admin screens plus the page content", () => {
    render(
      <YouthRepublicModuleLayout>
        <p>screen content</p>
      </YouthRepublicModuleLayout>,
    );

    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Volunteers" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Opportunities" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Applications" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Hours" })).toBeInTheDocument();
    expect(screen.getByText("screen content")).toBeInTheDocument();
  });
});

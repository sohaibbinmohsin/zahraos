import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { RolesList } from "./RolesList";

describe("RolesList", () => {
  it("distinguishes system roles from custom roles", () => {
    render(
      <RolesList
        roles={[
          { id: "r1", name: "Viewer", isSystem: true, moduleKey: "youth-republic" },
          { id: "r2", name: "Hours Verifier", isSystem: false, moduleKey: "youth-republic" },
        ]}
      />,
    );
    expect(screen.getByText("Viewer")).toBeInTheDocument();
    expect(screen.getByText("System")).toBeInTheDocument();
    expect(screen.getByText("Hours Verifier")).toBeInTheDocument();
    expect(screen.getByText("Custom")).toBeInTheDocument();
  });
});

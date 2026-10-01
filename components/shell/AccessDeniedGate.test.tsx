import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { AccessDeniedGate } from "./AccessDeniedGate";

describe("AccessDeniedGate", () => {
  it("renders children when allowed is true", () => {
    render(
      <AccessDeniedGate
        allowed={true}
        sectionName="Drives"
        fallbackRoute="/youth-republic"
        fallbackLabel="Youth Republic"
      >
        <div data-testid="protected-content">Protected Operational Content</div>
      </AccessDeniedGate>
    );

    expect(screen.getByTestId("protected-content")).toBeInTheDocument();
    expect(screen.queryByText(/Access Denied/i)).not.toBeInTheDocument();
  });

  it("renders an accessible access denied card with return link when allowed is false", () => {
    render(
      <AccessDeniedGate
        allowed={false}
        sectionName="Hours"
        fallbackRoute="/youth-republic"
        fallbackLabel="Youth Republic"
      >
        <div data-testid="protected-content">Protected Content</div>
      </AccessDeniedGate>
    );

    expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Access Denied/i })).toBeInTheDocument();
    expect(screen.getByText(/Hours/i)).toBeInTheDocument();

    const link = screen.getByRole("link", { name: /Youth Republic/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/youth-republic");
  });

  it("uses sensible defaults when fallbackRoute and sectionName are omitted", () => {
    render(
      <AccessDeniedGate allowed={false}>
        <div data-testid="protected-content">Protected Content</div>
      </AccessDeniedGate>
    );

    expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Access Denied/i })).toBeInTheDocument();
    expect(screen.getByText(/You do not have permission to view this section/i)).toBeInTheDocument();

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/youth-republic");
    expect(link).toHaveTextContent(/Youth Republic/i);
  });

  it("renders custom fallback label correctly when provided", () => {
    render(
      <AccessDeniedGate
        allowed={false}
        sectionName="Volunteers"
        fallbackRoute="/dashboard"
        fallbackLabel="Dashboard"
      >
        <span>Content</span>
      </AccessDeniedGate>
    );

    const link = screen.getByRole("link", { name: /Dashboard/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/dashboard");
  });
});

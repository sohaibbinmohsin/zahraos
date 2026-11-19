import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { ToastProvider, useToast } from "./ToastContext";

function Harness() {
  const { showToast } = useToast();
  return (
    <>
      <button type="button" onClick={() => showToast("Saved the profile.")}>Success</button>
      <button type="button" onClick={() => showToast("Failed to save.", "error")}>Error</button>
    </>
  );
}

describe("ToastProvider", () => {
  it("shows a tick for a success toast", async () => {
    const user = userEvent.setup();
    const { container } = render(<ToastProvider><Harness /></ToastProvider>);
    await user.click(screen.getByRole("button", { name: "Success" }));
    expect(screen.getByRole("status")).toHaveTextContent("Saved the profile.");
    expect(container.querySelector("polyline")).not.toBeNull();
    expect(container.querySelector("line")).toBeNull();
  });

  it("shows a cross for an error toast", async () => {
    const user = userEvent.setup();
    const { container } = render(<ToastProvider><Harness /></ToastProvider>);
    await user.click(screen.getByRole("button", { name: "Error" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Failed to save.");
    expect(container.querySelectorAll("line")).toHaveLength(2);
    expect(container.querySelector("polyline")).toBeNull();
  });
});

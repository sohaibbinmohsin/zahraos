import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DeactivateStaffButton } from "./DeactivateStaffButton";
import * as platformFunctions from "@/lib/platformFunctions";

vi.mock("@/lib/platformFunctions");

describe("DeactivateStaffButton", () => {
  beforeEach(() => {
    vi.mocked(platformFunctions.deactivateStaff).mockReset();
  });

  it("calls deactivateStaff with the target id and then onDeactivated", async () => {
    vi.mocked(platformFunctions.deactivateStaff).mockResolvedValue({ staffId: "s1" });
    const onDeactivated = vi.fn();
    const user = userEvent.setup();

    render(<DeactivateStaffButton targetStaffId="s1" accessToken="session-token" onDeactivated={onDeactivated} />);
    await user.click(screen.getByRole("button", { name: "Deactivate" }));

    await waitFor(() => {
      expect(platformFunctions.deactivateStaff).toHaveBeenCalledWith({ targetStaffId: "s1" }, "session-token");
      expect(onDeactivated).toHaveBeenCalled();
    });
  });

  it("shows the server's error message on failure", async () => {
    vi.mocked(platformFunctions.deactivateStaff).mockRejectedValue(new Error("forbidden"));
    const user = userEvent.setup();

    render(<DeactivateStaffButton targetStaffId="s1" accessToken="session-token" onDeactivated={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Deactivate" }));

    expect(await screen.findByText("forbidden")).toBeInTheDocument();
  });
});

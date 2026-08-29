import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CreateStaffForm } from "./CreateStaffForm";
import * as platformFunctions from "@/lib/platformFunctions";

vi.mock("@/lib/platformFunctions");

describe("CreateStaffForm", () => {
  beforeEach(() => {
    vi.mocked(platformFunctions.createStaff).mockReset();
    vi.mocked(platformFunctions.assignStaffOrgRole).mockReset();
  });

  it("submits the form and shows the temporary password once, on success", async () => {
    vi.mocked(platformFunctions.createStaff).mockResolvedValue({ staffId: "s1", temporaryPassword: "temp-abc-123" });
    const onCreated = vi.fn();
    const user = userEvent.setup();

    render(<CreateStaffForm organizationId="org-1" accessToken="session-token" onCreated={onCreated} />);

    await user.type(screen.getByLabelText("Full name"), "New Staff");
    await user.type(screen.getByLabelText("Email"), "new-staff@example.com");
    await user.click(screen.getByRole("button", { name: "Create staff" }));

    expect(await screen.findByText("temp-abc-123")).toBeInTheDocument();
    expect(platformFunctions.createStaff).toHaveBeenCalledWith(
      { fullName: "New Staff", email: "new-staff@example.com", organizationId: "org-1" },
      "session-token",
    );
    expect(platformFunctions.assignStaffOrgRole).not.toHaveBeenCalled();
    expect(onCreated).toHaveBeenCalled();
  });

  it("also grants the selected org role, using the newly created staffId, when one is chosen", async () => {
    vi.mocked(platformFunctions.createStaff).mockResolvedValue({ staffId: "s9", temporaryPassword: "temp-xyz-789" });
    vi.mocked(platformFunctions.assignStaffOrgRole).mockResolvedValue({ staffId: "s9" });
    const onCreated = vi.fn();
    const user = userEvent.setup();

    render(<CreateStaffForm organizationId="org-1" accessToken="session-token" onCreated={onCreated} />);

    await user.type(screen.getByLabelText("Full name"), "New Super Admin");
    await user.type(screen.getByLabelText("Email"), "super-admin@example.com");
    await user.selectOptions(screen.getByLabelText("Org role (optional)"), "super_admin");
    await user.click(screen.getByRole("button", { name: "Create staff" }));

    await waitFor(() => {
      expect(platformFunctions.assignStaffOrgRole).toHaveBeenCalledWith(
        { staffId: "s9", organizationId: "org-1", orgTier: "super_admin" },
        "session-token",
      );
    });
    expect(await screen.findByText("temp-xyz-789")).toBeInTheDocument();
  });
});

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SetPasswordForm } from "./SetPasswordForm";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import * as platformFunctions from "@/lib/platformFunctions";

vi.mock("@/lib/supabase/browserClient");
vi.mock("@/lib/platformFunctions");
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

describe("SetPasswordForm", () => {
  beforeEach(() => {
    vi.mocked(platformFunctions.setPassword).mockReset();
    vi.mocked(getBrowserSupabaseClient).mockReturnValue({
      auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: "session-token" } } }) },
    } as never);
  });

  it("rejects when the two password fields don't match", async () => {
    const user = userEvent.setup();
    render(<SetPasswordForm />);

    await user.type(screen.getByLabelText("New password"), "brand-new-password-1");
    await user.type(screen.getByLabelText("Confirm password"), "different-password");
    await user.click(screen.getByRole("button", { name: "Set password" }));

    expect(await screen.findByText("Passwords do not match")).toBeInTheDocument();
    expect(platformFunctions.setPassword).not.toHaveBeenCalled();
  });

  it("submits the new password using the current session's access token", async () => {
    vi.mocked(platformFunctions.setPassword).mockResolvedValue({ staffId: "s1" });
    const user = userEvent.setup();
    render(<SetPasswordForm />);

    await user.type(screen.getByLabelText("New password"), "brand-new-password-1");
    await user.type(screen.getByLabelText("Confirm password"), "brand-new-password-1");
    await user.click(screen.getByRole("button", { name: "Set password" }));

    await waitFor(() => {
      expect(platformFunctions.setPassword).toHaveBeenCalledWith(
        { newPassword: "brand-new-password-1" },
        "session-token",
      );
    });
  });
});

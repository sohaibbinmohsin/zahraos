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

    await user.type(screen.getByLabelText("New password"), "Brand-new-pass-1!");
    await user.type(screen.getByLabelText("Confirm password"), "Different-pass-2!");
    await user.click(screen.getByRole("button", { name: "Set password" }));

    expect(await screen.findByText("Passwords do not match")).toBeInTheDocument();
    expect(platformFunctions.setPassword).not.toHaveBeenCalled();
  });

  it("enforces minimum 8 characters requirement", async () => {
    const user = userEvent.setup();
    render(<SetPasswordForm />);

    await user.type(screen.getByLabelText("New password"), "Ab1!");
    await user.type(screen.getByLabelText("Confirm password"), "Ab1!");
    await user.click(screen.getByRole("button", { name: "Set password" }));

    expect(await screen.findByText("Password must be at least 8 characters")).toBeInTheDocument();
    expect(platformFunctions.setPassword).not.toHaveBeenCalled();
  });

  it("enforces lowercase, uppercase, number, and symbol requirements", async () => {
    const user = userEvent.setup();
    render(<SetPasswordForm />);

    // Missing lowercase: "ALLCAPS123!"
    await user.type(screen.getByLabelText("New password"), "ALLCAPS123!");
    await user.type(screen.getByLabelText("Confirm password"), "ALLCAPS123!");
    await user.click(screen.getByRole("button", { name: "Set password" }));
    expect(await screen.findByText("Password must include at least one lowercase letter")).toBeInTheDocument();

    // Missing uppercase: "lowercase123!"
    await user.clear(screen.getByLabelText("New password"));
    await user.clear(screen.getByLabelText("Confirm password"));
    await user.type(screen.getByLabelText("New password"), "lowercase123!");
    await user.type(screen.getByLabelText("Confirm password"), "lowercase123!");
    await user.click(screen.getByRole("button", { name: "Set password" }));
    expect(await screen.findByText("Password must include at least one uppercase letter")).toBeInTheDocument();

    // Missing number: "NoNumberPass!"
    await user.clear(screen.getByLabelText("New password"));
    await user.clear(screen.getByLabelText("Confirm password"));
    await user.type(screen.getByLabelText("New password"), "NoNumberPass!");
    await user.type(screen.getByLabelText("Confirm password"), "NoNumberPass!");
    await user.click(screen.getByRole("button", { name: "Set password" }));
    expect(await screen.findByText("Password must include at least one number (0-9)")).toBeInTheDocument();

    // Missing symbol: "NoSymbols123"
    await user.clear(screen.getByLabelText("New password"));
    await user.clear(screen.getByLabelText("Confirm password"));
    await user.type(screen.getByLabelText("New password"), "NoSymbols123");
    await user.type(screen.getByLabelText("Confirm password"), "NoSymbols123");
    await user.click(screen.getByRole("button", { name: "Set password" }));
    expect(await screen.findByText("Password must include at least one symbol or special character")).toBeInTheDocument();
    expect(platformFunctions.setPassword).not.toHaveBeenCalled();
  });

  it("submits the new password using the current session's access token", async () => {
    vi.mocked(platformFunctions.setPassword).mockResolvedValue({ staffId: "s1" });
    const user = userEvent.setup();
    render(<SetPasswordForm />);

    await user.type(screen.getByLabelText("New password"), "Brand-new-pass-1!");
    await user.type(screen.getByLabelText("Confirm password"), "Brand-new-pass-1!");
    await user.click(screen.getByRole("button", { name: "Set password" }));

    await waitFor(() => {
      expect(platformFunctions.setPassword).toHaveBeenCalledWith(
        { newPassword: "Brand-new-pass-1!" },
        "session-token",
      );
    });
  });
});

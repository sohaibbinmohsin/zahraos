import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChangePasswordModal } from "./ChangePasswordModal";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { ToastProvider } from "./ToastContext";

vi.mock("@/lib/supabase/browserClient");

describe("ChangePasswordModal", () => {
  const updateUserMock = vi.fn();
  const updateStaffMock = vi.fn();
  const onCloseMock = vi.fn();

  beforeEach(() => {
    updateUserMock.mockReset().mockResolvedValue({ data: { user: {} }, error: null });
    updateStaffMock.mockReset().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    onCloseMock.mockReset();

    vi.mocked(getBrowserSupabaseClient).mockReturnValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: {
            session: {
              access_token: "mock-token",
              user: { id: "user-123", email: "admin@rizq.org" },
            },
          },
        }),
        updateUser: updateUserMock,
      },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "staff") {
          return { update: updateStaffMock };
        }
        return {};
      }),
    } as never);
  });

  it("renders with normal title case heading without uppercase class", () => {
    render(
      <ToastProvider>
        <ChangePasswordModal isOpen={true} onClose={onCloseMock} />
      </ToastProvider>,
    );

    const title = screen.getByRole("heading", { level: 2, name: "Change Password" });
    expect(title).toBeInTheDocument();
    expect(title).not.toHaveClass("uppercase");
  });

  it("requires current password before submitting", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ChangePasswordModal isOpen={true} onClose={onCloseMock} />
      </ToastProvider>,
    );

    await user.type(screen.getByLabelText("New Password"), "Secret123!");
    await user.type(screen.getByLabelText("Confirm Password"), "Secret123!");
    await user.click(screen.getByRole("button", { name: "Update Password" }));

    expect(await screen.findByText("Current password is required")).toBeInTheDocument();
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it("enforces minimum 8 characters requirement", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ChangePasswordModal isOpen={true} onClose={onCloseMock} />
      </ToastProvider>,
    );

    await user.type(screen.getByLabelText("Current Password"), "OldPass123!");
    await user.type(screen.getByLabelText("New Password"), "Ab1!");
    await user.type(screen.getByLabelText("Confirm Password"), "Ab1!");
    await user.click(screen.getByRole("button", { name: "Update Password" }));

    expect(await screen.findByText("Password must be at least 8 characters")).toBeInTheDocument();
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it("enforces lowercase, uppercase, number, and symbol requirements", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ChangePasswordModal isOpen={true} onClose={onCloseMock} />
      </ToastProvider>,
    );

    // Missing lowercase: "ALLCAPS123!"
    await user.type(screen.getByLabelText("Current Password"), "OldPass123!");
    await user.type(screen.getByLabelText("New Password"), "ALLCAPS123!");
    await user.type(screen.getByLabelText("Confirm Password"), "ALLCAPS123!");
    await user.click(screen.getByRole("button", { name: "Update Password" }));
    expect(await screen.findByText("Password must include at least one lowercase letter")).toBeInTheDocument();

    // Missing uppercase: "lowercase123!"
    await user.clear(screen.getByLabelText("New Password"));
    await user.clear(screen.getByLabelText("Confirm Password"));
    await user.type(screen.getByLabelText("New Password"), "lowercase123!");
    await user.type(screen.getByLabelText("Confirm Password"), "lowercase123!");
    await user.click(screen.getByRole("button", { name: "Update Password" }));
    expect(await screen.findByText("Password must include at least one uppercase letter")).toBeInTheDocument();

    // Missing digit: "NoDigitsHere!"
    await user.clear(screen.getByLabelText("New Password"));
    await user.clear(screen.getByLabelText("Confirm Password"));
    await user.type(screen.getByLabelText("New Password"), "NoDigitsHere!");
    await user.type(screen.getByLabelText("Confirm Password"), "NoDigitsHere!");
    await user.click(screen.getByRole("button", { name: "Update Password" }));
    expect(await screen.findByText("Password must include at least one number (0-9)")).toBeInTheDocument();

    // Missing symbol: "NoSymbolsHere123"
    await user.clear(screen.getByLabelText("New Password"));
    await user.clear(screen.getByLabelText("Confirm Password"));
    await user.type(screen.getByLabelText("New Password"), "NoSymbolsHere123");
    await user.type(screen.getByLabelText("Confirm Password"), "NoSymbolsHere123");
    await user.click(screen.getByRole("button", { name: "Update Password" }));
    expect(await screen.findByText("Password must include at least one symbol or special character")).toBeInTheDocument();
  });

  it("prevents setting new password to the exact same as current password", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ChangePasswordModal isOpen={true} onClose={onCloseMock} />
      </ToastProvider>,
    );

    await user.type(screen.getByLabelText("Current Password"), "SamePass123!");
    await user.type(screen.getByLabelText("New Password"), "SamePass123!");
    await user.type(screen.getByLabelText("Confirm Password"), "SamePass123!");
    await user.click(screen.getByRole("button", { name: "Update Password" }));

    expect(await screen.findByText("New password must be different from current password")).toBeInTheDocument();
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it("rejects when passwords do not match", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ChangePasswordModal isOpen={true} onClose={onCloseMock} />
      </ToastProvider>,
    );

    await user.type(screen.getByLabelText("Current Password"), "OldPass123!");
    await user.type(screen.getByLabelText("New Password"), "ValidPass123!");
    await user.type(screen.getByLabelText("Confirm Password"), "DifferentPass123!");
    await user.click(screen.getByRole("button", { name: "Update Password" }));

    expect(await screen.findByText("Passwords do not match")).toBeInTheDocument();
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it("submits password and currentPassword to supabase.auth.updateUser when valid", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ChangePasswordModal isOpen={true} onClose={onCloseMock} />
      </ToastProvider>,
    );

    await user.type(screen.getByLabelText("Current Password"), "OldSecurePass123!");
    await user.type(screen.getByLabelText("New Password"), "BrandNewSecurePass123!");
    await user.type(screen.getByLabelText("Confirm Password"), "BrandNewSecurePass123!");
    await user.click(screen.getByRole("button", { name: "Update Password" }));

    await waitFor(() => {
      expect(updateUserMock).toHaveBeenCalledWith({
        password: "BrandNewSecurePass123!",
        current_password: "OldSecurePass123!",
      });
    });

    await waitFor(() => {
      expect(onCloseMock).toHaveBeenCalled();
    });
  });

  it("displays Supabase error when updateUser rejects (e.g. invalid current password)", async () => {
    updateUserMock.mockResolvedValue({
      data: { user: null },
      error: new Error("Current password is not correct"),
    });

    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ChangePasswordModal isOpen={true} onClose={onCloseMock} />
      </ToastProvider>,
    );

    await user.type(screen.getByLabelText("Current Password"), "WrongOldPass123!");
    await user.type(screen.getByLabelText("New Password"), "BrandNewSecurePass123!");
    await user.type(screen.getByLabelText("Confirm Password"), "BrandNewSecurePass123!");
    await user.click(screen.getByRole("button", { name: "Update Password" }));

    expect(await screen.findByText("Current password is not correct")).toBeInTheDocument();
    expect(onCloseMock).not.toHaveBeenCalled();
  });
});

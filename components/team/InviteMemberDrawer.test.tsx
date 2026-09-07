import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

const invite = vi.fn().mockResolvedValue({ staffId: "s9", invitationId: "i9", temporaryPassword: "Rizq-Abcd-2345!" });
const refresh = vi.fn();
const showToast = vi.fn();
vi.mock("@/lib/platformFunctions", () => ({ inviteStaffMember: (...a: unknown[]) => invite(...a) }));
vi.mock("@/components/shell/ToastContext", () => ({ useToast: () => ({ showToast }) }));
vi.mock("@/components/team/TeamAccessProvider", () => ({
  useTeamAccess: () => ({
    organizationId: "org-1",
    accessToken: "access-token",
    moduleId: "mod-1",
    roles: [
      { id: "r1", name: "Operations Lead", isSystem: true, description: "", permissionKeys: [] },
      { id: "r2", name: "Auditor", isSystem: true, description: "", permissionKeys: [] },
    ],
    chapters: [{ id: "c1", name: "Lahore Chapter", city: "Lahore", status: "active" }],
    refresh,
  }),
}));

import { InviteMemberDrawer } from "./InviteMemberDrawer";

describe("InviteMemberDrawer", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates the member, then reveals the temporary password instead of closing", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<InviteMemberDrawer open onClose={onClose} />);

    await user.type(screen.getByLabelText(/Full Name/i), "Tariq Mehmood");
    await user.type(screen.getByLabelText(/Work Email/i), "tariq@x.org");
    await user.click(screen.getByRole("button", { name: "Create Member" }));

    await waitFor(() => expect(invite).toHaveBeenCalledTimes(1));
    const [payload, token] = invite.mock.calls[0];
    expect(token).toBe("access-token");
    expect(payload).toMatchObject({
      organizationId: "org-1", fullName: "Tariq Mehmood", email: "tariq@x.org", expiresAt: null,
    });
    // No email/2FA fields any more.
    expect(payload).not.toHaveProperty("sendActivationEmail");
    expect(payload).not.toHaveProperty("enforce2fa");
    expect(payload.roles).toHaveLength(1);
    expect(payload.roles[0]).toMatchObject({ roleId: "r1", scopeKind: "org_wide" });
    expect(refresh).toHaveBeenCalled();

    // Stays open on the success view showing the credentials.
    expect(onClose).not.toHaveBeenCalled();
    expect(await screen.findByText("Rizq-Abcd-2345!")).toBeInTheDocument();
    expect(screen.getByText("tariq@x.org")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("sends the chosen Access-expires date in the payload", async () => {
    const user = userEvent.setup();
    render(<InviteMemberDrawer open onClose={vi.fn()} />);

    await user.type(screen.getByLabelText(/Full Name/i), "Tariq Mehmood");
    await user.type(screen.getByLabelText(/Work Email/i), "tariq@x.org");
    await user.type(screen.getByLabelText("Access expires"), "2026-12-31");
    await user.click(screen.getByRole("button", { name: "Create Member" }));

    await waitFor(() => expect(invite).toHaveBeenCalledTimes(1));
    expect(invite.mock.calls[0][0].expiresAt).toBe("2026-12-31");
  });

  it("blocks submit with no name/email", async () => {
    const user = userEvent.setup();
    render(<InviteMemberDrawer open onClose={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Create Member" }));
    expect(invite).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith("Please enter the member's full name and work email.");
  });
});

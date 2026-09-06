import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

const invite = vi.fn().mockResolvedValue({ staffId: "s9", invitationId: "i9" });
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

  it("submits name, email, and role/scope rows then refreshes and closes", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<InviteMemberDrawer open onClose={onClose} />);

    await user.type(screen.getByLabelText(/Full Name/i), "Tariq Mehmood");
    await user.type(screen.getByLabelText(/Work Email/i), "tariq@x.org");
    await user.click(screen.getByRole("button", { name: /Send Official Invitation/i }));

    await waitFor(() => expect(invite).toHaveBeenCalledTimes(1));
    const [payload, token] = invite.mock.calls[0];
    expect(token).toBe("access-token");
    expect(payload).toMatchObject({
      organizationId: "org-1", fullName: "Tariq Mehmood", email: "tariq@x.org",
      sendActivationEmail: true, enforce2fa: true,
    });
    expect(payload.roles).toHaveLength(1);
    expect(payload.roles[0]).toMatchObject({ roleId: "r1", scopeKind: "org_wide" });
    expect(refresh).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("blocks submit with no name/email", async () => {
    const user = userEvent.setup();
    render(<InviteMemberDrawer open onClose={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /Send Official Invitation/i }));
    expect(invite).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith("Please enter candidate full name and work email.");
  });
});

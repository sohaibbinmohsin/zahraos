import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

const updateAccess = vi.fn().mockResolvedValue({ staffId: "m1" });
const removeMember = vi.fn().mockResolvedValue({ staffId: "m1" });
const refresh = vi.fn();
const showToast = vi.fn();
vi.mock("@/lib/platformFunctions", () => ({
  updateStaffAccess: (...a: unknown[]) => updateAccess(...a),
  removeStaffMember: (...a: unknown[]) => removeMember(...a),
}));
vi.mock("@/components/shell/ToastContext", () => ({ useToast: () => ({ showToast }) }));
vi.mock("@/components/team/TeamAccessProvider", () => ({
  useTeamAccess: () => ({
    organizationId: "org-1", accessToken: "access-token",
    roles: [
      { id: "r1", name: "Operations Lead", isSystem: true, description: "", permissionKeys: ["opportunities:write"] },
      { id: "r2", name: "Auditor", isSystem: true, description: "", permissionKeys: ["applications:read", "hours:read"] },
    ],
    chapters: [{ id: "c1", name: "Lahore Chapter", city: "Lahore", status: "active" }],
    members: [{
      id: "m1", fullName: "Amina Malik", email: "amina@x.org", status: "active", lastActiveLabel: "—", enforce2fa: true,
      expiresAt: "2027-06-30T00:00:00Z",
      assignments: [{ id: "a1", roleId: "r1", roleName: "Operations Lead", scopeKind: "org_wide", chapterId: null, scopeLabel: "National / All Chapters" }],
    }],
    refresh,
  }),
}));

import { EditMemberDrawer } from "./EditMemberDrawer";

describe("EditMemberDrawer", () => {
  beforeEach(() => vi.clearAllMocks());

  it("preloads the member's assignments and saves changes", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<EditMemberDrawer memberId="m1" onClose={onClose} />);
    expect(screen.getByText("Amina Malik")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Account Access Status"), "invited");
    await user.click(screen.getByRole("button", { name: /Save Changes/i }));

    await waitFor(() => expect(updateAccess).toHaveBeenCalledTimes(1));
    const [payload] = updateAccess.mock.calls[0];
    expect(payload).toMatchObject({ staffId: "m1", organizationId: "org-1", status: "invited" });
    expect(payload.roles[0]).toMatchObject({ roleId: "r1", scopeKind: "org_wide" });
    expect(refresh).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("preloads the member's expiry date and sends it in the payload", async () => {
    const user = userEvent.setup();
    render(<EditMemberDrawer memberId="m1" onClose={vi.fn()} />);
    expect(screen.getByLabelText("Access expires")).toHaveValue("2027-06-30");

    await user.clear(screen.getByLabelText("Access expires"));
    await user.type(screen.getByLabelText("Access expires"), "2028-01-15");
    await user.click(screen.getByRole("button", { name: /Save Changes/i }));

    await waitFor(() => expect(updateAccess).toHaveBeenCalledTimes(1));
    expect(updateAccess.mock.calls[0][0].expiresAt).toBe("2028-01-15");
  });

  it("sends expiresAt null when the field is cleared", async () => {
    const user = userEvent.setup();
    render(<EditMemberDrawer memberId="m1" onClose={vi.fn()} />);
    await user.clear(screen.getByLabelText("Access expires"));
    await user.click(screen.getByRole("button", { name: /Save Changes/i }));

    await waitFor(() => expect(updateAccess).toHaveBeenCalledTimes(1));
    expect(updateAccess.mock.calls[0][0].expiresAt).toBeNull();
  });

  it("removes the member after confirm", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<EditMemberDrawer memberId="m1" onClose={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /Remove from Team/i }));
    await waitFor(() => expect(removeMember).toHaveBeenCalledWith({ staffId: "m1", organizationId: "org-1" }, "access-token"));
  });
});

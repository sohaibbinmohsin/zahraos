import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { MembersTable } from "./MembersTable";
import type { TeamMember, TeamRole, Chapter } from "./TeamAccessProvider";

const roles: TeamRole[] = [
  { id: "r1", name: "Operations Lead", description: "", isSystem: true, permissionKeys: ["opportunities:write", "applications:update"] },
  { id: "r2", name: "Auditor", description: "", isSystem: true, permissionKeys: ["applications:read", "hours:read"] },
];
const chapters: Chapter[] = [{ id: "c1", name: "Lahore Chapter", city: "Lahore", status: "active" }];
const members: TeamMember[] = [
  { id: "m1", fullName: "Amina Malik", email: "amina@x.org", status: "active", lastActiveLabel: "—", enforce2fa: true, expiresAt: null,
    assignments: [{ id: "a1", roleId: "r1", roleName: "Operations Lead", scopeKind: "chapter", chapterId: "c1", scopeLabel: "Lahore Chapter" }] },
  { id: "m2", fullName: "Usman Ghani", email: "usman@x.org", status: "invited", lastActiveLabel: "Invited (Pending Sign-in)", enforce2fa: true, expiresAt: null,
    assignments: [{ id: "a2", roleId: "r2", roleName: "Auditor", scopeKind: "org_wide", chapterId: null, scopeLabel: "National / All Chapters" }] },
];

describe("MembersTable", () => {
  it("renders role chips, scope pills, and computed effective permissions", () => {
    render(<MembersTable members={members} roles={roles} chapters={chapters} onEdit={vi.fn()} />);
    expect(screen.getByText("Amina Malik")).toBeInTheDocument();
    expect(screen.getByText("Lahore Chapter")).toBeInTheDocument();
    expect(screen.getByText("Create Drives")).toBeInTheDocument();
    expect(screen.getByText("Triage Apps")).toBeInTheDocument();
    expect(screen.getByText("View Hours (Read Only)")).toBeInTheDocument();
  });

  it("renders an Expired badge when the member's access has lapsed", () => {
    const expired: TeamMember[] = [
      { ...members[0], id: "m3", fullName: "Bilal Aziz", email: "bilal@x.org", status: "active",
        expiresAt: "2020-01-01T00:00:00Z" },
    ];
    render(<MembersTable members={expired} roles={roles} chapters={chapters} onEdit={vi.fn()} />);
    expect(screen.getByText("Expired")).toBeInTheDocument();
    expect(screen.queryByText("Active")).not.toBeInTheDocument();
  });

  it("filters by status", async () => {
    const user = userEvent.setup();
    render(<MembersTable members={members} roles={roles} chapters={chapters} onEdit={vi.fn()} />);
    await user.click(screen.getByLabelText("Status filter"));
    await user.click(screen.getByRole("option", { name: "Pending Invitation" }));
    expect(screen.queryByText("Amina Malik")).not.toBeInTheDocument();
    expect(screen.getByText("Usman Ghani")).toBeInTheDocument();
  });

  it("calls onEdit with the member id", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(<MembersTable members={members} roles={roles} chapters={chapters} onEdit={onEdit} />);
    await user.click(screen.getAllByRole("button", { name: /edit access/i })[0]);
    expect(onEdit).toHaveBeenCalledWith("m1");
  });
});

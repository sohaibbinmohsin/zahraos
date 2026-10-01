import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { RoleScopeRepeater, makeRoleScopeRow, rowsToAssignmentPayload, type RoleScopeRow } from "./RoleScopeRepeater";

const roles = [
  { id: "r0", name: "Super Admin", isSystem: true },
  { id: "r1", name: "Operations Lead", isSystem: true },
  { id: "r2", name: "Regional Logistics Lead", isSystem: false },
  { id: "r3", name: "Org Admin", isSystem: true },
];
const chapters = [{ id: "c1", name: "Lahore Chapter" }, { id: "c2", name: "Karachi Chapter" }];

describe("RoleScopeRepeater", () => {
  it("adds and removes rows and reports changes", async () => {
    const user = userEvent.setup();
    let rows: RoleScopeRow[] = [makeRoleScopeRow("r1")];
    const onChange = vi.fn((next: RoleScopeRow[]) => { rows = next; });
    const { rerender } = render(
      <RoleScopeRepeater rows={rows} roles={roles} chapters={chapters} onChange={onChange} addLabel="+ Add Role" />,
    );
    await user.click(screen.getByRole("button", { name: "+ Add Role" }));
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls.at(-1)![0]).toHaveLength(2);

    rerender(
      <RoleScopeRepeater rows={onChange.mock.calls.at(-1)![0]} roles={roles} chapters={chapters} onChange={onChange} addLabel="+ Add Role" />,
    );
    const removeButtons = screen.getAllByRole("button", { name: /remove/i });
    await user.click(removeButtons[0]);
    expect(onChange.mock.calls.at(-1)![0]).toHaveLength(1);
  });

  it("maps rows to an assignment payload with resolved scope labels", () => {
    const rows: RoleScopeRow[] = [
      { key: "k1", roleId: "r1", scopeKind: "org_wide", chapterId: null, scopeLabel: "National / All Chapters" },
      { key: "k2", roleId: "r2", scopeKind: "chapter", chapterId: "c1", scopeLabel: "Lahore Chapter" },
    ];
    expect(rowsToAssignmentPayload(rows)).toEqual([
      { roleId: "r1", scopeKind: "org_wide", chapterId: null, scopeLabel: "National / All Chapters" },
      { roleId: "r2", scopeKind: "chapter", chapterId: "c1", scopeLabel: "Lahore Chapter" },
    ]);
  });

  it("changes role selection using custom Select dropdown", async () => {
    const user = userEvent.setup();
    const rows: RoleScopeRow[] = [makeRoleScopeRow("r1")];
    const onChange = vi.fn();
    render(
      <RoleScopeRepeater rows={rows} roles={roles} chapters={chapters} onChange={onChange} addLabel="+ Add Role" />,
    );
    await user.click(screen.getByRole("combobox", { name: "Role" }));
    await user.click(screen.getByRole("option", { name: "Regional Logistics Lead (Custom)" }));
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ roleId: "r2" }),
    ]);
  });

  it("changes scope to a specific chapter and back to org_wide using custom Select dropdown", async () => {
    const user = userEvent.setup();
    let rows: RoleScopeRow[] = [makeRoleScopeRow("r1")];
    const onChange = vi.fn((next: RoleScopeRow[]) => { rows = next; });
    const { rerender } = render(
      <RoleScopeRepeater rows={rows} roles={roles} chapters={chapters} onChange={onChange} addLabel="+ Add Role" />,
    );
    await user.click(screen.getByRole("combobox", { name: "Scope" }));
    await user.click(screen.getByRole("option", { name: "Lahore Chapter" }));
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ scopeKind: "chapter", chapterId: "c1", scopeLabel: "Lahore Chapter" }),
    ]);

    rerender(
      <RoleScopeRepeater rows={onChange.mock.calls.at(-1)![0]} roles={roles} chapters={chapters} onChange={onChange} addLabel="+ Add Role" />,
    );
    await user.click(screen.getByRole("combobox", { name: "Scope" }));
    await user.click(screen.getByRole("option", { name: "National / All Chapters" }));
    expect(onChange).toHaveBeenLastCalledWith([
      expect.objectContaining({ scopeKind: "org_wide", chapterId: null, scopeLabel: "National / All Chapters" }),
    ]);
  });

  it("locks scope for Super Admin: hides scope dropdown, displays locked badge, and forces org_wide", async () => {
    const user = userEvent.setup();
    const rows: RoleScopeRow[] = [makeRoleScopeRow("r0")];
    const onChange = vi.fn();
    render(
      <RoleScopeRepeater rows={rows} roles={roles} chapters={chapters} onChange={onChange} addLabel="+ Add Role" />,
    );

    // Scope dropdown is NOT rendered
    expect(screen.queryByRole("combobox", { name: "Scope" })).not.toBeInTheDocument();
    // Locked badge is rendered
    expect(screen.getByText("National / All Chapters (Full Platform Access)")).toBeInTheDocument();
  });

  it("locks scope to org_wide when changing role to Super Admin", async () => {
    const user = userEvent.setup();
    const rows: RoleScopeRow[] = [
      { key: "k1", roleId: "r1", scopeKind: "chapter", chapterId: "c1", scopeLabel: "Lahore Chapter" },
    ];
    const onChange = vi.fn();
    render(
      <RoleScopeRepeater rows={rows} roles={roles} chapters={chapters} onChange={onChange} addLabel="+ Add Role" />,
    );

    await user.click(screen.getByRole("combobox", { name: "Role" }));
    await user.click(screen.getByRole("option", { name: "Super Admin" }));

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({
        roleId: "r0",
        scopeKind: "org_wide",
        chapterId: null,
        scopeLabel: "National / All Chapters",
      }),
    ]);
  });

  it("allows Org Admin to select either National or Chapter scopes", async () => {
    const user = userEvent.setup();
    let rows: RoleScopeRow[] = [makeRoleScopeRow("r3")];
    const onChange = vi.fn((next: RoleScopeRow[]) => { rows = next; });
    const { rerender } = render(
      <RoleScopeRepeater rows={rows} roles={roles} chapters={chapters} onChange={onChange} addLabel="+ Add Role" />,
    );

    // Scope dropdown IS rendered for Org Admin
    expect(screen.getByRole("combobox", { name: "Scope" })).toBeInTheDocument();
    await user.click(screen.getByRole("combobox", { name: "Scope" }));
    await user.click(screen.getByRole("option", { name: "Karachi Chapter" }));

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({
        roleId: "r3",
        scopeKind: "chapter",
        chapterId: "c2",
        scopeLabel: "Karachi Chapter",
      }),
    ]);

    rerender(
      <RoleScopeRepeater rows={onChange.mock.calls.at(-1)![0]} roles={roles} chapters={chapters} onChange={onChange} addLabel="+ Add Role" />,
    );
    await user.click(screen.getByRole("combobox", { name: "Scope" }));
    await user.click(screen.getByRole("option", { name: "National / All Chapters" }));

    expect(onChange).toHaveBeenLastCalledWith([
      expect.objectContaining({
        roleId: "r3",
        scopeKind: "org_wide",
        chapterId: null,
        scopeLabel: "National / All Chapters",
      }),
    ]);
  });
});

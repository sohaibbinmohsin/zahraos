import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import {
  RoleScopeRepeater,
  makeRoleScopeRow,
  rowsToAssignmentPayload,
  groupAssignmentsToRows,
  type RoleScopeRow,
} from "./RoleScopeRepeater";

const roles = [
  { id: "r0", name: "Super Admin", isSystem: true },
  { id: "r1", name: "Operations Lead", isSystem: true },
  { id: "r2", name: "Regional Logistics Lead", isSystem: false },
  { id: "r3", name: "Org Admin", isSystem: true },
];
const chapters = [
  { id: "c1", name: "Lahore Chapter" },
  { id: "c2", name: "Karachi Chapter" },
];

describe("RoleScopeRepeater", () => {
  it("adds and removes rows and reports changes", async () => {
    const user = userEvent.setup();
    let rows: RoleScopeRow[] = [makeRoleScopeRow("r1")];
    const onChange = vi.fn((next: RoleScopeRow[]) => {
      rows = next;
    });
    const { rerender } = render(
      <RoleScopeRepeater
        rows={rows}
        roles={roles}
        chapters={chapters}
        onChange={onChange}
        addLabel="+ Add Role"
      />,
    );
    await user.click(screen.getByRole("button", { name: "+ Add Role" }));
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls.at(-1)![0]).toHaveLength(2);

    rerender(
      <RoleScopeRepeater
        rows={onChange.mock.calls.at(-1)![0]}
        roles={roles}
        chapters={chapters}
        onChange={onChange}
        addLabel="+ Add Role"
      />,
    );
    const removeButtons = screen.getAllByRole("button", { name: /remove role/i });
    await user.click(removeButtons[0]);
    expect(onChange.mock.calls.at(-1)![0]).toHaveLength(1);
  });

  it("maps rows to an assignment payload with resolved scope labels", () => {
    const rows: RoleScopeRow[] = [
      {
        key: "k1",
        roleId: "r1",
        scopeKind: "org_wide",
        chapterIds: [],
        scopeLabel: "National / All Chapters",
      },
      {
        key: "k2",
        roleId: "r2",
        scopeKind: "chapter",
        chapterIds: ["c1"],
        scopeLabel: "Lahore Chapter",
      },
    ];
    expect(rowsToAssignmentPayload(rows, chapters)).toEqual([
      { roleId: "r1", scopeKind: "org_wide", chapterId: null, scopeLabel: "National / All Chapters" },
      { roleId: "r2", scopeKind: "chapter", chapterId: "c1", scopeLabel: "Lahore Chapter" },
    ]);
  });

  it("changes role selection using custom Select dropdown", async () => {
    const user = userEvent.setup();
    const rows: RoleScopeRow[] = [makeRoleScopeRow("r1")];
    const onChange = vi.fn();
    render(
      <RoleScopeRepeater
        rows={rows}
        roles={roles}
        chapters={chapters}
        onChange={onChange}
        addLabel="+ Add Role"
      />,
    );
    await user.click(screen.getByRole("combobox", { name: "Role" }));
    await user.click(screen.getByRole("option", { name: "Regional Logistics Lead (Custom)" }));
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ roleId: "r2" })]);
  });

  it("changes scope to specific chapters and back to org_wide using radio and chapter picker", async () => {
    const user = userEvent.setup();
    let rows: RoleScopeRow[] = [makeRoleScopeRow("r1")];
    const onChange = vi.fn((next: RoleScopeRow[]) => {
      rows = next;
    });
    const { rerender } = render(
      <RoleScopeRepeater
        rows={rows}
        roles={roles}
        chapters={chapters}
        onChange={onChange}
        addLabel="+ Add Role"
      />,
    );
    await user.click(screen.getByLabelText("Specific Chapters"));
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ scopeKind: "chapter", chapterIds: [] }),
    ]);

    rerender(
      <RoleScopeRepeater
        rows={onChange.mock.calls.at(-1)![0]}
        roles={roles}
        chapters={chapters}
        onChange={onChange}
        addLabel="+ Add Role"
      />,
    );
    await user.click(screen.getByRole("combobox", { name: "Add Chapter" }));
    await user.click(screen.getByRole("option", { name: "Lahore Chapter" }));
    expect(onChange).toHaveBeenLastCalledWith([
      expect.objectContaining({
        scopeKind: "chapter",
        chapterIds: ["c1"],
        scopeLabel: "Lahore Chapter",
      }),
    ]);

    rerender(
      <RoleScopeRepeater
        rows={onChange.mock.calls.at(-1)![0]}
        roles={roles}
        chapters={chapters}
        onChange={onChange}
        addLabel="+ Add Role"
      />,
    );
    await user.click(screen.getByLabelText(/All Chapters/i));
    expect(onChange).toHaveBeenLastCalledWith([
      expect.objectContaining({
        scopeKind: "org_wide",
        chapterIds: [],
        scopeLabel: "National / All Chapters",
      }),
    ]);
  });

  it("locks scope for Super Admin: hides scope radios/dropdown, displays locked badge, and forces org_wide", async () => {
    const rows: RoleScopeRow[] = [makeRoleScopeRow("r0")];
    const onChange = vi.fn();
    render(
      <RoleScopeRepeater
        rows={rows}
        roles={roles}
        chapters={chapters}
        onChange={onChange}
        addLabel="+ Add Role"
      />,
    );

    // Scope radios & Add Chapter combobox are NOT rendered
    expect(screen.queryByLabelText("Specific Chapters")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Add Chapter" })).not.toBeInTheDocument();
    // Locked badge is rendered
    expect(screen.getByText("National / All Chapters (Full Platform Access)")).toBeInTheDocument();
  });

  it("locks scope to org_wide when changing role to Super Admin", async () => {
    const user = userEvent.setup();
    const rows: RoleScopeRow[] = [
      {
        key: "k1",
        roleId: "r1",
        scopeKind: "chapter",
        chapterIds: ["c1"],
        scopeLabel: "Lahore Chapter",
      },
    ];
    const onChange = vi.fn();
    render(
      <RoleScopeRepeater
        rows={rows}
        roles={roles}
        chapters={chapters}
        onChange={onChange}
        addLabel="+ Add Role"
      />,
    );

    await user.click(screen.getByRole("combobox", { name: "Role" }));
    await user.click(screen.getByRole("option", { name: "Super Admin" }));

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({
        roleId: "r0",
        scopeKind: "org_wide",
        chapterIds: [],
        scopeLabel: "National / All Chapters",
      }),
    ]);
  });

  it("allows Org Admin to select either National or Chapter scopes", async () => {
    const user = userEvent.setup();
    let rows: RoleScopeRow[] = [makeRoleScopeRow("r3")];
    const onChange = vi.fn((next: RoleScopeRow[]) => {
      rows = next;
    });
    const { rerender } = render(
      <RoleScopeRepeater
        rows={rows}
        roles={roles}
        chapters={chapters}
        onChange={onChange}
        addLabel="+ Add Role"
      />,
    );

    // Scope radios ARE rendered for Org Admin
    expect(screen.getByLabelText("Specific Chapters")).toBeInTheDocument();
    await user.click(screen.getByLabelText("Specific Chapters"));

    rerender(
      <RoleScopeRepeater
        rows={onChange.mock.calls.at(-1)![0]}
        roles={roles}
        chapters={chapters}
        onChange={onChange}
        addLabel="+ Add Role"
      />,
    );

    expect(screen.getByRole("combobox", { name: "Add Chapter" })).toBeInTheDocument();
    await user.click(screen.getByRole("combobox", { name: "Add Chapter" }));
    await user.click(screen.getByRole("option", { name: "Karachi Chapter" }));

    expect(onChange).toHaveBeenLastCalledWith([
      expect.objectContaining({
        roleId: "r3",
        scopeKind: "chapter",
        chapterIds: ["c2"],
        scopeLabel: "Karachi Chapter",
      }),
    ]);

    rerender(
      <RoleScopeRepeater
        rows={onChange.mock.calls.at(-1)![0]}
        roles={roles}
        chapters={chapters}
        onChange={onChange}
        addLabel="+ Add Role"
      />,
    );
    await user.click(screen.getByLabelText(/All Chapters/i));

    expect(onChange).toHaveBeenLastCalledWith([
      expect.objectContaining({
        roleId: "r3",
        scopeKind: "org_wide",
        chapterIds: [],
        scopeLabel: "National / All Chapters",
      }),
    ]);
  });

  it("allows selecting multiple chapters via tag chips for a single role", async () => {
    const user = userEvent.setup();
    let rows: RoleScopeRow[] = [makeRoleScopeRow("r2")];
    const onChange = vi.fn((next: RoleScopeRow[]) => {
      rows = next;
    });
    const { rerender } = render(
      <RoleScopeRepeater
        rows={rows}
        roles={roles}
        chapters={chapters}
        onChange={onChange}
        addLabel="+ Add Role"
      />,
    );

    // Switch to Specific Chapters
    await user.click(screen.getByLabelText("Specific Chapters"));
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ scopeKind: "chapter", chapterIds: [] }),
    ]);

    rerender(
      <RoleScopeRepeater
        rows={onChange.mock.calls.at(-1)![0]}
        roles={roles}
        chapters={chapters}
        onChange={onChange}
        addLabel="+ Add Role"
      />,
    );

    // Add first chapter: Lahore Chapter
    await user.click(screen.getByRole("combobox", { name: "Add Chapter" }));
    await user.click(screen.getByRole("option", { name: "Lahore Chapter" }));

    expect(onChange).toHaveBeenLastCalledWith([
      expect.objectContaining({
        roleId: "r2",
        scopeKind: "chapter",
        chapterIds: ["c1"],
      }),
    ]);

    rerender(
      <RoleScopeRepeater
        rows={onChange.mock.calls.at(-1)![0]}
        roles={roles}
        chapters={chapters}
        onChange={onChange}
        addLabel="+ Add Role"
      />,
    );
    expect(screen.getByText("Lahore Chapter")).toBeInTheDocument();

    // Add second chapter: Karachi Chapter
    await user.click(screen.getByRole("combobox", { name: "Add Chapter" }));
    await user.click(screen.getByRole("option", { name: "Karachi Chapter" }));

    expect(onChange).toHaveBeenLastCalledWith([
      expect.objectContaining({
        roleId: "r2",
        scopeKind: "chapter",
        chapterIds: ["c1", "c2"],
      }),
    ]);

    const finalRows = onChange.mock.calls.at(-1)![0];
    const payload = rowsToAssignmentPayload(finalRows, chapters);
    expect(payload).toEqual([
      { roleId: "r2", scopeKind: "chapter", chapterId: "c1", scopeLabel: "Lahore Chapter" },
      { roleId: "r2", scopeKind: "chapter", chapterId: "c2", scopeLabel: "Karachi Chapter" },
    ]);
  });

  it("removes a chapter tag chip when ✕ is clicked", async () => {
    const user = userEvent.setup();
    let rows: RoleScopeRow[] = [
      {
        key: "k1",
        roleId: "r2",
        scopeKind: "chapter",
        chapterIds: ["c1", "c2"],
        scopeLabel: "Lahore Chapter, Karachi Chapter",
      },
    ];
    const onChange = vi.fn((next: RoleScopeRow[]) => {
      rows = next;
    });
    const { rerender } = render(
      <RoleScopeRepeater
        rows={rows}
        roles={roles}
        chapters={chapters}
        onChange={onChange}
        addLabel="+ Add Role"
      />,
    );

    expect(screen.getByText("Lahore Chapter")).toBeInTheDocument();
    expect(screen.getByText("Karachi Chapter")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Remove Lahore Chapter" }));
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({
        roleId: "r2",
        scopeKind: "chapter",
        chapterIds: ["c2"],
        scopeLabel: "Karachi Chapter",
      }),
    ]);

    rerender(
      <RoleScopeRepeater
        rows={onChange.mock.calls.at(-1)![0]}
        roles={roles}
        chapters={chapters}
        onChange={onChange}
        addLabel="+ Add Role"
      />,
    );
    expect(screen.queryByText("Lahore Chapter")).not.toBeInTheDocument();
    expect(screen.getByText("Karachi Chapter")).toBeInTheDocument();
  });

  it("groups multiple chapter assignments for the same role into a single row", () => {
    const assignments = [
      { id: "a1", roleId: "r2", scopeKind: "chapter" as const, chapterId: "c1", scopeLabel: "Lahore Chapter" },
      { id: "a2", roleId: "r2", scopeKind: "chapter" as const, chapterId: "c2", scopeLabel: "Karachi Chapter" },
      { id: "a3", roleId: "r1", scopeKind: "org_wide" as const, chapterId: null, scopeLabel: "National / All Chapters" },
    ];
    const grouped = groupAssignmentsToRows(assignments, chapters);
    expect(grouped).toHaveLength(2);
    expect(grouped[0]).toMatchObject({
      roleId: "r2",
      scopeKind: "chapter",
      chapterIds: ["c1", "c2"],
      scopeLabel: "Lahore Chapter, Karachi Chapter",
    });
    expect(grouped[1]).toMatchObject({
      roleId: "r1",
      scopeKind: "org_wide",
      chapterIds: [],
      scopeLabel: "National / All Chapters",
    });
  });

  it("handles rowsToAssignmentPayload with empty chapterIds", () => {
    const rows: RoleScopeRow[] = [
      { key: "k1", roleId: "r2", scopeKind: "chapter", chapterIds: [], scopeLabel: "Chapter" },
    ];
    expect(rowsToAssignmentPayload(rows, chapters)).toEqual([
      { roleId: "r2", scopeKind: "chapter", chapterId: null, scopeLabel: "Chapter" },
    ]);
  });
});

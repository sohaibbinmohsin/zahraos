import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { RoleScopeRepeater, makeRoleScopeRow, rowsToAssignmentPayload, type RoleScopeRow } from "./RoleScopeRepeater";

const roles = [
  { id: "r1", name: "Operations Lead", isSystem: true },
  { id: "r2", name: "Regional Logistics Lead", isSystem: false },
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
});

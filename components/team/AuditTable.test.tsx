import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { AuditTable, auditRowsToCsv, type AuditRow } from "./AuditTable";

const rows: AuditRow[] = [
  { id: "1", createdAt: "2026-02-28T17:42:00Z", actorName: "Sohaib Mohsin", action: "Role Created", summary: "Created new custom role 'Youth Ambassador Manager'", ip: "110.37.21.9", scopeLabel: "National" },
  { id: "2", createdAt: "2026-02-28T16:15:00Z", actorName: "Amina Malik", action: "Access Changed", summary: "Updated access for Fatima Noor", ip: "39.40.18.22", scopeLabel: "Lahore" },
];

describe("AuditTable", () => {
  it("renders rows and filters by action type", async () => {
    const user = userEvent.setup();
    render(<AuditTable rows={rows} />);
    expect(screen.getByText(/Youth Ambassador Manager/)).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Action type filter"), "Access Changed");
    expect(screen.queryByText(/Youth Ambassador Manager/)).not.toBeInTheDocument();
    expect(screen.getByText(/Updated access for Fatima Noor/)).toBeInTheDocument();
  });

  it("filters to a Chapter Created row when that option is selected", async () => {
    const user = userEvent.setup();
    const chapterRows: AuditRow[] = [
      { id: "3", createdAt: "2026-03-01T09:00:00Z", actorName: "Sohaib Mohsin", action: "Chapter Created", summary: "Created chapter 'Rizq LUMS'", ip: "110.37.21.9", scopeLabel: "Rizq LUMS" },
      { id: "4", createdAt: "2026-03-01T08:00:00Z", actorName: "Amina Malik", action: "Access Changed", summary: "Updated access for Fatima Noor", ip: "39.40.18.22", scopeLabel: "Lahore" },
    ];
    render(<AuditTable rows={chapterRows} />);
    await user.selectOptions(screen.getByLabelText("Action type filter"), "Chapter Created");
    expect(screen.getByText(/Created chapter 'Rizq LUMS'/)).toBeInTheDocument();
    expect(screen.queryByText(/Updated access for Fatima Noor/)).not.toBeInTheDocument();
  });

  it("serializes rows to CSV with a header line", () => {
    const csv = auditRowsToCsv(rows);
    expect(csv.split("\n")[0]).toBe("Timestamp,User,Action,Details,IP,Scope");
    expect(csv).toContain("Sohaib Mohsin");
  });
});

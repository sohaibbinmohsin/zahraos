import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { AuditTable, auditRowsToCsv, type AuditRow } from "./AuditTable";

const rows: AuditRow[] = [
  { id: "1", createdAt: "2026-02-28T17:42:00Z", actorName: "Sohaib Mohsin", action: "ROLE_CREATED", summary: "Created new custom role 'Youth Ambassador Manager'", ip: "110.37.21.9", scopeLabel: "National", module: "Team & Governance" },
  { id: "2", createdAt: "2026-02-28T16:15:00Z", actorName: "Amina Malik", action: "Access Changed", summary: "Updated access for Fatima Noor", ip: "39.40.18.22", scopeLabel: "Lahore", module: "Team & Governance" },
  { id: "3", createdAt: "2026-02-28T15:00:00Z", actorName: "Musa Amir", action: "opportunity_created", summary: "Created opportunity 'Flood Relief Drive'", ip: "110.37.21.10", scopeLabel: "Lahore Central", module: "Youth Republic" },
];

describe("AuditTable", () => {
  it("renders rows and formats actions in normal sentence/title case", () => {
    render(<AuditTable rows={rows} />);
    // "ROLE_CREATED" should be rendered in sentence/title case as "Role Created"
    expect(screen.getByText("Role Created")).toBeInTheDocument();
    // "opportunity_created" should be rendered as "Opportunity Created"
    expect(screen.getByText("Opportunity Created")).toBeInTheDocument();
    expect(screen.getByText("Access Changed")).toBeInTheDocument();
    // Verify module column badges exist
    expect(screen.getAllByText("Team & Governance").length).toBeGreaterThan(0);
    expect(screen.getByText("Youth Republic")).toBeInTheDocument();
  });

  it("filters rows by action type", async () => {
    const user = userEvent.setup();
    render(<AuditTable rows={rows} />);
    await user.click(screen.getByLabelText("Action type filter"));
    await user.click(screen.getByRole("option", { name: "Access Changed" }));
    expect(screen.queryByText(/Youth Ambassador Manager/)).not.toBeInTheDocument();
    expect(screen.getByText(/Updated access for Fatima Noor/)).toBeInTheDocument();
  });

  it("filters rows by module", async () => {
    const user = userEvent.setup();
    render(<AuditTable rows={rows} />);
    await user.click(screen.getByLabelText("Module filter"));
    await user.click(screen.getByRole("option", { name: "Youth Republic" }));
    expect(screen.getByText(/Flood Relief Drive/)).toBeInTheDocument();
    expect(screen.queryByText(/Youth Ambassador Manager/)).not.toBeInTheDocument();
  });

  it("filters to a Chapter Created row when that option is selected", async () => {
    const user = userEvent.setup();
    const chapterRows: AuditRow[] = [
      { id: "3", createdAt: "2026-03-01T09:00:00Z", actorName: "Sohaib Mohsin", action: "CHAPTER_CREATED", summary: "Created chapter 'Rizq LUMS'", ip: "110.37.21.9", scopeLabel: "Rizq LUMS", module: "Team & Governance" },
      { id: "4", createdAt: "2026-03-01T08:00:00Z", actorName: "Amina Malik", action: "Access Changed", summary: "Updated access for Fatima Noor", ip: "39.40.18.22", scopeLabel: "Lahore", module: "Team & Governance" },
    ];
    render(<AuditTable rows={chapterRows} />);
    await user.click(screen.getByLabelText("Action type filter"));
    await user.click(screen.getByRole("option", { name: "Chapter Created" }));
    expect(screen.getByText(/Created chapter 'Rizq LUMS'/)).toBeInTheDocument();
    expect(screen.queryByText(/Updated access for Fatima Noor/)).not.toBeInTheDocument();
  });

  it("serializes rows to CSV with module and header line", () => {
    const csv = auditRowsToCsv(rows);
    expect(csv.split("\n")[0]).toBe("Timestamp,Module,User,Action,Details,IP,Scope");
    expect(csv).toContain("Youth Republic");
    expect(csv).toContain("Sohaib Mohsin");
  });
});

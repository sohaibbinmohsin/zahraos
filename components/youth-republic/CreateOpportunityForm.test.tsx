import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CreateOpportunityForm } from "./CreateOpportunityForm";
import * as youthRepublicFunctions from "@/lib/youthRepublicFunctions";

vi.mock("@/lib/youthRepublicFunctions");

describe("CreateOpportunityForm", () => {
  beforeEach(() => {
    vi.mocked(youthRepublicFunctions.createOpportunity).mockReset();
  });

  it("submits name and type to createOpportunity with the staff token", async () => {
    vi.mocked(youthRepublicFunctions.createOpportunity).mockResolvedValue({ opportunityId: "opp-1" });
    const onCreated = vi.fn();
    const user = userEvent.setup();

    render(<CreateOpportunityForm organizationId="org-1" staffToken="staff-jwt" onCreated={onCreated} />);

    await user.type(screen.getByLabelText("Name"), "Beach Cleanup");
    await user.selectOptions(screen.getByLabelText("Type"), "environment");
    await user.click(screen.getByRole("button", { name: "Create opportunity" }));

    await waitFor(() => {
      expect(youthRepublicFunctions.createOpportunity).toHaveBeenCalledWith(
        { organizationId: "org-1", name: "Beach Cleanup", type: "environment" },
        "staff-jwt",
      );
      expect(onCreated).toHaveBeenCalled();
    });
  });
});

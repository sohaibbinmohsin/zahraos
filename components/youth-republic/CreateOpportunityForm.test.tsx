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

  it("saves as draft when clicking Save Draft on a new opportunity", async () => {
    vi.mocked(youthRepublicFunctions.createOpportunity).mockResolvedValue({ opportunityId: "opp-new" });
    vi.mocked(youthRepublicFunctions.updateOpportunity).mockResolvedValue({ opportunityId: "opp-new" });
    const onCreated = vi.fn();
    const user = userEvent.setup();

    render(<CreateOpportunityForm organizationId="org-1" staffToken="staff-jwt" onCreated={onCreated} />);

    await user.type(screen.getByLabelText("Name"), "Draft Food Drive");
    await user.click(screen.getByRole("button", { name: "Save Draft" }));

    await waitFor(() => {
      expect(youthRepublicFunctions.createOpportunity).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Draft Food Drive" }),
        "staff-jwt",
      );
      expect(youthRepublicFunctions.updateOpportunity).toHaveBeenCalledWith(
        expect.objectContaining({ opportunityId: "opp-new", statusOverride: "draft" }),
        "staff-jwt",
      );
      expect(onCreated).toHaveBeenCalled();
    });
  });

  it("renders Archive button to the left of Update Draft when opportunity is already live", async () => {
    window.confirm = vi.fn().mockReturnValue(true);
    vi.mocked(youthRepublicFunctions.updateOpportunity).mockResolvedValue({ opportunityId: "opp-live" });
    const onCreated = vi.fn();
    const user = userEvent.setup();

    render(
      <CreateOpportunityForm
        organizationId="org-1"
        staffToken="staff-jwt"
        onCreated={onCreated}
        initialOpportunity={{
          id: "opp-live",
          name: "Live Food Drive",
          type: "community",
          computedStatus: "open",
        }}
      />,
    );

    const archiveBtn = screen.getByRole("button", { name: "Archive" });
    const updateDraftBtn = screen.getByRole("button", { name: "Update Draft" });
    expect(archiveBtn).toBeInTheDocument();
    expect(updateDraftBtn).toBeInTheDocument();

    await user.click(archiveBtn);
    await waitFor(() => {
      expect(youthRepublicFunctions.updateOpportunity).toHaveBeenCalledWith(
        expect.objectContaining({ opportunityId: "opp-live", deactivatedAt: expect.any(String) }),
        "staff-jwt",
      );
      expect(onCreated).toHaveBeenCalled();
    });
  });
});

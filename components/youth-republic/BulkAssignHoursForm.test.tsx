import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BulkAssignHoursForm } from "./BulkAssignHoursForm";
import * as youthRepublicFunctions from "@/lib/youthRepublicFunctions";

vi.mock("@/lib/youthRepublicFunctions");

describe("BulkAssignHoursForm", () => {
  beforeEach(() => {
    vi.mocked(youthRepublicFunctions.bulkAssignHours).mockReset();
  });

  it("submits date, hours, and only the checked participants' ids to bulkAssignHours", async () => {
    vi.mocked(youthRepublicFunctions.bulkAssignHours).mockResolvedValue({ createdCount: 2 });
    const onAssigned = vi.fn();
    const user = userEvent.setup();

    render(
      <BulkAssignHoursForm
        organizationId="org-1"
        opportunityId="opp-1"
        participants={[
          { participationId: "p-1", volunteerName: "Aisha Khan" },
          { participationId: "p-2", volunteerName: "Bilal Ahmed" },
        ]}
        staffToken="staff-jwt"
        onAssigned={onAssigned}
      />,
    );

    await user.type(screen.getByLabelText("Activity date"), "2026-02-01");
    await user.type(screen.getByLabelText("Hours"), "3");
    await user.click(screen.getByLabelText("Aisha Khan"));
    await user.click(screen.getByRole("button", { name: "Bulk-assign hours" }));

    await waitFor(() => {
      expect(youthRepublicFunctions.bulkAssignHours).toHaveBeenCalledWith(
        { organizationId: "org-1", opportunityId: "opp-1", activityDate: "2026-02-01", hoursSubmitted: 3, participationIds: ["p-1"] },
        "staff-jwt",
      );
      expect(onAssigned).toHaveBeenCalled();
    });
  });
});

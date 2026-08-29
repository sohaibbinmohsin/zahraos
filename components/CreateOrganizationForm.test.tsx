import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CreateOrganizationForm } from "./CreateOrganizationForm";
import * as platformFunctions from "@/lib/platformFunctions";

vi.mock("@/lib/platformFunctions");

describe("CreateOrganizationForm", () => {
  beforeEach(() => {
    vi.mocked(platformFunctions.createOrganization).mockReset();
  });

  it("submits name and a slugified slug, then calls onCreated", async () => {
    vi.mocked(platformFunctions.createOrganization).mockResolvedValue({ organizationId: "org-1" });
    const onCreated = vi.fn();
    const user = userEvent.setup();

    render(<CreateOrganizationForm accessToken="session-token" onCreated={onCreated} />);

    await user.type(screen.getByLabelText("Organization name"), "Second Org");
    await user.click(screen.getByRole("button", { name: "Create organization" }));

    await waitFor(() => {
      expect(platformFunctions.createOrganization).toHaveBeenCalledWith(
        { name: "Second Org", slug: "second-org" },
        "session-token",
      );
      expect(onCreated).toHaveBeenCalled();
    });
  });
});

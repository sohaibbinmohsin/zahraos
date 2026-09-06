import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

const createCh = vi.fn().mockResolvedValue({ chapterId: "c9" });
const updateCh = vi.fn().mockResolvedValue({ chapterId: "c1" });
const refresh = vi.fn();
const showToast = vi.fn();
vi.mock("@/lib/youthRepublicFunctions", () => ({
  createChapter: (...a: unknown[]) => createCh(...a),
  updateChapter: (...a: unknown[]) => updateCh(...a),
}));
vi.mock("@/components/shell/ToastContext", () => ({ useToast: () => ({ showToast }) }));
vi.mock("@/components/team/TeamAccessProvider", () => ({
  useTeamAccess: () => ({
    organizationId: "org-1", staffToken: "staff-token", refresh,
    chapters: [{ id: "c1", name: "Lahore Chapter", city: "Lahore", status: "active" }],
  }),
}));

import { ChaptersPanel } from "./ChaptersPanel";

describe("ChaptersPanel", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists chapters and creates a new one", async () => {
    const user = userEvent.setup();
    render(<ChaptersPanel />);
    expect(screen.getByText("Lahore Chapter")).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Chapter name/i), "Multan Chapter");
    await user.type(screen.getByLabelText(/City/i), "Multan");
    await user.click(screen.getByRole("button", { name: /Add Chapter/i }));
    await waitFor(() => expect(createCh).toHaveBeenCalledWith(
      { organizationId: "org-1", name: "Multan Chapter", city: "Multan" }, "staff-token",
    ));
    expect(refresh).toHaveBeenCalled();
  });

  it("deactivates an active chapter", async () => {
    const user = userEvent.setup();
    render(<ChaptersPanel />);
    await user.click(screen.getByRole("button", { name: /Deactivate/i }));
    await waitFor(() => expect(updateCh).toHaveBeenCalledWith(
      { chapterId: "c1", organizationId: "org-1", status: "inactive" }, "staff-token",
    ));
  });
});

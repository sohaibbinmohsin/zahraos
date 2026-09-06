import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

const createCh = vi.fn();
const updateCh = vi.fn();
const showToast = vi.fn();
vi.mock("@/lib/platformFunctions", () => ({
  createChapter: (...a: unknown[]) => createCh(...a),
  updateChapter: (...a: unknown[]) => updateCh(...a),
}));
vi.mock("@/components/shell/ToastContext", () => ({ useToast: () => ({ showToast }) }));

import { ChaptersPanel } from "./ChaptersPanel";

const chapters = [{ id: "c1", name: "Lahore Chapter", city: "Lahore", status: "active" }];

function renderPanel(onChanged = vi.fn()) {
  render(
    <ChaptersPanel
      organizationId="org-1"
      accessToken="access-token"
      chapters={chapters}
      onChanged={onChanged}
    />,
  );
  return onChanged;
}

describe("ChaptersPanel", () => {
  beforeEach(() => vi.clearAllMocks());

  it("keeps the add form hidden until the Add Chapter button is clicked", async () => {
    const user = userEvent.setup();
    renderPanel();
    expect(screen.queryByLabelText(/Chapter name/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Add Chapter/i }));
    expect(screen.getByLabelText(/Chapter name/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByLabelText(/Chapter name/i)).not.toBeInTheDocument();
  });

  it("lists chapters and creates a new one", async () => {
    createCh.mockResolvedValue({ chapterId: "c9" });
    const user = userEvent.setup();
    const onChanged = renderPanel();
    expect(screen.getByText("Lahore Chapter")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Add Chapter/i }));
    await user.type(screen.getByLabelText(/Chapter name/i), "Multan Chapter");
    await user.type(screen.getByLabelText(/City/i), "Multan");
    await user.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(createCh).toHaveBeenCalledWith(
      { organizationId: "org-1", name: "Multan Chapter", city: "Multan" }, "access-token",
    ));
    expect(onChanged).toHaveBeenCalled();
    // form closes after a successful add
    await waitFor(() => expect(screen.queryByLabelText(/Chapter name/i)).not.toBeInTheDocument());
  });

  it("deactivates an active chapter", async () => {
    updateCh.mockResolvedValue({ chapterId: "c1" });
    const user = userEvent.setup();
    const onChanged = renderPanel();
    await user.click(screen.getByRole("button", { name: /Deactivate/i }));
    await waitFor(() => expect(updateCh).toHaveBeenCalledWith(
      { chapterId: "c1", status: "inactive" }, "access-token",
    ));
    expect(onChanged).toHaveBeenCalled();
  });

  it("shows a friendly toast when the chapter name is taken", async () => {
    createCh.mockRejectedValue(new Error("chapter_name_taken"));
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByRole("button", { name: /Add Chapter/i }));
    await user.type(screen.getByLabelText(/Chapter name/i), "Lahore Chapter");
    await user.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(showToast).toHaveBeenCalledWith(
      "A chapter with that name already exists.",
    ));
  });
});

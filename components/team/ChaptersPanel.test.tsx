import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

const createCh = vi.fn();
const updateCh = vi.fn();
const showToast = vi.fn();
vi.mock("@/lib/platformFunctions", () => ({
  createChapter: (...a: unknown[]) => createCh(...a),
  updateChapter: (...a: unknown[]) => updateCh(...a),
  listChapterTeamMembers: vi.fn().mockResolvedValue({ teamMembers: [] }),
  lookupYouthRepublicMember: vi.fn(),
}));
vi.mock("@/components/shell/ToastContext", () => ({ useToast: () => ({ showToast }) }));

let mockPerms = {
  canCreateChapters: true,
  canEditChapter: (_id: string) => true,
  canManageOrgProfile: true,
  canManageTeam: true,
  canViewInquiries: true,
  isChapterScoped: false,
};

vi.mock("@/components/shell/useStaffPermissions", () => ({
  useStaffPermissions: () => mockPerms,
}));

import { ChaptersPanel } from "./ChaptersPanel";

const chapters = [
  { id: "c1", name: "Lahore Chapter", city: "Lahore", status: "active" },
  { id: "c2", name: "Karachi Chapter", city: "Karachi", status: "active" },
];

function renderPanel(onChanged = vi.fn(), customChapters = chapters) {
  render(
    <ChaptersPanel
      organizationId="org-1"
      accessToken="access-token"
      chapters={customChapters}
      onChanged={onChanged}
    />,
  );
  return onChanged;
}

describe("ChaptersPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPerms = {
      canCreateChapters: true,
      canEditChapter: (_id: string) => true,
      canManageOrgProfile: true,
      canManageTeam: true,
      canViewInquiries: true,
      isChapterScoped: false,
    };
  });

  it("keeps the add form hidden until the Add Chapter button is clicked", async () => {
    const user = userEvent.setup();
    renderPanel();
    expect(screen.queryByLabelText(/Chapter name/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Add Chapter/i }));
    expect(screen.getByLabelText(/Chapter name/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByLabelText(/Chapter name/i)).not.toBeInTheDocument();
  });

  it("lists chapters and creates a new one when canCreateChapters is true", async () => {
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

  it("deactivates an active chapter when user can edit", async () => {
    updateCh.mockResolvedValue({ chapterId: "c1" });
    const user = userEvent.setup();
    const onChanged = renderPanel();
    const deactivateBtns = screen.getAllByRole("button", { name: /Deactivate/i });
    await user.click(deactivateBtns[0]);
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

  it("hides Add Chapter and shows Edit only for assigned chapter and View Details for others when chapter-scoped", () => {
    mockPerms = {
      canCreateChapters: false,
      canEditChapter: (id: string) => id === "c1",
      canManageOrgProfile: false,
      canManageTeam: true,
      canViewInquiries: false,
      isChapterScoped: true,
    };

    renderPanel();

    // Add chapter button must not be visible
    expect(screen.queryByRole("button", { name: /Add Chapter/i })).not.toBeInTheDocument();

    // Both chapters are visible (intra-org visibility)
    expect(screen.getByText("Lahore Chapter")).toBeInTheDocument();
    expect(screen.getByText("Karachi Chapter")).toBeInTheDocument();

    // Chapter c1 has Edit and Deactivate buttons
    expect(screen.getByRole("button", { name: /^Edit$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Deactivate/i })).toBeInTheDocument();

    // Chapter c2 has View Details button, but no Deactivate
    expect(screen.getByRole("button", { name: /View Details/i })).toBeInTheDocument();
  });

  it("opens EditChapterDrawer in edit mode when clicking Edit", async () => {
    const user = userEvent.setup();
    renderPanel();

    const editBtns = screen.getAllByRole("button", { name: /^Edit$/i });
    await user.click(editBtns[0]);

    // Drawer should open in Edit mode (drawer title is "Edit Chapter", not "Chapter Details")
    expect(screen.getByRole("heading", { name: /Edit Chapter/i })).toBeInTheDocument();
    expect(screen.queryByText(/View Details \(Read Only\)/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Save Chapter/i })).toBeInTheDocument();
  });

  it("opens EditChapterDrawer in read-only mode when clicking View Details", async () => {
    mockPerms = {
      canCreateChapters: false,
      canEditChapter: (id: string) => id === "c1",
      canManageOrgProfile: false,
      canManageTeam: true,
      canViewInquiries: false,
      isChapterScoped: true,
    };

    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole("button", { name: /View Details/i }));

    // Drawer should open in Read Only mode
    expect(screen.getByRole("heading", { name: /Chapter Details/i })).toBeInTheDocument();
    expect(screen.getByText(/View Details \(Read Only\)/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Save Chapter/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Close$/i })).toBeInTheDocument();
  });
});


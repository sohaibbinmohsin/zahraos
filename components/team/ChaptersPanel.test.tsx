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
    await user.type(screen.getByRole("textbox", { name: /^city$/i }), "Multan");
    await user.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(createCh).toHaveBeenCalledWith(
      { organizationId: "org-1", name: "Multan Chapter", city: "Multan" }, "access-token",
    ));
    expect(onChanged).toHaveBeenCalled();
    // form closes after a successful add
    await waitFor(() => expect(screen.queryByLabelText(/Chapter name/i)).not.toBeInTheDocument());
  });

  it("deactivates an active chapter when user can edit", async () => {
    updateCh.mockResolvedValue({ chapterId: "c2" });
    const user = userEvent.setup();
    const onChanged = renderPanel();
    const deactivateBtns = screen.getAllByRole("button", { name: /Deactivate/i });
    await user.click(deactivateBtns[0]);
    await waitFor(() => expect(updateCh).toHaveBeenCalledWith(
      { chapterId: "c2", status: "inactive" }, "access-token",
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
      "error",
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

    // Chapter c1 has Edit button, but no Deactivate button when chapter-scoped
    expect(screen.getByRole("button", { name: /^Edit$/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Deactivate/i })).not.toBeInTheDocument();

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

  it("sorts editable chapters to the top of the table", () => {
    mockPerms = {
      canCreateChapters: false,
      canEditChapter: (id: string) => id === "c2",
      canManageOrgProfile: false,
      canManageTeam: true,
      canViewInquiries: false,
      isChapterScoped: true,
    };

    renderPanel(vi.fn(), [
      { id: "c1", name: "Alpha Chapter", city: "Lahore", status: "active" },
      { id: "c2", name: "Beta Chapter", city: "Karachi", status: "active" },
    ]);

    const rows = screen.getAllByRole("row");
    // Row 0 is header; Row 1 should be Beta Chapter (editable); Row 2 should be Alpha Chapter (view only)
    expect(rows[1]).toHaveTextContent("Beta Chapter");
    expect(rows[1]).toHaveTextContent("Edit");
    expect(rows[2]).toHaveTextContent("Alpha Chapter");
    expect(rows[2]).toHaveTextContent("View Details");
  });

  it("filters chapters by name, city, and status", async () => {
    const user = userEvent.setup();
    renderPanel(vi.fn(), [
      { id: "c1", name: "Rizq Air University Chapter", city: "Islamabad", status: "active" },
      { id: "c2", name: "Rizq BAHRIA H11 Chapter", city: "Islamabad", status: "active" },
      { id: "c3", name: "Rizq LUMS Society", city: "Lahore", status: "inactive" },
    ]);

    expect(screen.queryByText(/Sub-divisions of the organization/i)).not.toBeInTheDocument();

    await user.type(screen.getByRole("searchbox", { name: /search chapters by name/i }), "bahria");
    expect(screen.getByText("Rizq BAHRIA H11 Chapter")).toBeInTheDocument();
    expect(screen.queryByText("Rizq Air University Chapter")).not.toBeInTheDocument();
    expect(screen.queryByText("Rizq LUMS Society")).not.toBeInTheDocument();

    await user.clear(screen.getByRole("searchbox", { name: /search chapters by name/i }));
    await user.click(screen.getByRole("combobox", { name: /filter chapters by city/i }));
    await user.click(screen.getByRole("option", { name: "Lahore" }));
    expect(screen.getByText("Rizq LUMS Society")).toBeInTheDocument();
    expect(screen.queryByText("Rizq Air University Chapter")).not.toBeInTheDocument();

    await user.click(screen.getByRole("combobox", { name: /filter chapters by city/i }));
    await user.click(screen.getByRole("option", { name: "All cities" }));
    await user.click(screen.getByRole("combobox", { name: /filter chapters by status/i }));
    await user.click(screen.getByRole("option", { name: "Inactive" }));
    expect(screen.getByText("Rizq LUMS Society")).toBeInTheDocument();
    expect(screen.queryByText("Rizq BAHRIA H11 Chapter")).not.toBeInTheDocument();
  });
});


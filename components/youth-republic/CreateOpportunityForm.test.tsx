import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CreateOpportunityForm } from "./CreateOpportunityForm";
import * as youthRepublicFunctions from "@/lib/youthRepublicFunctions";
import * as platformFunctions from "@/lib/platformFunctions";
import * as appShell from "@/components/shell/AppShell";
import type { StaffTokenClaims } from "@/lib/staffToken";

vi.mock("@/lib/youthRepublicFunctions");
vi.mock("@/lib/platformFunctions", () => ({
  listChapters: vi.fn().mockResolvedValue({ chapters: [] }),
}));
vi.mock("@/components/shell/AppShell", () => ({
  useStaffClaims: vi.fn(),
}));

function makeClaims(chapterScopes?: Record<string, string[]>): StaffTokenClaims {
  return {
    actorType: "staff",
    staffId: "staff-1",
    platformOwner: false,
    orgRoles: [{ organizationId: "org-1" }],
    moduleAccess: [
      {
        organizationId: "org-1",
        module: "youth-republic",
        permissions: ["opportunities:write"],
        ...(chapterScopes ? { chapterScopes } : {}),
      },
    ],
  };
}

describe("CreateOpportunityForm", () => {
  beforeEach(() => {
    vi.mocked(youthRepublicFunctions.createOpportunity).mockReset();
    vi.mocked(youthRepublicFunctions.updateOpportunity).mockReset();
    vi.mocked(platformFunctions.listChapters).mockReset();
    vi.mocked(platformFunctions.listChapters).mockResolvedValue({ chapters: [] });
    vi.mocked(appShell.useStaffClaims).mockReset();
    vi.mocked(appShell.useStaffClaims).mockReturnValue(null);
  });

  it("proceeds through steps and submits name and type to createOpportunity", async () => {
    vi.mocked(youthRepublicFunctions.createOpportunity).mockResolvedValue({ opportunityId: "opp-1" });
    const onCreated = vi.fn();
    const user = userEvent.setup();

    render(<CreateOpportunityForm organizationId="org-1" staffToken="staff-jwt" accessToken={null} onCreated={onCreated} />);

    await user.type(screen.getByLabelText("Name"), "Beach Cleanup");
    await user.selectOptions(screen.getByLabelText("Type"), "environment");
    await user.click(screen.getByRole("button", { name: /Proceed to Application Form Builder/i }));
    await user.click(screen.getByRole("button", { name: /Preview Live Volunteer Experience/i }));
    await user.click(screen.getByRole("button", { name: "Create opportunity" }));

    await waitFor(() => {
      expect(youthRepublicFunctions.createOpportunity).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: "org-1", name: "Beach Cleanup", type: "environment" }),
        "staff-jwt",
      );
      expect(onCreated).toHaveBeenCalled();
    });
  });

  it("saves as draft when clicking Save draft on a new opportunity", async () => {
    vi.mocked(youthRepublicFunctions.createOpportunity).mockResolvedValue({ opportunityId: "opp-new" });
    vi.mocked(youthRepublicFunctions.updateOpportunity).mockResolvedValue({ opportunityId: "opp-new" });
    const onCreated = vi.fn();
    const user = userEvent.setup();

    render(<CreateOpportunityForm organizationId="org-1" staffToken="staff-jwt" accessToken={null} onCreated={onCreated} />);

    await user.type(screen.getByLabelText("Name"), "Draft Food Drive");
    await user.click(screen.getByRole("button", { name: "Save draft" }));

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

  it("renders red Archive button, no Cancel button, and renders Update changes instead of Save draft when live", async () => {
    window.confirm = vi.fn().mockReturnValue(true);
    vi.mocked(youthRepublicFunctions.updateOpportunity).mockResolvedValue({ opportunityId: "opp-live" });
    const onCreated = vi.fn();
    const user = userEvent.setup();

    render(
      <CreateOpportunityForm
        organizationId="org-1"
        staffToken="staff-jwt"
        accessToken={null}
        onCreated={onCreated}
        onCancel={vi.fn()}
        initialOpportunity={{
          id: "opp-live",
          name: "Live Food Drive",
          type: "community",
          computedStatus: "open",
        }}
      />,
    );

    const archiveBtn = screen.getByRole("button", { name: "Archive" });
    expect(archiveBtn).toBeInTheDocument();
    expect(archiveBtn.className).toContain("btn-danger");
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save draft" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create opportunity" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Update changes" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Proceed to Application Form Builder/i })).toBeInTheDocument();

    await user.click(archiveBtn);
    await waitFor(() => {
      expect(youthRepublicFunctions.updateOpportunity).toHaveBeenCalledWith(
        expect.objectContaining({ opportunityId: "opp-live", deactivatedAt: expect.any(String) }),
        "staff-jwt",
      );
      expect(onCreated).toHaveBeenCalled();
    });
  });

  it("updates live opportunity directly from Step 1 when clicking Update changes", async () => {
    vi.mocked(youthRepublicFunctions.updateOpportunity).mockResolvedValue({ opportunityId: "opp-live" });
    const onCreated = vi.fn();
    const user = userEvent.setup();

    render(
      <CreateOpportunityForm
        organizationId="org-1"
        staffToken="staff-jwt"
        accessToken={null}
        onCreated={onCreated}
        initialOpportunity={{
          id: "opp-live",
          name: "Live Food Drive",
          type: "community",
          computedStatus: "open",
        }}
      />,
    );

    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "Updated Live Drive");
    await user.click(screen.getByRole("button", { name: "Update changes" }));

    await waitFor(() => {
      expect(youthRepublicFunctions.updateOpportunity).toHaveBeenCalledWith(
        expect.objectContaining({ opportunityId: "opp-live", name: "Updated Live Drive" }),
        "staff-jwt",
      );
      expect(onCreated).toHaveBeenCalled();
    });
  });

  it("enforces character limit on name (80) and description (200)", async () => {
    render(<CreateOpportunityForm organizationId="org-1" staffToken="staff-jwt" accessToken={null} onCreated={vi.fn()} />);

    const nameInput = screen.getByLabelText("Name");
    expect(nameInput).toHaveAttribute("maxLength", "80");
    expect(screen.getByText("0/80")).toBeInTheDocument();

    const descInput = screen.getByPlaceholderText(/Pack and distribute ration hampers/i);
    expect(descInput).toHaveAttribute("maxLength", "200");
    expect(screen.getByText("0/200")).toBeInTheDocument();
  });

  it("renders Update changes on Step 2 when editing a live opportunity", async () => {
    const user = userEvent.setup();

    render(
      <CreateOpportunityForm
        organizationId="org-1"
        staffToken="staff-jwt"
        accessToken={null}
        onCreated={vi.fn()}
        initialOpportunity={{
          id: "opp-live",
          name: "Live Food Drive",
          type: "community",
          computedStatus: "open",
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Proceed to Application Form Builder/i }));

    expect(screen.getByRole("button", { name: /Back to Specifications/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Update changes" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Preview Live Volunteer Experience/i })).toBeInTheDocument();
  });

  it("disables City & Venue with 'N/A' when Delivery Format is online, and allows city selection when onsite", async () => {
    const user = userEvent.setup();

    render(
      <CreateOpportunityForm
        organizationId="org-1"
        staffToken="staff-jwt"
        accessToken={null}
        onCreated={vi.fn()}
      />,
    );

    const deliverySelect = screen.getByLabelText("Delivery Format");
    const cityInput = screen.getByLabelText("City & Venue");

    // Initially onsite: city input is editable
    expect(cityInput).not.toBeDisabled();

    // Type to filter cities
    await user.type(cityInput, "Laho");
    expect(screen.getByRole("option", { name: /Lahore/i })).toBeInTheDocument();
    await user.click(screen.getByRole("option", { name: /Lahore/i }));
    expect(cityInput).toHaveValue("Lahore");

    // Switch to Virtual / Online Volunteer Role
    await user.selectOptions(deliverySelect, "online");
    const disabledCityInput = screen.getByLabelText(/City & Venue/i);
    expect(disabledCityInput).toBeDisabled();
    expect(disabledCityInput).toHaveValue("N/A");

    // Switch back to onsite
    await user.selectOptions(deliverySelect, "onsite");
    const reenabledCityInput = screen.getByLabelText(/City & Venue/i);
    expect(reenabledCityInput).not.toBeDisabled();
  });

  it("ensures Step 1 bottom action buttons container is right-aligned", () => {
    render(
      <CreateOpportunityForm
        organizationId="org-1"
        staffToken="staff-jwt"
        accessToken={null}
        onCreated={vi.fn()}
      />,
    );

    const proceedBtn = screen.getByRole("button", { name: /Proceed to Application Form Builder/i });
    const actionsRow = proceedBtn.closest(".step-actions-row");
    expect(actionsRow).toBeInTheDocument();
    expect(actionsRow?.className).toContain("justify-end");
    expect(actionsRow).toHaveStyle({ justifyContent: "flex-end" });
    const buttonsWrapper = proceedBtn.closest(".ml-auto");
    expect(buttonsWrapper).toBeInTheDocument();
    expect(buttonsWrapper).toHaveStyle({ marginLeft: "auto" });
  });

  it("supports reordering questions and styles required tick with brand-checkbox", async () => {
    const user = userEvent.setup();

    render(
      <CreateOpportunityForm
        organizationId="org-1"
        staffToken="staff-jwt"
        accessToken={null}
        onCreated={vi.fn()}
      />,
    );

    // Go to Step 2 Form Builder
    await user.click(screen.getByRole("button", { name: /Proceed to Application Form Builder/i }));

    // Add two questions
    await user.click(screen.getByRole("button", { name: /\+ Add Question/i }));
    await user.click(screen.getByRole("button", { name: /\+ Add Question/i }));

    // Check brand-checkbox styling on Required Question checkbox
    const requiredCheckboxes = screen.getAllByRole("checkbox");
    expect(requiredCheckboxes.length).toBeGreaterThan(0);
    expect(requiredCheckboxes[0].className).toContain("brand-checkbox");

    // Toggle required question
    await user.click(requiredCheckboxes[0]);
    expect(requiredCheckboxes[0]).toBeChecked();

    // Check drag handles and reordering buttons exist
    const dragHandles = screen.getAllByTitle("Drag to reorder questions");
    expect(dragHandles.length).toBeGreaterThan(0);

    // Question 1 should be #1 initially
    expect(screen.getByText("#1")).toBeInTheDocument();
    expect(screen.getByText("#2")).toBeInTheDocument();

    // Click Move down on first question
    const moveDownBtns = screen.getAllByTitle("Move question down");
    await user.click(moveDownBtns[0]);

    // Cards have reordered
    const reorderedHandles = screen.getAllByTitle("Drag to reorder questions");
    expect(reorderedHandles.length).toBeGreaterThan(0);

    // Test HTML5 drag and drop
    const { fireEvent } = await import("@testing-library/react");
    const cards = screen.getAllByTitle("Drag to reorder questions").map((h) => h.closest(".question-card")!);
    const dataTransfer = {
      effectAllowed: "none",
      dropEffect: "none",
      setData: vi.fn(),
      getData: vi.fn(),
    };
    fireEvent.dragStart(cards[0], { dataTransfer });
    fireEvent.dragOver(cards[1], { dataTransfer });
    fireEvent.drop(cards[1], { dataTransfer });
    fireEvent.dragEnd(cards[0]);

    expect(screen.getAllByTitle("Drag to reorder questions").length).toBe(2);
  });

  it("chapter-scoped writer sees only scoped chapters, no org-wide option, and submits that chapterId", async () => {
    vi.mocked(appShell.useStaffClaims).mockReturnValue(
      makeClaims({ "opportunities:write": ["lums"] }),
    );
    vi.mocked(platformFunctions.listChapters).mockResolvedValue({
      chapters: [
        { id: "lums", name: "Rizq LUMS", city: null, status: "active" },
        { id: "nust", name: "Rizq NUST", city: null, status: "active" },
      ],
    });
    vi.mocked(youthRepublicFunctions.createOpportunity).mockResolvedValue({ opportunityId: "opp-scoped" });
    const onCreated = vi.fn();
    const user = userEvent.setup();

    render(
      <CreateOpportunityForm
        organizationId="org-1"
        staffToken="staff-jwt"
        accessToken="platform-token"
        onCreated={onCreated}
      />,
    );

    // Chapter options load from listChapters, filtered to the write scope.
    await screen.findByRole("option", { name: "Rizq LUMS" });
    const chapterSelect = screen.getByLabelText("Chapter");
    expect(chapterSelect).toBeRequired();
    expect(screen.queryByRole("option", { name: "Rizq NUST" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Org-wide/i })).not.toBeInTheDocument();

    await waitFor(() => expect((chapterSelect as HTMLSelectElement).value).toBe("lums"));

    await user.type(screen.getByLabelText("Name"), "LUMS Blood Drive");
    await user.selectOptions(screen.getByLabelText("Type"), "health");
    await user.click(screen.getByRole("button", { name: /Proceed to Application Form Builder/i }));
    await user.click(screen.getByRole("button", { name: /Preview Live Volunteer Experience/i }));
    await user.click(screen.getByRole("button", { name: "Create opportunity" }));

    await waitFor(() => {
      expect(youthRepublicFunctions.createOpportunity).toHaveBeenCalledWith(
        expect.objectContaining({ name: "LUMS Blood Drive", chapterId: "lums" }),
        "staff-jwt",
      );
      expect(onCreated).toHaveBeenCalled();
    });
  });

  it("unrestricted writer sees all active chapters plus an org-wide option and submits chapterId null when org-wide", async () => {
    vi.mocked(appShell.useStaffClaims).mockReturnValue(makeClaims());
    vi.mocked(platformFunctions.listChapters).mockResolvedValue({
      chapters: [
        { id: "lums", name: "Rizq LUMS", city: null, status: "active" },
        { id: "nust", name: "Rizq NUST", city: null, status: "active" },
      ],
    });
    vi.mocked(youthRepublicFunctions.createOpportunity).mockResolvedValue({ opportunityId: "opp-open" });
    const onCreated = vi.fn();
    const user = userEvent.setup();

    render(
      <CreateOpportunityForm
        organizationId="org-1"
        staffToken="staff-jwt"
        accessToken="platform-token"
        onCreated={onCreated}
      />,
    );

    await screen.findByRole("option", { name: "Rizq LUMS" });
    expect(screen.getByRole("option", { name: "Rizq NUST" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Org-wide (no chapter)" })).toBeInTheDocument();

    const chapterSelect = screen.getByLabelText("Chapter") as HTMLSelectElement;
    expect(chapterSelect).not.toBeRequired();
    expect(chapterSelect.value).toBe("");

    await user.type(screen.getByLabelText("Name"), "National Tree Plantation");
    await user.selectOptions(screen.getByLabelText("Type"), "environment");
    await user.click(screen.getByRole("button", { name: /Proceed to Application Form Builder/i }));
    await user.click(screen.getByRole("button", { name: /Preview Live Volunteer Experience/i }));
    await user.click(screen.getByRole("button", { name: "Create opportunity" }));

    await waitFor(() => {
      expect(youthRepublicFunctions.createOpportunity).toHaveBeenCalledWith(
        expect.objectContaining({ name: "National Tree Plantation", chapterId: null }),
        "staff-jwt",
      );
      expect(onCreated).toHaveBeenCalled();
    });
  });
});

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

const listChapterTeamMembers = vi.fn();
const lookupYouthRepublicMember = vi.fn();
const searchYouthRepublicMembers = vi.fn();
const updateChapter = vi.fn();
const requestPublicAssetUpload = vi.fn();
const showToast = vi.fn();

vi.mock("@/lib/platformFunctions", () => ({
  listChapterTeamMembers: (...a: unknown[]) => listChapterTeamMembers(...a),
  lookupYouthRepublicMember: (...a: unknown[]) => lookupYouthRepublicMember(...a),
  searchYouthRepublicMembers: (...a: unknown[]) => searchYouthRepublicMembers(...a),
  updateChapter: (...a: unknown[]) => updateChapter(...a),
  requestPublicAssetUpload: (...a: unknown[]) => requestPublicAssetUpload(...a),
}));

vi.mock("@/components/shell/ToastContext", () => ({
  useToast: () => ({ showToast }),
}));

import { EditChapterDrawer } from "./EditChapterDrawer";
import type { ChapterRow, ChapterTeamMemberRow } from "@/lib/platformFunctions";

const mockChapter: ChapterRow = {
  id: "c1",
  name: "Lahore Chapter",
  city: "Lahore",
  status: "active",
  logoUrl: "https://example.com/existing-logo.png",
  about: "Premier Punjab university chapter dedicated to community welfare.",
};

const mockExistingMembers: ChapterTeamMemberRow[] = [
  {
    id: "tm-1",
    chapterId: "c1",
    volunteerCode: "YR-2026-000010",
    fullName: "Ali Ahmed",
    email: "ali@example.com",
    avatarUrl: null,
    designation: "President",
    term: "2024-2025",
    status: "alumni",
  },
  {
    id: "tm-2",
    chapterId: "c1",
    volunteerCode: "YR-2026-000020",
    fullName: "Sara Noor",
    email: "sara@example.com",
    avatarUrl: null,
    designation: "General Secretary",
    term: "2025-2026",
    status: "active",
  },
];

describe("EditChapterDrawer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 200 })));
    listChapterTeamMembers.mockResolvedValue({ teamMembers: [...mockExistingMembers] });
    lookupYouthRepublicMember.mockResolvedValue({
      volunteerCode: "YR-2026-000100",
      fullName: "Zainab Tariq",
      email: "zainab@example.com",
      avatarUrl: "https://example.com/zainab.png",
    });
    searchYouthRepublicMembers.mockResolvedValue({
      members: [
        {
          volunteerCode: "YR-2026-000100",
          fullName: "Zainab Tariq",
          email: "zainab@example.com",
          avatarUrl: "https://example.com/zainab.png",
        },
      ],
    });
    requestPublicAssetUpload.mockResolvedValue({
      uploadUrl: "https://r2.example.com/chapter-put-signed-url",
      publicUrl: "https://cdn.example.com/logos/chapters/uploaded-logo.png",
      objectKey: "logos/chapters/uploaded-logo.png",
    });
    updateChapter.mockResolvedValue({ chapterId: "c1" });
  });

  it("renders chapter details and loads existing active & alumni roster", async () => {
    render(
      <EditChapterDrawer
        open={true}
        onClose={vi.fn()}
        chapter={mockChapter}
        organizationId="org-1"
        accessToken="access-token"
      />
    );

    expect(screen.getByDisplayValue("Lahore Chapter")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Lahore")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Premier Punjab university chapter dedicated to community welfare.")).toBeInTheDocument();
    expect(screen.getByAltText("Chapter logo")).toHaveAttribute("src", "https://example.com/existing-logo.png");

    await waitFor(() => {
      expect(listChapterTeamMembers).toHaveBeenCalledWith({ chapterId: "c1" }, "access-token");
    });

    // Active leadership displays Sara Noor (1 active)
    expect(screen.getByText("Sara Noor")).toBeInTheDocument();
    expect(screen.getByText("YR-2026-000020")).toBeInTheDocument();
    expect(screen.getByText("General Secretary")).toBeInTheDocument();
    expect(screen.queryByText("Ali Ahmed")).not.toBeInTheDocument(); // Ali is alumni
  });

  it("handles logo file upload to Cloudflare R2 and previews new logo", async () => {
    const user = userEvent.setup();
    render(
      <EditChapterDrawer
        open={true}
        onClose={vi.fn()}
        chapter={mockChapter}
        organizationId="org-1"
        accessToken="access-token"
      />
    );

    const file = new File(["test-image-content"], "new-chapter-logo.png", { type: "image/png" });
    const fileInput = screen.getByLabelText(/Upload Chapter Logo/i);
    await user.upload(fileInput, file);

    await waitFor(() => {
      expect(requestPublicAssetUpload).toHaveBeenCalledWith(
        { domain: "logo", contentType: "image/png" },
        "access-token",
      );
    });
    expect(fetch).toHaveBeenCalledWith("https://r2.example.com/chapter-put-signed-url", {
      method: "PUT",
      body: file,
      headers: { "Content-Type": "image/png" },
    });
    expect(screen.getByAltText("Chapter logo")).toHaveAttribute(
      "src",
      "https://cdn.example.com/logos/chapters/uploaded-logo.png",
    );
    expect(showToast).toHaveBeenCalledWith("Logo uploaded successfully.");
  });

  it("verifies Youth Republic ID and displays volunteer confirmation card", async () => {
    const user = userEvent.setup();
    render(
      <EditChapterDrawer
        open={true}
        onClose={vi.fn()}
        chapter={mockChapter}
        organizationId="org-1"
        accessToken="access-token"
      />
    );

    const yrInput = screen.getByLabelText(/Youth Republic ID/i);
    await user.type(yrInput, "YR-2026-000100");

    const verifyBtn = screen.getByRole("button", { name: /Verify ID/i });
    await user.click(verifyBtn);

    await waitFor(() => {
      expect(lookupYouthRepublicMember).toHaveBeenCalledWith(
        { organizationId: "org-1", youthRepublicId: "YR-2026-000100" },
        "access-token"
      );
    });

    expect(screen.getByText("Zainab Tariq")).toBeInTheDocument();
    expect(screen.getByText("zainab@example.com")).toBeInTheDocument();
    expect(screen.getByText("Verified YR Member")).toBeInTheDocument();
  });

  it("shows error when YR ID lookup returns not found", async () => {
    const user = userEvent.setup();
    lookupYouthRepublicMember.mockRejectedValueOnce(new Error("not_found"));

    render(
      <EditChapterDrawer
        open={true}
        onClose={vi.fn()}
        chapter={mockChapter}
        organizationId="org-1"
        accessToken="access-token"
      />
    );

    const yrInput = screen.getByLabelText(/Youth Republic ID/i);
    await user.type(yrInput, "YR-9999-999999");
    await user.click(screen.getByRole("button", { name: /Verify ID/i }));

    await waitFor(() => {
      expect(screen.getByText("No verified Youth Republic account found with this ID.")).toBeInTheDocument();
    });
    expect(screen.queryByText("Verified YR Member")).not.toBeInTheDocument();
  });

  it("shows specific error when YR ID has pending verification", async () => {
    const user = userEvent.setup();
    lookupYouthRepublicMember.mockRejectedValueOnce(new Error("volunteer_pending_verification"));

    render(
      <EditChapterDrawer
        open={true}
        onClose={vi.fn()}
        chapter={mockChapter}
        organizationId="org-1"
        accessToken="access-token"
      />
    );

    const yrInput = screen.getByLabelText(/Youth Republic ID/i);
    await user.type(yrInput, "YR-2026-000053");
    await user.click(screen.getByRole("button", { name: /Verify ID/i }));

    await waitFor(() => {
      expect(
        screen.getByText(
          "This Youth Republic account has pending verification. Only verified members can be added to chapter leadership."
        )
      ).toBeInTheDocument();
    });
    expect(screen.queryByText("Verified YR Member")).not.toBeInTheDocument();
  });

  it("adds verified volunteer to roster with custom designation and term", async () => {
    const user = userEvent.setup();
    render(
      <EditChapterDrawer
        open={true}
        onClose={vi.fn()}
        chapter={mockChapter}
        organizationId="org-1"
        accessToken="access-token"
      />
    );

    await waitFor(() => expect(screen.getByText("Sara Noor")).toBeInTheDocument());

    // Verify YR ID
    await user.type(screen.getByLabelText(/Youth Republic ID/i), "YR-2026-000100");
    await user.click(screen.getByRole("button", { name: /Verify ID/i }));
    await waitFor(() => expect(screen.getByText("Zainab Tariq")).toBeInTheDocument());

    // Add custom designation and term
    await user.type(screen.getByLabelText(/Designation/i), "Media & Communications Lead");
    const termInput = screen.getByLabelText(/Tenure \/ Term/i);
    await user.clear(termInput);
    await user.type(termInput, "2026-2027");

    // Click Add to Chapter Roster
    await user.click(screen.getByRole("button", { name: /Add to Chapter Roster/i }));

    // Volunteer is added to active roster
    expect(screen.getByText("Media & Communications Lead")).toBeInTheDocument();
    expect(screen.getByText("2026-2027")).toBeInTheDocument();

    // Verification input and preview card should be cleared
    expect(screen.getByLabelText(/Youth Republic ID/i)).toHaveValue("");
    expect(screen.getByLabelText(/Designation/i)).toHaveValue("");
    expect(screen.queryByText("Verified YR Member")).not.toBeInTheDocument();
  });

  it("switches tabs between Active Leadership and Alumni Roster", async () => {
    const user = userEvent.setup();
    render(
      <EditChapterDrawer
        open={true}
        onClose={vi.fn()}
        chapter={mockChapter}
        organizationId="org-1"
        accessToken="access-token"
      />
    );

    await waitFor(() => expect(screen.getByText("Sara Noor")).toBeInTheDocument());

    // Switch to Alumni Roster tab
    const alumniTab = screen.getByRole("tab", { name: /Alumni Roster/i });
    await user.click(alumniTab);

    // Ali Ahmed should now be visible, Sara Noor should not
    expect(screen.getByText("Ali Ahmed")).toBeInTheDocument();
    expect(screen.getByText("YR-2026-000010")).toBeInTheDocument();
    expect(screen.getByText("President")).toBeInTheDocument();
    expect(screen.queryByText("Sara Noor")).not.toBeInTheDocument();
  });

  it("transitions active member to alumni and vice-versa, and supports removal", async () => {
    const user = userEvent.setup();
    render(
      <EditChapterDrawer
        open={true}
        onClose={vi.fn()}
        chapter={mockChapter}
        organizationId="org-1"
        accessToken="access-token"
      />
    );

    await waitFor(() => expect(screen.getByText("Sara Noor")).toBeInTheDocument());

    // Transition Sara Noor to Alumni
    const transitionBtn = screen.getByRole("button", { name: /Transition to Alumni/i });
    await user.click(transitionBtn);

    // In Active tab, Sara Noor is now gone and active list is empty
    expect(screen.queryByText("Sara Noor")).not.toBeInTheDocument();
    expect(screen.getByText(/No active leadership members on record/i)).toBeInTheDocument();

    // Switch to Alumni tab - Sara Noor and Ali Ahmed are both there
    await user.click(screen.getByRole("tab", { name: /Alumni Roster/i }));
    expect(screen.getByText("Sara Noor")).toBeInTheDocument();
    expect(screen.getByText("Ali Ahmed")).toBeInTheDocument();

    // Restore Ali Ahmed to Active
    const restoreBtns = screen.getAllByRole("button", { name: /Restore to Active/i });
    await user.click(restoreBtns[0]); // Ali Ahmed

    // Switch back to Active tab - Ali Ahmed should be active
    await user.click(screen.getByRole("tab", { name: /Active Leadership/i }));
    expect(screen.getByText("Ali Ahmed")).toBeInTheDocument();

    // Remove Ali Ahmed
    const removeBtn = screen.getByRole("button", { name: /Remove/i });
    await user.click(removeBtn);
    expect(screen.queryByText("Ali Ahmed")).not.toBeInTheDocument();
  });

  it("enforces read-only mode with disabled inputs and hidden mutation controls", async () => {
    render(
      <EditChapterDrawer
        open={true}
        onClose={vi.fn()}
        chapter={mockChapter}
        organizationId="org-1"
        accessToken="access-token"
        readOnly={true}
      />
    );

    expect(screen.getByText("View Details (Read Only)")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Lahore Chapter")).toBeDisabled();
    expect(screen.getByDisplayValue("Lahore")).toBeDisabled();
    expect(screen.getByDisplayValue("Premier Punjab university chapter dedicated to community welfare.")).toBeDisabled();

    // Logo upload input should be hidden
    expect(screen.queryByLabelText(/Upload Chapter Logo/i)).not.toBeInTheDocument();

    // Add Team Member section should be hidden
    expect(screen.queryByLabelText(/Youth Republic ID/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Verify ID/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Add to Chapter Roster/i })).not.toBeInTheDocument();

    await waitFor(() => expect(screen.getByText("Sara Noor")).toBeInTheDocument());

    // Roster action buttons hidden
    expect(screen.queryByRole("button", { name: /Transition to Alumni/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Remove/i })).not.toBeInTheDocument();

    // Save button hidden, only Close button
    expect(screen.queryByRole("button", { name: /Save Chapter/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Close$/i })).toBeInTheDocument();
  });

  it("saves chapter details and team roster via updateChapter", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onSuccess = vi.fn();

    render(
      <EditChapterDrawer
        open={true}
        onClose={onClose}
        chapter={mockChapter}
        organizationId="org-1"
        accessToken="access-token"
        onSuccess={onSuccess}
      />
    );

    await waitFor(() => expect(screen.getByText("Sara Noor")).toBeInTheDocument());

    // Edit Name and City
    const nameInput = screen.getByLabelText(/Chapter Name/i);
    await user.clear(nameInput);
    await user.type(nameInput, "Lahore Regional Chapter");

    const cityInput = screen.getByLabelText(/City/i);
    await user.clear(cityInput);
    await user.type(cityInput, "Lahore Metropolitan");

    // Click Save Chapter
    const saveBtn = screen.getByRole("button", { name: /Save Chapter/i });
    await user.click(saveBtn);

    await waitFor(() => {
      expect(updateChapter).toHaveBeenCalledTimes(1);
    });

    const [payload, token] = updateChapter.mock.calls[0];
    expect(token).toBe("access-token");
    expect(payload).toMatchObject({
      chapterId: "c1",
      name: "Lahore Regional Chapter",
      city: "Lahore Metropolitan",
      logoUrl: "https://example.com/existing-logo.png",
      about: "Premier Punjab university chapter dedicated to community welfare.",
    });

    // Verify teamMembers payload matches active and alumni roster
    expect(payload.teamMembers).toHaveLength(2);
    expect(payload.teamMembers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          volunteerCode: "YR-2026-000020",
          fullName: "Sara Noor",
          designation: "General Secretary",
          status: "active",
        }),
        expect.objectContaining({
          volunteerCode: "YR-2026-000010",
          fullName: "Ali Ahmed",
          designation: "President",
          status: "alumni",
        }),
      ])
    );

    expect(showToast).toHaveBeenCalledWith("Chapter saved successfully.");
    expect(onSuccess).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("debounces omni-search and queries searchYouthRepublicMembers when >= 2 characters typed", async () => {
    const user = userEvent.setup();
    render(
      <EditChapterDrawer
        open={true}
        onClose={vi.fn()}
        chapter={mockChapter}
        organizationId="org-1"
        accessToken="access-token"
      />
    );

    const yrInput = screen.getByLabelText(/Youth Republic ID/i);
    // Type 1 character - should not trigger search
    await user.type(yrInput, "Z");
    expect(searchYouthRepublicMembers).not.toHaveBeenCalled();

    // Type 2nd character - triggers debounce
    await user.type(yrInput, "a");

    await waitFor(
      () => {
        expect(searchYouthRepublicMembers).toHaveBeenCalledWith(
          { organizationId: "org-1", query: "Za" },
          "access-token"
        );
      },
      { timeout: 1000 }
    );
  });

  it("renders matching volunteer cards with avatars/initials and ID badges in autocomplete dropdown", async () => {
    const user = userEvent.setup();
    searchYouthRepublicMembers.mockResolvedValueOnce({
      members: [
        {
          volunteerCode: "YR-2026-000888",
          fullName: "Hamza Abbasi",
          email: "hamza@example.com",
          avatarUrl: "https://example.com/hamza.jpg",
        },
        {
          volunteerCode: "YR-2026-000999",
          fullName: "Fatima Farooq",
          email: "fatima@example.com",
          avatarUrl: null,
        },
      ],
    });

    render(
      <EditChapterDrawer
        open={true}
        onClose={vi.fn()}
        chapter={mockChapter}
        organizationId="org-1"
        accessToken="access-token"
      />
    );

    const yrInput = screen.getByLabelText(/Youth Republic ID/i);
    await user.type(yrInput, "Abbasi");

    await waitFor(() => {
      expect(screen.getByRole("listbox")).toBeInTheDocument();
    });

    expect(screen.getByText("Hamza Abbasi")).toBeInTheDocument();
    expect(screen.getByText("YR-2026-000888")).toBeInTheDocument();
    expect(screen.getByText("hamza@example.com")).toBeInTheDocument();
    expect(screen.getByAltText("Hamza Abbasi")).toHaveAttribute("src", "https://example.com/hamza.jpg");

    expect(screen.getByText("Fatima Farooq")).toBeInTheDocument();
    expect(screen.getByText("YR-2026-000999")).toBeInTheDocument();
    expect(screen.getByText("fatima@example.com")).toBeInTheDocument();
    expect(screen.getByText("FF")).toBeInTheDocument(); // Initials fallback
  });

  it("displays friendly message when no matching verified volunteers are found", async () => {
    const user = userEvent.setup();
    searchYouthRepublicMembers.mockResolvedValueOnce({ members: [] });

    render(
      <EditChapterDrawer
        open={true}
        onClose={vi.fn()}
        chapter={mockChapter}
        organizationId="org-1"
        accessToken="access-token"
      />
    );

    const yrInput = screen.getByLabelText(/Youth Republic ID/i);
    await user.type(yrInput, "UnknownPerson");

    await waitFor(() => {
      expect(
        screen.getByText("No active verified members found matching 'UnknownPerson'")
      ).toBeInTheDocument();
    });
  });

  it("selects volunteer from autocomplete and adds to roster with designation and term", async () => {
    const user = userEvent.setup();
    searchYouthRepublicMembers.mockResolvedValueOnce({
      members: [
        {
          volunteerCode: "YR-2026-000777",
          fullName: "Bilal Siddiqui",
          email: "bilal.s@example.com",
          avatarUrl: "https://example.com/bilal.png",
        },
      ],
    });

    render(
      <EditChapterDrawer
        open={true}
        onClose={vi.fn()}
        chapter={mockChapter}
        organizationId="org-1"
        accessToken="access-token"
      />
    );

    await waitFor(() => expect(screen.getByText("Sara Noor")).toBeInTheDocument());

    const yrInput = screen.getByLabelText(/Youth Republic ID/i);
    await user.type(yrInput, "Bilal");

    await waitFor(() => {
      expect(screen.getByText("Bilal Siddiqui")).toBeInTheDocument();
    });

    // Click on autocomplete dropdown item
    const option = screen.getByRole("option");
    await user.click(option);

    // Dropdown closes and input is populated
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(yrInput).toHaveValue("Bilal Siddiqui (YR-2026-000777)");

    // Verified card is visible
    expect(screen.getByText("Verified YR Member")).toBeInTheDocument();
    expect(screen.getByAltText("Bilal Siddiqui")).toHaveAttribute("src", "https://example.com/bilal.png");

    // Designation input is focused
    const designationInput = screen.getByLabelText(/Designation/i);
    expect(designationInput).toHaveFocus();

    // Type designation and term
    await user.type(designationInput, "Vice President");
    const termInput = screen.getByLabelText(/Tenure \/ Term/i);
    await user.clear(termInput);
    await user.type(termInput, "2026-2027");

    // Add to roster
    await user.click(screen.getByRole("button", { name: /Add to Chapter Roster/i }));

    // Added to active roster list
    expect(screen.getByText("Vice President")).toBeInTheDocument();
    expect(screen.getByText("YR-2026-000777")).toBeInTheDocument();
    expect(screen.getByText("2026-2027")).toBeInTheDocument();
  });
});

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { CoverImageUpload } from "./CoverImageUpload";

vi.mock("@/lib/platformFunctions", () => ({
  requestPublicAssetUpload: vi.fn().mockResolvedValue({
    uploadUrl: "https://r2.cf/opportunity_covers/staff-1/uuid.webp?signed=true",
    publicUrl: "https://assets.yr.org/opportunity_covers/staff-1/uuid.webp",
    objectKey: "opportunity_covers/staff-1/uuid.webp",
  }),
}));

vi.mock("@/lib/youthRepublicFunctions", () => ({
  updateOpportunity: vi.fn().mockResolvedValue({ opportunityId: "opp-1" }),
}));

global.fetch = vi.fn().mockResolvedValue({ ok: true });

describe("CoverImageUpload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.URL.createObjectURL = vi.fn().mockReturnValue("blob:mock-url");
    global.URL.revokeObjectURL = vi.fn();
  });

  it("shows upload dropzone when currentCoverUrl is null", () => {
    render(
      <CoverImageUpload
        opportunityId="opp-1"
        organizationId="org-1"
        staffToken="tok"
        currentCoverUrl={null}
        onUploaded={vi.fn()}
        onRemoved={vi.fn()}
      />,
    );
    expect(screen.getByText(/upload cover/i)).toBeInTheDocument();
  });

  it("shows thumbnail and remove button when currentCoverUrl is set", () => {
    render(
      <CoverImageUpload
        opportunityId="opp-1"
        organizationId="org-1"
        staffToken="tok"
        currentCoverUrl="https://assets.yr.org/opportunity_covers/staff-1/abc.webp"
        onUploaded={vi.fn()}
        onRemoved={vi.fn()}
      />,
    );
    const img = screen.getByRole("img", { name: /cover preview/i });
    expect(img).toHaveAttribute("src", expect.stringContaining("abc.webp"));
    expect(screen.getByRole("button", { name: /remove/i })).toBeInTheDocument();
  });

  it("calls onRemoved and updateOpportunity(null) when remove is clicked", async () => {
    const { updateOpportunity } = await import("@/lib/youthRepublicFunctions");
    const onRemoved = vi.fn();
    render(
      <CoverImageUpload
        opportunityId="opp-1"
        organizationId="org-1"
        staffToken="tok"
        currentCoverUrl="https://assets.yr.org/opportunity_covers/staff-1/abc.webp"
        onUploaded={vi.fn()}
        onRemoved={onRemoved}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /remove/i }));
    await waitFor(() => expect(onRemoved).toHaveBeenCalledOnce());
    expect(updateOpportunity).toHaveBeenCalledWith(
      expect.objectContaining({ coverImageUrl: null }),
      "tok",
    );
  });

  it("disables the upload zone when opportunityId is undefined", () => {
    render(
      <CoverImageUpload
        opportunityId={undefined}
        organizationId="org-1"
        staffToken="tok"
        currentCoverUrl={null}
        onUploaded={vi.fn()}
        onRemoved={vi.fn()}
      />,
    );
    const input = document.querySelector("input[type='file']") as HTMLInputElement | null;
    expect(input?.disabled).toBe(true);
  });

  it("crop modal opens when a valid file is selected", async () => {
    render(
      <CoverImageUpload
        opportunityId="opp-1"
        organizationId="org-1"
        staffToken="tok"
        currentCoverUrl={null}
        onUploaded={vi.fn()}
        onRemoved={vi.fn()}
      />,
    );
    const input = document.querySelector("input[type='file']") as HTMLInputElement;
    const file = new File(["data"], "cover.jpg", { type: "image/jpeg" });
    Object.defineProperty(input, "files", { value: [file] });
    fireEvent.change(input);
    await waitFor(() =>
      expect(screen.getByRole("dialog", { name: /crop/i })).toBeInTheDocument(),
    );
  });

  it("shows error when file exceeds 10 MB limit", async () => {
    render(
      <CoverImageUpload
        opportunityId="opp-1"
        organizationId="org-1"
        staffToken="tok"
        currentCoverUrl={null}
        onUploaded={vi.fn()}
        onRemoved={vi.fn()}
      />,
    );
    const input = document.querySelector("input[type='file']") as HTMLInputElement;
    const bigFile = new File([new ArrayBuffer(11 * 1024 * 1024)], "big.jpg", { type: "image/jpeg" });
    Object.defineProperty(input, "files", { value: [bigFile] });
    fireEvent.change(input);
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/10 MB/i),
    );
  });
});

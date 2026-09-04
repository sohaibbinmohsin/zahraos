import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { VolunteerApplyPreview } from "./VolunteerApplyPreview";
import type { FormDefinition } from "@/lib/forms";

const form: FormDefinition = {
  version: 1,
  fields: [
    { id: "why", type: "long_text", label: "Why do you want to volunteer?", required: true },
    { id: "shift", type: "radio", label: "Preferred shift", options: [
      { value: "am", label: "Morning" }, { value: "pm", label: "Evening" },
    ] },
    { id: "days", type: "multiselect", label: "Which days?", options: [
      { value: "sat", label: "Saturday" }, { value: "sun", label: "Sunday" },
    ] },
    { id: "cv", type: "file", label: "Upload your CV", maxFiles: 1, maxSizeMB: 5 },
    { id: "consent", type: "checkbox", label: "I confirm my details are accurate.", required: true },
  ],
};

describe("VolunteerApplyPreview", () => {
  it("renders the opportunity header and the form in the volunteer visual language", () => {
    render(
      <VolunteerApplyPreview
        opportunity={{
          name: "Ramadan Food Drive",
          type: "community",
          city: "Lahore",
          description: "Pack and distribute ration hampers.",
          about: "Evening shift 5-8pm.",
          capacity: 60,
          orgName: "Rizq",
        }}
        form={form}
      />,
    );

    // header
    expect(screen.getByRole("heading", { name: "Ramadan Food Drive" })).toBeInTheDocument();
    expect(screen.getAllByText("Community").length).toBeGreaterThan(0);
    expect(screen.getByText("Pack and distribute ration hampers.")).toBeInTheDocument();

    // the apply form uses the volunteer class + shows each custom question label
    const formEl = document.querySelector("form.apply-form");
    expect(formEl).not.toBeNull();
    expect(screen.getByText(/Why do you want to volunteer\?/)).toBeInTheDocument();
    expect(screen.getByText("Preferred shift")).toBeInTheDocument();
    expect(screen.getByText("Which days?")).toBeInTheDocument();
    expect(screen.getByText("Morning")).toBeInTheDocument();
    expect(screen.getByText("Saturday")).toBeInTheDocument();
    expect(screen.getByText("Upload your CV")).toBeInTheDocument();
    expect(screen.getByText("I confirm my details are accurate.")).toBeInTheDocument();

    // promoted identity fields are shown as profile-sourced
    expect(screen.getByText("Full name")).toBeInTheDocument();
    expect(screen.getByText("Email")).toBeInTheDocument();
  });

  it("shows a friendly note when there are no custom questions", () => {
    render(
      <VolunteerApplyPreview
        opportunity={{ name: "Blank", type: "health" }}
        form={{ version: 1, fields: [] }}
      />,
    );
    expect(screen.getByText(/No custom questions yet/)).toBeInTheDocument();
  });
});

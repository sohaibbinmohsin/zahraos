import { describe, expect, it } from "vitest";
import { applicationAnswerRows, attachmentFieldLabel } from "./applicationAnswers";

const snapshot = {
  version: 1,
  fields: [
    { id: "Mwkt7wsx", type: "short_text", label: "Why do you want to volunteer?" },
    {
      id: "Mwkt84my",
      type: "select",
      label: "Role on campus",
      options: [
        { value: "campus_director", label: "Co campus director" },
        { value: "member", label: "Member" },
      ],
    },
    {
      id: "Mwkt8vdi",
      type: "radio",
      label: "Can you attend the briefing?",
      options: [
        { value: "yes", label: "Yes" },
        { value: "no", label: "No" },
      ],
    },
    { id: "Mwkt9aew", type: "long_text", label: "Tell us about your experience" },
    { id: "cv", type: "file", label: "Curriculum vitae" },
  ],
};

describe("applicationAnswerRows", () => {
  it("uses form snapshot labels and choice labels instead of field ids", () => {
    const rows = applicationAnswerRows(
      {
        Mwkt7wsx: "A2",
        Mwkt84my: "campus_director",
        Mwkt8vdi: "yes",
        Mwkt9aew: "I have led three campus drives.",
        cv: "file-1",
      },
      snapshot,
    );

    expect(rows.map((row) => row.label)).toEqual([
      "Why do you want to volunteer?",
      "Role on campus",
      "Can you attend the briefing?",
      "Tell us about your experience",
    ]);
    expect(rows.map((row) => row.value)).toEqual([
      "A2",
      "Co campus director",
      "Yes",
      "I have led three campus drives.",
    ]);
    expect(rows.some((row) => row.label.includes("Mwkt"))).toBe(false);
  });

  it("keeps readable keys when the snapshot is missing and hides generated ids", () => {
    const rows = applicationAnswerRows(
      { full_name: "Sohaib", Mwkt7wsx: "A2" },
      null,
    );
    expect(rows).toEqual([
      { key: "full_name", label: "Full Name", value: "Sohaib" },
      { key: "Mwkt7wsx", label: "Question", value: "A2" },
    ]);
  });

  it("labels attachments from the form snapshot", () => {
    expect(attachmentFieldLabel("cv", snapshot)).toBe("Curriculum vitae");
    expect(attachmentFieldLabel("Mwkt7wsx", null)).toBe("Question");
  });
});

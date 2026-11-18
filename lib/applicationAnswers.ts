import type { FieldDef, FormDefinition } from "./forms";

export interface ApplicationAnswerRow {
  key: string;
  label: string;
  value: string;
}

function parseSnapshot(snapshot: unknown): FormDefinition | null {
  let raw = snapshot;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!raw || typeof raw !== "object") return null;
  const fields = (raw as { fields?: unknown }).fields;
  if (!Array.isArray(fields)) return null;
  const parsed: FieldDef[] = [];
  for (const item of fields) {
    if (!item || typeof item !== "object") continue;
    const field = item as Partial<FieldDef>;
    if (typeof field.id !== "string" || typeof field.label !== "string" || !field.label.trim()) continue;
    parsed.push(field as FieldDef);
  }
  return { version: 1, fields: parsed };
}

function looksLikeGeneratedId(key: string): boolean {
  return /^[A-Za-z][A-Za-z0-9]{5,}$/.test(key) && /\d/.test(key);
}

export function humanizeAnswerKey(key: string): string {
  if (looksLikeGeneratedId(key)) return "Question";
  const words = key.replace(/[_-]+/g, " ").trim();
  if (!words) return "Question";
  return words.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function optionLabel(field: FieldDef | undefined, value: string): string {
  const match = field?.options?.find((option) => option.value === value);
  return match?.label ?? value;
}

function formatAnswer(field: FieldDef | undefined, answer: unknown): string {
  if (answer == null || answer === "") return "";
  if (field?.type === "checkbox" || typeof answer === "boolean") {
    if (answer === true || answer === "true" || answer === "yes") return "Yes";
    if (answer === false || answer === "false" || answer === "no") return "No";
  }
  if (Array.isArray(answer)) {
    return answer
      .filter((item) => item != null && item !== "")
      .map((item) => optionLabel(field, String(item)))
      .join(", ");
  }
  if (typeof answer === "object") return JSON.stringify(answer);
  return optionLabel(field, String(answer));
}

export function applicationAnswerRows(
  answers: Record<string, unknown> | null | undefined,
  formSnapshot: unknown,
): ApplicationAnswerRow[] {
  const source = answers ?? {};
  const fields = parseSnapshot(formSnapshot)?.fields ?? [];
  const byId = new Map(fields.map((field) => [field.id, field]));
  const used = new Set<string>();
  const rows: ApplicationAnswerRow[] = [];

  const push = (key: string, field: FieldDef | undefined, answer: unknown) => {
    if (field?.type === "file") return;
    const value = formatAnswer(field, answer);
    if (!value) return;
    used.add(key);
    rows.push({
      key,
      label: field?.label.trim() || humanizeAnswerKey(key),
      value,
    });
  };

  for (const field of fields) {
    if (!(field.id in source)) continue;
    push(field.id, field, source[field.id]);
  }
  for (const [key, answer] of Object.entries(source)) {
    if (used.has(key)) continue;
    push(key, byId.get(key), answer);
  }
  return rows;
}

export function attachmentFieldLabel(fieldId: string, formSnapshot: unknown): string {
  const field = parseSnapshot(formSnapshot)?.fields.find((item) => item.id === fieldId);
  return field?.label.trim() || humanizeAnswerKey(fieldId);
}

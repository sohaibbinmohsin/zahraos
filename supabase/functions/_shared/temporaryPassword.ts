// A short, readable one-time password the admin hands to the member.
// Meets Supabase complexity (lower + upper + digit + symbol, >= 8 chars).
export function temporaryPassword(): string {
  const lower = "abcdefghijkmnpqrstuvwxyz"; // no l/o
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I/O
  const digits = "23456789"; // no 0/1
  const pick = (set: string, n: number) =>
    Array.from({ length: n }, () => set[Math.floor(Math.random() * set.length)]).join("");
  return `Rizq-${pick(upper, 1)}${pick(lower, 3)}-${pick(digits, 4)}!`;
}

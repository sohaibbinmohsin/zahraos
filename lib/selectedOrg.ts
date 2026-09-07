export function resolveOrgSwitcherOptions(
  orgRoles: { organizationId: string }[],
  moduleAccess: { organizationId: string }[],
): string[] {
  const ids = new Set<string>([
    ...orgRoles.map((r) => r.organizationId),
    ...moduleAccess.map((m) => m.organizationId),
  ]);
  return Array.from(ids);
}

export function pickInitialOrgId(availableOrgIds: string[], storedOrgId: string | null): string | null {
  if (storedOrgId && availableOrgIds.includes(storedOrgId)) {
    return storedOrgId;
  }
  return availableOrgIds[0] ?? null;
}

/**
 * The selected org lives in a cookie, not localStorage, because the root
 * layout resolves the shell (including that org's name, logo and colour)
 * during SSR — and the server can only see cookies. localStorage is written
 * alongside it purely so an existing session keeps its choice on the first
 * load after this change.
 */
export const SELECTED_ORG_COOKIE = "platform.selectedOrgId";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name.replace(/\./g, "\\.")}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function readStoredOrgId(): string | null {
  if (typeof window === "undefined") return null;
  const fromCookie = readCookie(SELECTED_ORG_COOKIE);
  if (fromCookie) return fromCookie;
  try {
    return window.localStorage.getItem(SELECTED_ORG_COOKIE);
  } catch {
    return null;
  }
}

export function writeStoredOrgId(orgId: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${SELECTED_ORG_COOKIE}=${encodeURIComponent(orgId)}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`;
  try {
    window.localStorage.setItem(SELECTED_ORG_COOKIE, orgId);
  } catch {
    // Storage can be unavailable (private browsing, quota); the cookie above
    // is what actually matters.
  }
}

export function clearStoredOrgId(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${SELECTED_ORG_COOKIE}=; path=/; max-age=0; samesite=lax`;
  try {
    window.localStorage.removeItem(SELECTED_ORG_COOKIE);
  } catch {
    // Non-fatal.
  }
}

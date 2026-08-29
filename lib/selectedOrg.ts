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

const STORAGE_KEY = "platform.selectedOrgId";

export function readStoredOrgId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function writeStoredOrgId(orgId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, orgId);
  } catch {
    // Storage can be unavailable (private browsing, quota); the org
    // switcher still works for the current session either way.
  }
}

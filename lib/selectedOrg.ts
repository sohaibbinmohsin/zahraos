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

// Remembers which governance nav groups the signed-in user can see, so a
// reload paints the sidebar with the same fixed set of items immediately
// instead of hiding them until claims re-resolve.
const NAV_HINT_KEY = "platform.navHint";

export interface NavHint {
  governance: boolean;
  platform: boolean;
}

export function readStoredNavHint(): NavHint {
  const empty: NavHint = { governance: false, platform: false };
  if (typeof window === "undefined") return empty;
  try {
    const raw = window.localStorage.getItem(NAV_HINT_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Partial<NavHint>;
    return { governance: Boolean(parsed.governance), platform: Boolean(parsed.platform) };
  } catch {
    return empty;
  }
}

export function writeStoredNavHint(hint: NavHint): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(NAV_HINT_KEY, JSON.stringify(hint));
  } catch {
    // Non-fatal — the sidebar still reconciles once claims load.
  }
}

// Remembers the selected org's branding (name, logo, colour) so a reload
// paints the sidebar's logo and title immediately instead of blinking to
// the generic "Rizq" mark until the org data re-loads.
const BRAND_HINT_KEY = "platform.brandHint";

export interface BrandHint {
  label: string | null;
  logoUrl: string | null;
  brandColor: string | null;
}

export function readStoredBrandHint(): BrandHint {
  const empty: BrandHint = { label: null, logoUrl: null, brandColor: null };
  if (typeof window === "undefined") return empty;
  try {
    const raw = window.localStorage.getItem(BRAND_HINT_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Partial<BrandHint>;
    return {
      label: parsed.label ?? null,
      logoUrl: parsed.logoUrl ?? null,
      brandColor: parsed.brandColor ?? null,
    };
  } catch {
    return empty;
  }
}

export function writeStoredBrandHint(hint: BrandHint): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(BRAND_HINT_KEY, JSON.stringify(hint));
  } catch {
    // Non-fatal — the sidebar still reconciles once org data loads.
  }
}

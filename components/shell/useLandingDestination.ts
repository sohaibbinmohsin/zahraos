"use client";

import { firstAllowedDestination, type LandingDestination } from "@/lib/landingPath";
import { useStaffPermissions } from "./useStaffPermissions";

/**
 * The page this person should be on. While the shell is still loading, the
 * permission flags are all closed, so this is null until a real page exists.
 */
export function useLandingDestination(): LandingDestination | null {
  return firstAllowedDestination(useStaffPermissions());
}

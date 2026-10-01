"use client";

import { useCallback, useMemo } from "react";
import {
  useStaffClaims,
  useSelectedOrg,
  useOrgTier,
  useIsOrgAdminOrAbove,
} from "@/components/shell/AppShell";

export interface StaffPermissions {
  // Drive permissions
  canViewDrives: boolean;
  canCreateDrives: boolean;
  canPublishDrives: boolean;

  // Applications / Triage
  canViewApplications: boolean;
  canTriageApplications: boolean;

  // Hours Verification
  canViewHours: boolean;
  canApproveHours: boolean;

  // Volunteers Directory
  canViewVolunteers: boolean;

  // Dashboard Access
  canAccessDashboard: boolean;

  // Team & Governance
  canManageTeam: boolean;
  canManageOrgProfile: boolean;
  canCreateChapters: boolean;
  canEditChapter: (chapterId: string) => boolean;
  canViewInquiries: boolean;

  // Chapter Scope Helpers
  isChapterScoped: boolean;
  scopedChapterIds: string[] | null; // null => org-wide; array => restricted to specific chapter IDs
  hasChapterPermission: (permissionKey: string, targetChapterId?: string | null) => boolean;
}

export function useStaffPermissions(): StaffPermissions {
  const claims = useStaffClaims();
  const selectedOrgId = useSelectedOrg();
  useOrgTier(); // consumed from AppShell context
  const isOrgAdminOrAbove = useIsOrgAdminOrAbove();

  const isPlatformOwner = Boolean(claims?.platformOwner);
  const isAdmin = Boolean(isOrgAdminOrAbove || isPlatformOwner);

  // Active module access for current organization and youth-republic module
  const activeAccess = useMemo(() => {
    if (!claims?.moduleAccess || claims.moduleAccess.length === 0) return null;
    if (selectedOrgId) {
      const found = claims.moduleAccess.find(
        (m) => m.organizationId === selectedOrgId && m.module === "youth-republic"
      );
      if (found) return found;
      return claims.moduleAccess.find((m) => m.organizationId === selectedOrgId) ?? null;
    }
    return (
      claims.moduleAccess.find((m) => m.module === "youth-republic") ??
      claims.moduleAccess[0] ??
      null
    );
  }, [claims?.moduleAccess, selectedOrgId]);

  const permissions = useMemo(() => {
    return activeAccess?.permissions ?? [];
  }, [activeAccess]);

  const chapterScopes = useMemo(() => {
    return activeAccess?.chapterScopes;
  }, [activeAccess]);

  const hasPerm = useCallback(
    (permKey: string) => {
      return isAdmin || permissions.includes(permKey);
    },
    [isAdmin, permissions]
  );

  // Capability derivations
  const canViewDrives = isAdmin || hasPerm("opportunities:read") || hasPerm("opportunities:write");
  const canCreateDrives = isAdmin || hasPerm("opportunities:write");
  const canPublishDrives = isAdmin || hasPerm("noticeboard:write");

  const canViewApplications = isAdmin || hasPerm("applications:read") || hasPerm("applications:update");
  const canTriageApplications = isAdmin || hasPerm("applications:update");

  const canViewHours = isAdmin || hasPerm("hours:read") || hasPerm("hours:update");
  const canApproveHours = isAdmin || hasPerm("hours:update");

  const canViewVolunteers = isAdmin || hasPerm("volunteers:read");
  const canManageTeam = isAdmin || hasPerm("team:write");

  // Chapter scoping derivation
  const scopedChapterIds = useMemo(() => {
    if (isAdmin) return null;
    if (!chapterScopes) return null;
    const ids = new Set<string>();
    for (const list of Object.values(chapterScopes)) {
      if (Array.isArray(list)) {
        for (const id of list) {
          if (id) ids.add(id);
        }
      }
    }
    return ids.size > 0 ? Array.from(ids) : null;
  }, [isAdmin, chapterScopes]);

  const isChapterScoped = scopedChapterIds !== null && scopedChapterIds.length > 0;

  const hasChapterPermission = useCallback(
    (permissionKey: string, targetChapterId?: string | null): boolean => {
      if (isAdmin) {
        return true;
      }
      if (!permissions.includes(permissionKey)) {
        return false;
      }
      const scopedList = chapterScopes?.[permissionKey];
      if (!scopedList || scopedList.length === 0) {
        // Not chapter-scoped on this key -> org-wide capability
        return true;
      }
      if (!targetChapterId) {
        return false;
      }
      return scopedList.includes(targetChapterId);
    },
    [isAdmin, permissions, chapterScopes]
  );

  // Dashboard Access: Unforced gating based on pure viewing capabilities
  const canAccessDashboard = Boolean(canViewDrives || canViewApplications || canViewHours || canViewVolunteers);

  // Team & Governance scoped rules
  const canManageOrgProfile = !isChapterScoped && canManageTeam;
  const canCreateChapters = !isChapterScoped && canManageTeam;
  const canEditChapter = useCallback(
    (chapterId: string) => hasChapterPermission("chapters:write", chapterId),
    [hasChapterPermission]
  );
  const canViewInquiries = !isChapterScoped && (isAdmin || hasPerm("inquiries:read"));

  return useMemo<StaffPermissions>(
    () => ({
      canViewDrives,
      canCreateDrives,
      canPublishDrives,
      canViewApplications,
      canTriageApplications,
      canViewHours,
      canApproveHours,
      canViewVolunteers,
      canAccessDashboard,
      canManageTeam,
      canManageOrgProfile,
      canCreateChapters,
      canEditChapter,
      canViewInquiries,
      isChapterScoped,
      scopedChapterIds,
      hasChapterPermission,
    }),
    [
      canViewDrives,
      canCreateDrives,
      canPublishDrives,
      canViewApplications,
      canTriageApplications,
      canViewHours,
      canApproveHours,
      canViewVolunteers,
      canAccessDashboard,
      canManageTeam,
      canManageOrgProfile,
      canCreateChapters,
      canEditChapter,
      canViewInquiries,
      isChapterScoped,
      scopedChapterIds,
      hasChapterPermission,
    ]
  );
}

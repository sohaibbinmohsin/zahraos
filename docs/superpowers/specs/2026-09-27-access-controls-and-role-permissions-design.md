# Design Specification: Access Controls, Role Permissions, Chapter Scopes, and UI Matching

**Date:** 2026-09-27  
**Status:** Approved  
**Author:** Antigravity  

## 1. Overview & Objectives

In ZahraOS and the Youth Republic operational module, staff members can hold various system or custom roles, scoped either across the entire organization (`org_wide`) or restricted to a specific operational chapter (`chapter`).

Currently:
1. The frontend navigation (`AppShell.tsx` and `app/youth-republic/layout.tsx`) does not check user permissions, hardcoding all module links and top tabs.
2. An orphaned `"Team & Governance"` header and divider remain visible in the sidebar even when non-admin staff cannot access governance.
3. Badge queries (`listApplications`, `listActivityHours`) and dashboard multi-resource fetches (`Promise.all`) execute indiscriminately, throwing 403 Forbidden errors for users with partial permissions.
4. Operational pages (Drives, Applications, Hours) display mutation actions (e.g. `Create Drive`, `Publish drive`, `Select/Reject`, `Bulk Assign Hours`) to users who hold read-only or restricted capabilities.
5. In Team management drawers, native `<select>` tags are still present instead of ZahraOS's standard `@/components/ui/Select` card popover.

This specification details the architecture to enforce end-to-end alignment between backend staff claims/permissions and frontend UI elements, establishes an `AccessDeniedGate` for direct URL attempts, standardizes dropdowns, and outlines browser-based and automated verification across all role types.

---

## 2. Authorization Model & Capability Derivation

### 2.1 Staff Permissions Hook: `useStaffPermissions`

A new hook `useStaffPermissions()` (implemented in `components/shell/useStaffPermissions.ts`) derives granular operational capabilities from:
- `useStaffClaims()`: returns `StaffTokenClaims` (`platformOwner`, `moduleAccess`, `chapterScopes`).
- `useSelectedOrg()`: current active organization ID.
- `useOrgTier()` / `useIsOrgAdminOrAbove()`: platform/org administration level.

```typescript
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

  // Chapter Scope Helpers
  isChapterScoped: boolean;
  scopedChapterIds: string[] | null; // null => org-wide; array => restricted to specific chapter IDs
  hasChapterPermission: (permissionKey: string, targetChapterId?: string | null) => boolean;
}
```

### 2.2 Capability Mapping Rules

For the active organization under `youth-republic`:
- **`canViewDrives`**: `isOrgAdminOrAbove || hasPerm("opportunities:read") || hasPerm("opportunities:write")`
- **`canCreateDrives`**: `isOrgAdminOrAbove || hasPerm("opportunities:write")`
- **`canPublishDrives`**: `isOrgAdminOrAbove || hasPerm("noticeboard:write")`
- **`canViewApplications`**: `isOrgAdminOrAbove || hasPerm("applications:read") || hasPerm("applications:update")`
- **`canTriageApplications`**: `isOrgAdminOrAbove || hasPerm("applications:update")`
- **`canViewHours`**: `isOrgAdminOrAbove || hasPerm("hours:read") || hasPerm("hours:update")`
- **`canApproveHours`**: `isOrgAdminOrAbove || hasPerm("hours:update")`
- **`canViewVolunteers`**: `isOrgAdminOrAbove || hasPerm("volunteers:read")`
- **`canAccessDashboard`**: `isOrgAdminOrAbove || isOperationsLead || isDriveCoordinator || grantedCount >= 3`
- **`canManageTeam`**: `isOrgAdminOrAbove || hasPerm("team:write")`

### 2.3 Chapter Scoping Rules

When `chapterScopes` exists for a permission key in `moduleAccess`:
- If an action targets a specific opportunity or application with `chapter_id`, `hasChapterPermission(permissionKey, targetChapterId)` evaluates whether `targetChapterId` is within the user's scoped chapter IDs.
- For unrestricted / org-wide users, `scopedChapterIds` is `null` and any `targetChapterId` is permitted.

---

## 3. Navigation & Shell Architecture

### 3.1 Sidebar Cleanup (`components/shell/AppShell.tsx`)
- The divider `<div className="sidebar-module-divider" />` and label `<div className="nav-group-label">Team & Governance</div>` are strictly enclosed inside `{canManageTeam && (...)}`.
- Youth Republic navigation items are conditionally rendered:
  - **Dashboard**: rendered only if `canAccessDashboard`.
  - **Drives**: rendered only if `canViewDrives`.
  - **Applications**: rendered only if `canViewApplications`.
  - **Hours Verification**: rendered only if `canViewHours`.
  - **Volunteers**: rendered only if `canViewVolunteers`.
- **Badge Queries**:
  - `listApplications` is queried only if `canViewApplications`.
  - `listActivityHours` is queried only if `canViewHours`.
  - Wrapped in `Promise.allSettled` to prevent unhandled rejection.

### 3.2 Top Tabs Layout (`app/youth-republic/layout.tsx`)
- Tabs (`TAB_META`) are filtered according to `canAccessDashboard`, `canViewDrives`, `canViewApplications`, `canViewHours`, `canViewVolunteers`.
- Badge counting queries in `YouthRepublicModuleLayout` mirror the conditional execution used in `AppShell`.

### 3.3 Reusable Route Gate: `<AccessDeniedGate />`
- Placed in `components/shell/AccessDeniedGate.tsx`.
- Evaluates a condition `allowed: boolean`, displaying a styled notice if `false`:
  - Title: "Access Denied"
  - Description: "You do not have permission to view [Section Name]. Please contact your organization administrator if you need access."
  - Action: "Return to [Primary Section]" (e.g. Applications or Drives) linking to the user's first available permitted tab.

---

## 4. Page-Level Action Controls & Chapter Scoping

### 4.1 Drives Noticeboard (`app/youth-republic/drives/page.tsx`)
- **Header Actions**:
  - `Create Drive`: Rendered only if `canCreateDrives`.
- **Card Actions**:
  - `Edit`: Rendered only if `canCreateDrives` and user has permission for `opp.chapterId`.
  - `Publish drive`: Rendered only if `canPublishDrives` and user has permission for `opp.chapterId`.
  - `Impact & Stats`: Rendered only if `canCreateDrives || isOrgAdminOrAbove`.
  - `View Applicants`: Rendered only if `canViewApplications`.
  - `Restore` / `Delete`: Rendered only if `canCreateDrives` and user has permission for `opp.chapterId`.

### 4.2 Applications Page & Drawer (`applications/page.tsx` & `ApplicationReviewDrawer.tsx`)
- **Table Row Triage**:
  - `DecisionButton`s (`Select`, `Waitlist`, `Reject`, `Reconsider`): Only rendered if `canTriageApplications`.
  - When `canViewApplications && !canTriageApplications` (read-only triage, e.g. Auditor): row displays a read-only status pill without decision buttons.
- **Review Drawer**:
  - Decision buttons in drawer header/footer are hidden or disabled with a tooltip indicating read-only access.

### 4.3 Hours Verification Page & Drawer (`hours/page.tsx` & `AdjustHoursDrawer.tsx`)
- **Toolbar**:
  - `Bulk Assign Hours`: Rendered only if `canApproveHours`.
- **Table Rows**:
  - `Accredit`, `Reject`, `Adjust`: Rendered only if `canApproveHours`.
  - In read-only mode, only the status badge is displayed.

### 4.4 Dashboard (`app/youth-republic/dashboard/page.tsx`)
- Gated with `canAccessDashboard`. If `false`, displays `AccessDeniedGate`.
- Queries are executed using `Promise.allSettled`.
- If `getKpiSummary` fails due to missing `volunteers:read`, operational summary widgets (Active Drives, Pending Applications, Hours to Verify) still render without crashing.

### 4.5 Team Management Drawers & Dropdowns
- Ensure `Org Admin` is registered as a recognized role alongside `Super Admin` in the system role lists and seed helpers.
- In `components/team/RoleScopeRepeater.tsx`, `components/team/RoleDrawer.tsx`, and `components/team/EditMemberDrawer.tsx`, replace all native `<select>` tags with `@/components/ui/Select` to strictly maintain design system standards.

---

## 5. Verification Matrix & Testing Plan

### 5.1 Standard Roles Test Matrix

| Role | Dashboard | Drives | Create/Edit Drive | Publish Drive | Applications | Triage Apps | Hours | Approve Hours | Volunteers | Team & Gov |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Super Admin / Org Admin** | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| **Operations Lead** | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | No | No |
| **Drive Coordinator** | Yes | Yes | Yes | No | Yes | Yes | Yes | Yes | No | No |
| **Application Reviewer** | No | No | No | No | Yes | Yes | No | No | No | No |
| **Auditor** | No | No | No | No | Yes | No (Read) | Yes | No (Read) | No | No |
| **Chapter Coordinator (Lahore)** | Yes | Yes (LHR) | Yes (LHR) | No | Yes (LHR) | Yes (LHR) | Yes (LHR) | Yes (LHR) | No | No |

### 5.2 Browser Subagent Verification
- Launch browser subagent (`/browser`) on the running dev server (`http://localhost:3000`).
- Test login with different simulated roles:
  1. Verify Application Reviewer sees only Applications tab, no Team & Governance label, and cannot access `/youth-republic/hours` (clean Access Denied view).
  2. Verify Auditor sees Applications and Hours in read-only mode with zero mutation/decision buttons.
  3. Verify Chapter-scoped member sees only their chapter in the Create Drive form and cannot select other chapters.
  4. Verify Team Drawer uses custom `<Select>` dropdowns without visual glitches.

# AWS IAM-Inspired Roles & Permissions Interface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the `/team/roles` interface from a wide, multi-column Excel spreadsheet into an AWS IAM-style hierarchical policy table with module access summary badges and collapsible inline service policy inspectors that scales indefinitely as new modules are added.

**Architecture:** Introduce dynamic module service metadata and an access level resolver in `lib/capabilityMap.ts`. Extract the expanded inline policy view into `RoleServiceInspector.tsx`. Refactor `RolesTable.tsx` to a clean 5-column layout displaying governed module summary pills and interactive row expansion.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Vitest, Testing Library, Tailwind CSS / ZahraOS CSS tokens.

**Spec:** `docs/superpowers/specs/2026-11-01-iam-roles-and-permissions-design.md`

## Global Constraints
- Must strictly use ZahraOS design system tokens (`var(--line)`, `var(--bg-surface)`, `badge-pos`, `badge-neu`, `badge-neg`, etc.).
- Must use custom Select component from `@/components/ui/Select` (no native `<select>` tags).
- Never push directly to `main` or `master`. All work must stay on `feat/chapter-and-city-leads`.
- Production build `npm run build` must succeed with 0 errors.

---

### Task 1: Module Access Level Derivation & Service Metadata in `lib/capabilityMap.ts`

**Files:**
- Modify: `lib/capabilityMap.ts`
- Test: `lib/capabilityMap.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export type ModuleAccessLevel = "full" | "limited" | "read_only" | "restricted";

  export interface ServiceModuleConfig {
    key: string;
    title: string;
    description: string;
    capabilities: readonly CapabilityKey[];
  }

  export interface RoleModuleSummary {
    moduleKey: string;
    title: string;
    description: string;
    level: ModuleAccessLevel;
    grantedCount: number;
    readOnlyCount: number;
    restrictedCount: number;
    totalCount: number;
  }

  export const SERVICE_MODULES: readonly ServiceModuleConfig[];

  export function getRoleModuleSummaries(
    gridOrKeys: CapabilityGrid | string[],
    modules?: readonly ServiceModuleConfig[],
  ): RoleModuleSummary[];
  ```

- [ ] **Step 1: Write failing tests in `lib/capabilityMap.test.ts`**
  Add unit tests for `getRoleModuleSummaries`:
  - Super Admin yields "full" for both Youth Republic and Team Governance.
  - Chapter Lead yields "full" for Youth Republic and "limited" for Team Governance.
  - Fully restricted grid yields "restricted" for both modules.

- [ ] **Step 2: Run test to verify failure**
  Run: `npx vitest run lib/capabilityMap.test.ts`
  Expected: FAIL with `getRoleModuleSummaries is not a function`.

- [ ] **Step 3: Implement `SERVICE_MODULES` and `getRoleModuleSummaries` in `lib/capabilityMap.ts`**
  Define `SERVICE_MODULES` and compute counts of granted, readOnly, and restricted to return structured summaries.

- [ ] **Step 4: Run test to verify it passes**
  Run: `npx vitest run lib/capabilityMap.test.ts`
  Expected: PASS

- [ ] **Step 5: Commit**
  ```bash
  git add lib/capabilityMap.ts lib/capabilityMap.test.ts
  git commit -m "feat(roles): add module service configs and access level summarizer"
  ```

---

### Task 2: Inline IAM Service Policy Inspector (`RoleServiceInspector.tsx`)

**Files:**
- Create: `components/team/RoleServiceInspector.tsx`
- Test: `components/team/RoleServiceInspector.test.tsx`

**Interfaces:**
- Consumes:
  - `getRoleModuleSummaries`, `SERVICE_MODULES`, `CAPABILITY_META`, `CapabilityGrid`, `permissionKeysToGrid` from `lib/capabilityMap.ts`
- Produces:
  ```typescript
  export function RoleServiceInspector({
    grid,
    roleName,
    readOnly,
  }: {
    grid: CapabilityGrid;
    roleName: string;
    readOnly?: boolean;
  }): React.JSX.Element;
  ```

- [ ] **Step 1: Write failing test in `components/team/RoleServiceInspector.test.tsx`**
  Test that `RoleServiceInspector` renders:
  - Policy summary header.
  - Collapsible service module accordions for Youth Republic and Team & Governance.
  - Service access badges (Full Access, Limited, etc.).
  - Clicking a service accordion toggles its capability items.
  - Level badges (`Granted`, `Read Only`, `Restricted`) for each capability.

- [ ] **Step 2: Run test to verify failure**
  Run: `npx vitest run components/team/RoleServiceInspector.test.tsx`
  Expected: FAIL with module not found.

- [ ] **Step 3: Implement `RoleServiceInspector.tsx`**
  Create the component with state for toggling individual service accordions and rendering capabilities cleanly with ZahraOS design tokens.

- [ ] **Step 4: Run test to verify it passes**
  Run: `npx vitest run components/team/RoleServiceInspector.test.tsx`
  Expected: PASS

- [ ] **Step 5: Commit**
  ```bash
  git add components/team/RoleServiceInspector.tsx components/team/RoleServiceInspector.test.tsx
  git commit -m "feat(roles): add RoleServiceInspector component for IAM policy breakdown"
  ```

---

### Task 3: Refactor `RolesTable.tsx` to 5-Column AWS IAM Layout with Expandable Rows

**Files:**
- Modify: `components/team/RolesTable.tsx`
- Test: `components/team/RolesTable.test.tsx`

**Interfaces:**
- Consumes:
  - `RoleServiceInspector` from `components/team/RoleServiceInspector`
  - `getRoleModuleSummaries` from `lib/capabilityMap`
  - `Select` from `@/components/ui/Select`

- [ ] **Step 1: Update failing tests in `components/team/RolesTable.test.tsx`**
  Update tests to expect:
  - 5 fixed headers (Expand, Role Title & Type, Description, Governed Modules, Active Staff, Actions) instead of horizontal capability columns.
  - Module access pills in "Governed Modules" column.
  - Clicking row expands `RoleServiceInspector`.
  - "Expand All" toolbar button toggles all rows.
  - Module filter dropdown in toolbar filters roles by governed module access.

- [ ] **Step 2: Run test to verify failure**
  Run: `npx vitest run components/team/RolesTable.test.tsx`
  Expected: FAIL against old column structure.

- [ ] **Step 3: Refactor `RolesTable.tsx`**
  - Replace the 15-column table header with the 5 fixed columns.
  - Render module access pills in the Governed Modules cell using standard badges (`badge-pos` for Full, `badge-warn` for Limited, `badge-neu` for Read Only, `badge-neg` for Restricted).
  - Add row expansion state `expandedRoleIds: Set<string>`.
  - When expanded, render `<tr key={`${r.id}-detail`}><td colSpan={6}><RoleServiceInspector grid={grid} roleName={r.name} /></td></tr>`.
  - Add "Expand All" / "Collapse All" button in the toolbar.
  - Add Module Filter dropdown (`All Modules`, `Youth Republic`, `Team & Governance`) using `@/components/ui/Select`.

- [ ] **Step 4: Run test to verify it passes**
  Run: `npx vitest run components/team/RolesTable.test.tsx`
  Expected: PASS

- [ ] **Step 5: Commit**
  ```bash
  git add components/team/RolesTable.tsx components/team/RolesTable.test.tsx
  git commit -m "feat(roles): refactor RolesTable to AWS IAM 5-column expandable layout"
  ```

---

### Task 4: Whole-Suite Verification, Browser Check, and Build

**Files:**
- Check: All project tests and build

- [ ] **Step 1: Run full test suite**
  Run: `npm test`
  Expected: All 55+ test suites pass with 0 errors.

- [ ] **Step 2: Run production build**
  Run: `npm run build`
  Expected: Build completes with 0 errors.

- [ ] **Step 3: Verify in browser**
  Inspect `https://zahraos.sohaibbinmohsin.com/team/roles` using `agent-browser` to confirm layout, styling, and smooth row expansion.

- [ ] **Step 4: Commit and report**
  ```bash
  git status
  ```

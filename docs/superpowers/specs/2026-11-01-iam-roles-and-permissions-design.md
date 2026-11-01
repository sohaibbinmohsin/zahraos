# AWS IAM-Inspired Roles & Permissions Interface Design Spec

## 1. Problem Statement & Motivation
In ZahraOS, the `/team/roles` view displays an Excel-style capability table where every system permission (drive, notices, triage, hours, volunteers, chapters, members, roles, audit, inquiries, etc.) occupies an individual column.
With only Youth Republic and Team & Governance, the table already spans 11 capability columns (15 total columns including metadata and actions).
As ZahraOS grows to support additional enterprise modules (*Behen Bazar*, *Maseeha*, education, disaster relief, etc.), adding 4–8 capability columns per module will expand the table to 30–50 columns. This causes unreadable column headers, severe horizontal scrolling, and completely breaks usability on laptop and tablet viewports.

## 2. Design Goals
1. **AWS IAM Architectural Alignment:** Move from a flat spreadsheet matrix to an AWS IAM policy-based model. High-level list view shows governed module status summaries, while granular permissions are inspected via collapsible service accordions.
2. **Infinite Module Scalability:** The table maintains a constant 5-column width regardless of whether 1 module or 20 modules are registered.
3. **Automatic Module Discovery:** Module metadata and capability mappings are registered modularly. Adding a new module automatically integrates into role summaries and expanded service accordions with 0 manual CSS or table column edits.
4. **Design System Adherence:** Uses existing ZahraOS tokens (`--bg-surface`, `--card`, `--line`, `badge-pos`, `badge-neu`, `badge-neg`) and custom `@/components/ui/Select` dropdowns without external styling bloat.
5. **Zero Breaking Changes:** Maintains full backward compatibility with existing role data models, assignment payloads, and permission checks.

---

## 3. Architecture & Data Structures

### 3.1 Module Service Metadata
In `lib/capabilityMap.ts`:
```typescript
export type ServiceModuleKey = "youth-republic" | "team-governance" | string;

export interface ServiceModuleConfig {
  key: ServiceModuleKey;
  title: string;
  description: string;
  capabilities: readonly CapabilityKey[];
}

export type ModuleAccessLevel = "full" | "limited" | "read_only" | "restricted";

export interface RoleModuleSummary {
  moduleKey: ServiceModuleKey;
  title: string;
  level: ModuleAccessLevel;
  grantedCount: number;
  readOnlyCount: number;
  restrictedCount: number;
  totalCount: number;
}
```

### 3.2 Access Level Derivation
For any role and module:
- **`full`** (`badge-pos`): All non-restricted capabilities in the module are granted (or read-only if granted is not an available action).
- **`read_only`** (`badge-neu`): At least one capability is `read_only` and no capabilities are `granted`.
- **`limited`** (`badge-warn` / amber): A mix of granted/read-only and restricted capabilities (e.g. Chapter Lead has Drive + Hours granted, but Volunteer Directory restricted).
- **`restricted`** (`badge-neg`): All capabilities in the module are restricted.

---

## 4. UI Component Architecture

```
app/team/roles/page.tsx
  └── components/team/RolesTable.tsx
        ├── Toolbar (Search input, Role Type Select, Module Select, Expand/Collapse All toggle)
        ├── Table (5 Fixed Columns: [Expand Chevron], Role Title & Type, Description, Governed Modules, Active Staff, Actions)
        └── RoleServiceInspector.tsx (Rendered inside expanded row)
              ├── IAM Policy Header Summary
              └── Service Accordions (Youth Republic, Behen Bazar, Team & Governance)
                    └── Granular Capability Rows (Title, Level Badge)
```

### 4.1 Fixed Table Columns
1. **Expand Chevron (`w-8`)**: Toggles the inline IAM policy inspector for that role.
2. **Role Title & Type**: Name, `SYSTEM` or `CUSTOM` badge.
3. **Description**: Concise description with truncation tooltip.
4. **Governed Modules (Policy Summary)**: Interactive or summary badge pills for each active module (e.g. `[Youth Republic: Full Access]`, `[Team & Governance: Limited]`).
5. **Active Staff**: Badge showing assigned staff count (e.g. `3 Staff`).
6. **Actions**: `View` / `Edit`, `Clone`, `Delete` (guarded against active assignments).

### 4.2 Inline IAM Inspector (`RoleServiceInspector.tsx`)
When a row is expanded:
- Displays a clean policy card directly beneath the parent row (`colspan={6}`).
- Shows each governed module as a collapsible service panel.
- Panel header: Module Title, Access Level Badge (`FULL ACCESS`, `LIMITED`, `READ ONLY`, `RESTRICTED`), capability count (`4 Granted · 1 Restricted`).
- Panel body: List of capabilities with column title and level badge (`Granted`, `Read Only`, `Restricted`).

---

## 5. Testing & Verification Plan
1. **Unit Tests (`lib/capabilityMap.test.ts`)**:
   - Verify `getRoleModuleSummaries` accurately computes `full`, `limited`, `read_only`, and `restricted` across all role templates.
2. **Component Tests (`components/team/RolesTable.test.tsx`)**:
   - Verify 5 fixed table headers render.
   - Verify governed module pills render correct access levels.
   - Verify clicking row or chevron expands/collapses inline IAM inspector.
   - Verify "Expand All" toggles all rows.
   - Verify search filters by role name, description, and module name.
3. **Full Build & Verification**:
   - `npm test`: All 55+ test suites pass.
   - `npm run build`: 0 errors.

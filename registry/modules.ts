export interface ModuleRegistryEntry {
  key: string;
  navLabel: string;
  route: string;
  icon: string;
}

// Empty by design — this plan builds the mechanism the shell iterates
// over, not any module's screens. A module's own implementation plan
// appends its entry here as its own task; nothing else in this file
// changes when that happens (platform-design.md §5).
export const MODULE_REGISTRY: ModuleRegistryEntry[] = [];

export interface ModuleRegistryEntry {
  key: string;
  navLabel: string;
  route: string;
  icon: string;
}

export const MODULE_REGISTRY: ModuleRegistryEntry[] = [
  { key: "vms", navLabel: "VMS", route: "/modules/vms", icon: "🤝" },
];
